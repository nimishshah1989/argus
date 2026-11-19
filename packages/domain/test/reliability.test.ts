import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import {
  COMPUTERS,
  runWith,
  type EngineData,
  type FigureResult,
  type MachineRow,
  type ReliabilityValue,
  type ReportRow,
  type TicketRow,
} from '../src/index.js';
import { isProduction } from '../src/analytics/machine-facts.js';
import { amsaaOf, kmOf, weibullOf } from '../src/analytics/reliability.js';
import { failureEvents } from '../src/analytics/standard-kpis.js';
import { workingHoursFor } from '../src/analytics/working-hours.js';
import { ENGINE_DATA } from './answer-key/fixture.js';
import { RELIABILITY_EXPECTED as EXPECTED } from './reliability-expected.js';

/**
 * The reliability fit (ticket 67, packet 67a): 48's failure set read as events, the month-spread working hours as
 * the clock, and the three estimators on those observations. The reference numbers are hand-checked in
 * `reliability-expected.ts`; the fit inputs are recomputed here from the fixture through 48's own two functions,
 * never read back out of the figure, so a drift in either side of the seam shows up as a disagreement.
 */

const AS_OF = '2026-11-11';
const WINDOW_START = '2026-01-01';

const RESULT = runWith(COMPUTERS, { data: ENGINE_DATA, asOf: AS_OF, profile: DEFAULT_PROFILE });

/** The reliability figure of a data set, computed through the whole engine (the as-of cut included). */
/** The figure's value for a data set, through the engine for the key's own data and the computer for a variant. */
function valueOf(data: EngineData = ENGINE_DATA): ReliabilityValue {
  if (data === ENGINE_DATA) {
    const figure = RESULT.figures.find((candidate) => candidate.key === 'reliability');
    if (figure === undefined) throw new Error('the engine knows no reliability figure');
    return figure.value as unknown as ReliabilityValue;
  }
  return COMPUTERS.reliability!({ data, asOf: AS_OF, profile: DEFAULT_PROFILE })
    .value as unknown as ReliabilityValue;
}

function figureOf(data: EngineData = ENGINE_DATA): FigureResult {
  const result =
    data === ENGINE_DATA
      ? RESULT
      : runWith(COMPUTERS, { data, asOf: AS_OF, profile: DEFAULT_PROFILE });
  const figure = result.figures.find((candidate) => candidate.key === 'reliability');
  if (figure === undefined) throw new Error('the engine knows no reliability figure');
  return figure;
}

/**
 * The plan printed its numbers from two independent solvers and pinned them to 1e-6. The shape is stable to that:
 * the two agree to 4e-9. The scale is not — a Weibull scale amplifies a shape error by up to ~500, and the plan's
 * own two solvers differ by 5.8e-6 on the 322-hour VMC scale — so the scale and mean are pinned to a relative
 * 2e-8 (6.4e-6 there), which is the reference's own spread and no more. The KM survival is pinned to 1e-9.
 */
const shapeClose = (actual: number, expected: number) => expect(actual).toBeCloseTo(expected, 6);
const mleClose = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(2e-8 * Math.max(1, Math.abs(expected)));
const kmClose = (actual: number, expected: number) => expect(actual).toBeCloseTo(expected, 9);

const machineOf = (value: ReliabilityValue, id: string) => {
  const record = value.machines[id];
  if (record === undefined) throw new Error(`the figure holds no machine ${id}`);
  return record;
};

/**
 * A machine's observations, recomputed from the fixture with 48's functions: its distinct failure dates, the
 * working hours at each, the intervals between them and the tail to the run date. Deliberately not the module's
 * own input builder.
 */
function observationsOf(id: string): {
  machine: MachineRow;
  dates: string[];
  cumulative: number[];
  intervals: number[];
  tail: number;
} {
  const machine = ENGINE_DATA.machines.find((candidate) => candidate.id === id);
  if (machine === undefined) throw new Error(`the fixture holds no machine ${id}`);
  const inWindow = failureEvents(ENGINE_DATA).filter(
    (event) =>
      event.report.machineId === id &&
      event.report.date >= WINDOW_START &&
      event.report.date <= AS_OF,
  );
  const dates = [...new Set(inWindow.map((event) => event.report.date))].sort();
  const hours = (date: string) =>
    workingHoursFor(machine, ENGINE_DATA.shifts ?? [], DEFAULT_PROFILE.workDaysPerYear, {
      from: WINDOW_START,
      to: date,
    });
  const cumulative = dates.map(hours);
  return {
    machine,
    dates,
    cumulative,
    intervals: cumulative.slice(1).map((value, index) => value - cumulative[index]!),
    tail: hours(AS_OF) - cumulative.at(-1)!,
  };
}

/** The tables the figure reads keep 2026 dates only: a 2025 row can be added to the data, never to the fit. */
function ticket(id: string, date: string, source: TicketRow['source']): TicketRow {
  return {
    id,
    ref: id,
    kind: 'stopped',
    status: 'closed',
    machineId: 'HMC-2',
    reportedAt: `${date}T08:00:00+05:30`,
    closedAt: `${date}T09:00:00+05:30`,
    source,
    downtimeMin: 60,
    repairMin: 30,
    workType: 'E',
  };
}

function report(id: string, ticketId: string, date: string, spares: string[]): ReportRow {
  return {
    id,
    ticketId,
    machineId: 'HMC-2',
    date,
    shift: '1',
    problem: 'x',
    downtimeMin: 60,
    responseMin: null,
    repairMin: null,
    category: null,
    maintCode: 'E',
    spareUsed: spares[0] ?? null,
    spares,
    rootCause: null,
    doneBy: [],
    supportedBy: [],
  };
}

const withRows = (tickets: readonly TicketRow[], reports: readonly ReportRow[]): EngineData => ({
  ...ENGINE_DATA,
  tickets: [...ENGINE_DATA.tickets, ...tickets],
  reports: [...ENGINE_DATA.reports, ...reports],
});

describe('the fit inputs', () => {
  it('reads 48’s failure set as one event a failure date, on the production fleet in the year', () => {
    const value = valueOf();
    const production = ENGINE_DATA.machines.filter(isProduction);
    expect(production).toHaveLength(EXPECTED.machines);
    expect(Object.keys(value.machines).sort()).toEqual(production.map((one) => one.id).sort());

    const events = failureEvents(ENGINE_DATA).filter(
      (event) => event.report.date >= WINDOW_START && event.report.date <= AS_OF,
    );
    expect(events).toHaveLength(EXPECTED.reports);
    const byMachine = new Map<string, Set<string>>();
    for (const event of events) {
      const dates = byMachine.get(event.report.machineId) ?? new Set<string>();
      dates.add(event.report.date);
      byMachine.set(event.report.machineId, dates);
    }
    expect([...byMachine.values()].reduce((sum, dates) => sum + dates.size, 0)).toBe(
      EXPECTED.events,
    );
    expect(byMachine.size).toBe(EXPECTED.machinesWithFailure);
    expect(production.length - byMachine.size).toBe(EXPECTED.machinesWithoutFailure);
    const repeats = [...byMachine].filter(([id]) => {
      const reports = events.filter((event) => event.report.machineId === id).length;
      return reports > byMachine.get(id)!.size;
    });
    expect(repeats).toHaveLength(EXPECTED.machinesWithRepeat);
    expect(EXPECTED.reports - EXPECTED.events).toBe(EXPECTED.sameDateRepeats);
  });

  it('clocks the fleet in 48’s month-spread hours, the same total the comparison prints', () => {
    const value = valueOf();
    expect(value.windowStart).toBe(WINDOW_START);
    expect(value.asOf).toBe(AS_OF);
    expect(value.minimumEvents).toBe(EXPECTED.minimumEvents);
    let summed = 0;
    for (const machine of ENGINE_DATA.machines.filter(isProduction)) {
      summed += workingHoursFor(
        machine,
        ENGINE_DATA.shifts ?? [],
        DEFAULT_PROFILE.workDaysPerYear,
        {
          from: WINDOW_START,
          to: AS_OF,
        },
      );
    }
    expect(summed).toBeCloseTo(EXPECTED.workingHours, 6);
  });

  it('covers the fleet at the rule’s threshold: own fit, category, then not enough history', () => {
    const value = valueOf();
    const blocks = Object.values(value.machines).map((record) => record.fit);
    const fitted = blocks.filter((block) => block.status === 'fitted');
    expect(fitted.filter((block) => block.basis === 'machine')).toHaveLength(EXPECTED.ownFits);
    expect(fitted.filter((block) => block.basis === 'category')).toHaveLength(
      EXPECTED.categoryFits,
    );
    expect(blocks.filter((block) => block.status === 'insufficient')).toHaveLength(
      EXPECTED.insufficient,
    );
    expect(Object.keys(value.categories)).toHaveLength(EXPECTED.categories);
    const machineIds = Object.entries(value.machines)
      .filter(([, record]) => record.fit.status === 'fitted' && record.fit.basis === 'machine')
      .map(([id]) => id);
    expect(machineIds).toHaveLength(83);
    // Every own fit really has the five events and four intervals the threshold asks for.
    for (const id of machineIds) {
      const block = machineOf(value, id).fit;
      if (block.status !== 'fitted') throw new Error(`${id} is not fitted`);
      expect(block.events, id).toBeGreaterThanOrEqual(5);
      expect(block.completeIntervals, id).toBe(block.events - 1);
      expect(block.completeIntervals, id).toBeGreaterThanOrEqual(4);
    }
  });

  it('drills to the production fleet, one machine row per page', () => {
    const computed = figureOf();
    expect(computed.drill.type).toBe('machine');
    expect(computed.drill.ids).toHaveLength(EXPECTED.machines);
    const known = new Set(ENGINE_DATA.machines.map((machine) => machine.id));
    expect(computed.drill.ids.every((id) => known.has(id))).toBe(true);
  });
});

describe('HMC-2: a machine with enough failures for its own fit', () => {
  it('fits the two-parameter Weibull on 42 intervals and the 70-hour tail', () => {
    const value = valueOf();
    const block = machineOf(value, 'HMC-2').fit;
    expect(block).toMatchObject({
      status: 'fitted',
      basis: 'machine',
      category: 'Horizontal Machining Center',
      ownEvents: EXPECTED.hmc2.events,
      events: EXPECTED.hmc2.events,
      completeIntervals: EXPECTED.hmc2.completeIntervals,
    });
    if (block.status !== 'fitted') throw new Error('HMC-2 is not fitted');
    expect(block.censoredHours).toBeCloseTo(EXPECTED.hmc2.censoredHours, 6);
    if (block.status !== 'fitted') throw new Error('HMC-2 is not fitted');
    shapeClose(block.shape, EXPECTED.hmc2.shape);
    mleClose(block.scale, EXPECTED.hmc2.scale);
    mleClose(block.meanHours, EXPECTED.hmc2.meanHours);
    expect(block.trend.label).toBe(EXPECTED.hmc2.trend.label);
    mleClose(block.trend.beta, EXPECTED.hmc2.trend.beta);
    expect(block.trend.n).toBe(EXPECTED.hmc2.trend.n);
  });

  it('uses the censored tail: the same intervals without it give a different shape and scale', () => {
    const { intervals, tail } = observationsOf('HMC-2');
    expect(intervals).toHaveLength(EXPECTED.hmc2.completeIntervals);
    expect(tail).toBeCloseTo(EXPECTED.hmc2.censoredHours, 9);
    const censored = weibullOf(intervals, [tail]);
    const uncensored = weibullOf(intervals, []);
    expect(censored.shape).not.toBe(uncensored.shape);
    shapeClose(uncensored.shape, EXPECTED.hmc2.uncensored.shape);
    mleClose(uncensored.scale, EXPECTED.hmc2.uncensored.scale);
    // The 70-hour tail moves the shape by ~0.006 and the scale by ~2.4 h: it is an observation, not decoration.
    expect(Math.abs(uncensored.shape - censored.shape)).toBeGreaterThan(0.005);
    expect(Math.abs(uncensored.scale - censored.scale)).toBeGreaterThan(2);
  });

  it('prints the product-limit steps and the three quartiles', () => {
    const { intervals, tail } = observationsOf('HMC-2');
    const { steps, quartiles } = kmOf(intervals, [tail]);
    for (const [time, survival] of EXPECTED.hmc2.steps) {
      const step = steps.find((candidate) => Math.abs(candidate.hours - time) < 1e-6);
      if (step === undefined) throw new Error(`no Kaplan-Meier step at ${time}`);
      kmClose(step.survival, survival);
    }
    expect(quartiles.q25).toBeCloseTo(EXPECTED.hmc2.quartiles.q25, 6);
    expect(quartiles.median).toBeCloseTo(EXPECTED.hmc2.quartiles.median, 6);
    expect(quartiles.q75).toBeCloseTo(EXPECTED.hmc2.quartiles.q75, 6);
    // The rule is the first step at or below the quarter, never an interpolation: 0.511628 at 50.806452 is above a
    // half and 0.488372 at 51.370968 is the first at or below it.
    const value = valueOf();
    const block = machineOf(value, 'HMC-2').fit;
    if (block.status !== 'fitted') throw new Error('HMC-2 is not fitted');
    expect(block.quartiles.median).toBeCloseTo(EXPECTED.hmc2.quartiles.median, 6);
  });

  it('prints the slope and the two-standard-error word beside it', () => {
    const value = valueOf();
    const block = machineOf(value, 'HMC-2').fit;
    if (block.status !== 'fitted') throw new Error('HMC-2 is not fitted');
    const { beta, n, label } = block.trend;
    const standardError = beta / Math.sqrt(n);
    expect(Math.abs(beta - 1)).toBeGreaterThan(2 * standardError);
    expect(label).toBe('worsening');
  });

  it('drills its 50 reports and the reports behind its four parts', () => {
    const value = valueOf();
    const record = machineOf(value, 'HMC-2');
    const reports = failureEvents(ENGINE_DATA).filter(
      (event) =>
        event.report.machineId === 'HMC-2' &&
        event.report.date >= WINDOW_START &&
        event.report.date <= AS_OF,
    );
    expect(record.drill.fit).toHaveLength(50);
    expect([...record.drill.fit].sort()).toEqual(reports.map((event) => event.ticket.id).sort());
    expect(record.drill.spares).toHaveLength(EXPECTED.hmc2.spareReports);
    const known = new Set(dataTickets());
    expect(record.drill.spares.every((id) => known.has(id))).toBe(true);
  });
});

/** Every ticket id the fixture holds, so a drill can be checked against the rows it names. */
function dataTickets(): string[] {
  return [...ENGINE_DATA.tickets, ...ENGINE_DATA.tasks].map((ticket) => ticket.id);
}

describe('TC-17: the smallest fit the rule allows, with most of its exposure censored', () => {
  it('fits five events and four intervals with the 857.5-hour tail', () => {
    const value = valueOf();
    const block = machineOf(value, 'TC-17').fit;
    expect(block).toMatchObject({
      status: 'fitted',
      basis: 'machine',
      category: 'Turning Center',
      ownEvents: EXPECTED.tc17.events,
      events: EXPECTED.tc17.events,
      completeIntervals: EXPECTED.tc17.completeIntervals,
    });
    if (block.status !== 'fitted') throw new Error('TC-17 is not fitted');
    expect(block.censoredHours).toBeCloseTo(EXPECTED.tc17.censoredHours, 6);
    if (block.status !== 'fitted') throw new Error('TC-17 is not fitted');
    shapeClose(block.shape, EXPECTED.tc17.shape);
    mleClose(block.scale, EXPECTED.tc17.scale);
    mleClose(block.meanHours, EXPECTED.tc17.meanHours);
    expect(block.trend.n).toBe(EXPECTED.tc17.trend.n);
    mleClose(block.trend.beta, EXPECTED.tc17.trend.beta);
    expect(block.trend.label).toBe(EXPECTED.tc17.trend.label);
  });

  it('hand-checks the product-limit: 0.8, 0.6, 0.4, 0.2 on risk sets 5, 4, 3, 2', () => {
    const { intervals, tail } = observationsOf('TC-17');
    expect(intervals).toHaveLength(4);
    expect(tail).toBeCloseTo(EXPECTED.tc17.censoredHours, 9);
    const { steps, quartiles } = kmOf(intervals, [tail]);
    expect(steps).toHaveLength(EXPECTED.tc17.steps.length);
    EXPECTED.tc17.steps.forEach(([time, survival], index) => {
      expect(steps[index]!.hours).toBeCloseTo(time, 6);
      kmClose(steps[index]!.survival, survival);
    });
    expect(quartiles.q25).toBeCloseTo(EXPECTED.tc17.quartiles.q25, 6);
    expect(quartiles.median).toBeCloseTo(EXPECTED.tc17.quartiles.median, 6);
    expect(quartiles.q75).toBeCloseTo(EXPECTED.tc17.quartiles.q75, 6);
  });

  it('labels a steep slope “no clear trend” when five failures cannot separate it from noise', () => {
    const value = valueOf();
    const block = machineOf(value, 'TC-17').fit;
    if (block.status !== 'fitted') throw new Error('TC-17 is not fitted');
    const { beta, n, label } = block.trend;
    expect(beta).toBeGreaterThan(3);
    const standardError = beta / Math.sqrt(n);
    expect(Math.abs(beta - 1)).toBeLessThan(2 * standardError);
    expect(label).toBe('no_clear_trend');
  });

  it('drops the tail to prove it is in the likelihood: without it the scale halves', () => {
    const { intervals } = observationsOf('TC-17');
    const censored = weibullOf(intervals, [EXPECTED.tc17.censoredHours]);
    const uncensored = weibullOf(intervals, []);
    shapeClose(uncensored.shape, EXPECTED.tc17.uncensored.shape);
    mleClose(uncensored.scale, EXPECTED.tc17.uncensored.scale);
    // λ moves from 373.2 to 174.4: 114 %, the plan's own warning.
    expect(censored.scale / uncensored.scale).toBeGreaterThan(2);
  });
});

describe('the category pool', () => {
  it('pools the Turning Center’s 38 machines: 260 events, 225 intervals and 35 tails', () => {
    const value = valueOf();
    const category = value.categories['Turning Center'];
    expect(category).toBeDefined();
    expect(category).toMatchObject({
      events: EXPECTED.turningCenter.events,
      completeIntervals: EXPECTED.turningCenter.completeIntervals,
      machines: EXPECTED.turningCenter.machinesWithEvents,
    });
    expect(category!.censoredHours).toBeCloseTo(EXPECTED.turningCenter.censoredHours, 6);
    shapeClose(category!.shape, EXPECTED.turningCenter.shape);
    mleClose(category!.scale, EXPECTED.turningCenter.scale);
    mleClose(category!.meanHours, EXPECTED.turningCenter.meanHours);
    expect(category!.quartiles.q25).toBeCloseTo(EXPECTED.turningCenter.quartiles.q25, 6);
    expect(category!.quartiles.median).toBeCloseTo(EXPECTED.turningCenter.quartiles.median, 6);
    expect(category!.quartiles.q75).toBeCloseTo(EXPECTED.turningCenter.quartiles.q75, 6);
    mleClose(category!.trend.beta, EXPECTED.turningCenter.trend.beta);
    expect(category!.trend).toMatchObject({
      n: EXPECTED.turningCenter.trend.n,
      label: EXPECTED.turningCenter.trend.label,
    });

    // The pool's own machines: the Turning Center's 38 production rows, not the plant.
    const machines = ENGINE_DATA.machines.filter(
      (machine) => isProduction(machine) && machine.category === 'Turning Center',
    );
    expect(machines).toHaveLength(EXPECTED.turningCenter.machines);
  });

  it('fills the two other large categories and leaves a small one out', () => {
    const value = valueOf();
    const vertical = value.categories['Vertical Machining Center']!;
    shapeClose(vertical.shape, EXPECTED.verticalMachiningCenter.shape);
    mleClose(vertical.scale, EXPECTED.verticalMachiningCenter.scale);
    expect(vertical.quartiles.median).toBeCloseTo(
      EXPECTED.verticalMachiningCenter.quartiles.median,
      6,
    );
    mleClose(vertical.trend.beta, EXPECTED.verticalMachiningCenter.trend.beta);
    expect(vertical.trend.label).toBe('worsening');

    const horizontal = value.categories['Horizontal Machining Center']!;
    shapeClose(horizontal.shape, EXPECTED.horizontalMachiningCenter.shape);
    mleClose(horizontal.scale, EXPECTED.horizontalMachiningCenter.scale);
    mleClose(horizontal.trend.beta, EXPECTED.horizontalMachiningCenter.trend.beta);
    expect(horizontal.quartiles.median).toBeCloseTo(
      EXPECTED.horizontalMachiningCenter.quartiles.median,
      6,
    );
    expect(value.categories['CNC Internal Grinding']).toBeUndefined();
  });

  it('lends TC-24 its category’s fit, labelled, with its own four tickets', () => {
    const value = valueOf();
    const block = machineOf(value, 'TC-24').fit;
    expect(block).toMatchObject({
      status: 'fitted',
      basis: 'category',
      category: EXPECTED.tc24.category,
      ownEvents: EXPECTED.tc24.ownEvents,
      events: EXPECTED.turningCenter.events,
      completeIntervals: EXPECTED.turningCenter.completeIntervals,
    });
    if (block.status !== 'fitted') throw new Error('TC-24 is not fitted');
    shapeClose(block.shape, EXPECTED.turningCenter.shape);
    mleClose(block.scale, EXPECTED.turningCenter.scale);
    const own = observationsOf('TC-24');
    expect(own.dates).toHaveLength(EXPECTED.tc24.ownEvents);
    expect(machineOf(value, 'TC-24').drill.fit.sort()).toEqual(
      failureEvents(ENGINE_DATA)
        .filter((event) => event.report.machineId === 'TC-24')
        .map((event) => event.ticket.id)
        .sort(),
    );
  });

  it('lends VC-57 the same kind of fit with no failures of its own and no spares', () => {
    const value = valueOf();
    const record = machineOf(value, 'VC-57');
    expect(record.fit).toMatchObject({
      status: 'fitted',
      basis: 'category',
      category: EXPECTED.vc57.category,
      ownEvents: EXPECTED.vc57.ownEvents,
    });
    expect(observationsOf('VC-57').dates).toHaveLength(0);
    expect(record.spares).toEqual({ rows: [], total: 0 });
    expect(record.drill).toEqual({ fit: [], spares: [] });
  });
});

describe('a machine the rule cannot fit', () => {
  it('says “not enough history” with its own count, its category’s count and the minimum', () => {
    const value = valueOf();
    for (const expected of EXPECTED.insufficientMachines) {
      const block = machineOf(value, expected.id).fit;
      expect(block).toMatchObject({
        status: 'insufficient',
        ownEvents: expected.ownEvents,
        category: expected.category,
        categoryEvents: expected.categoryEvents,
        minimum: EXPECTED.minimumEvents,
      });
    }
  });

  it('has its own state for a plant with no active shift window, never a fabricated denominator', () => {
    const value = valueOf({ ...ENGINE_DATA, shifts: [] });
    expect(value).not.toBeNull();
    expect(Object.keys(value.machines)).toHaveLength(EXPECTED.machines);
    expect(Object.values(value.machines).every((record) => record.fit.status === 'no_basis')).toBe(
      true,
    );
    expect(value.categories).toEqual({});
    // The spares need no working-hours basis, so the machine that has them keeps them.
    expect(machineOf(value, 'HMC-2').spares.total).toBe(4);
  });

  it('returns nothing for a plant with no production machine', () => {
    const conventional = {
      ...ENGINE_DATA,
      machines: ENGINE_DATA.machines.filter((machine) => !isProduction(machine)),
    };
    const computed = COMPUTERS.reliability!({
      data: conventional,
      asOf: AS_OF,
      profile: DEFAULT_PROFILE,
    });
    expect(computed).toEqual({ value: null, drillIds: [] });
  });
});

describe('the window', () => {
  it('drops a 2025 report from both the fit and the spares', () => {
    const base = valueOf();
    const extended = valueOf(
      withRows(
        [ticket('old', '2025-12-30', 'history')],
        [report('old-r', 'old', '2025-12-30', ['Bearing 6205'])],
      ),
    );
    expect(machineOf(extended, 'HMC-2').fit).toEqual(machineOf(base, 'HMC-2').fit);
    expect(machineOf(extended, 'HMC-2').spares).toEqual(machineOf(base, 'HMC-2').spares);
    expect(machineOf(extended, 'HMC-2').drill.fit).toEqual(machineOf(base, 'HMC-2').drill.fit);
  });

  it('enters a live close on a production machine as an event and a part', () => {
    const base = valueOf();
    const extended = valueOf(
      withRows(
        [ticket('live', '2026-11-10', 'live')],
        [report('live-r', 'live', '2026-11-10', ['Bearing 6305'])],
      ),
    );
    const before = machineOf(base, 'HMC-2');
    const after = machineOf(extended, 'HMC-2');
    if (before.fit.status !== 'fitted' || after.fit.status !== 'fitted')
      throw new Error('HMC-2 is not fitted');
    expect(after.fit.events).toBe(before.fit.events + 1);
    expect(after.fit.completeIntervals).toBe(before.fit.completeIntervals + 1);
    expect(after.fit.shape).not.toBe(before.fit.shape);
    expect(after.spares.total).toBe(before.spares.total + 1);
    expect(after.spares.rows.map((row) => row.name)).toContain('Bearing 6305');
    expect(after.drill.fit).toHaveLength(before.drill.fit.length + 1);
  });
});

describe('the estimators', () => {
  it('labels an improving process with the same two-standard-error rule', () => {
    // 25 events at t_i = 1000 * exp(-0.2 i): Σ ln(T/t_i) = 0.2 x 25 x 26 / 2 = 60, β = 25 / 60 = 0.4167.
    // se = 0.4167 / 5 = 0.0833; |β - 1| = 0.5833 > 2 x 0.0833 = 0.1667, so the word is "intervals are getting longer".
    const times = Array.from({ length: 25 }, (_, index) => 1_000 * Math.exp(-0.2 * index));
    const trend = amsaaOf([{ times, end: 1_000 }]);
    expect(trend.n).toBe(25);
    mleClose(trend.beta, 25 / 60);
    expect(trend.beta).toBeLessThan(1);
    expect(Math.abs(trend.beta - 1)).toBeGreaterThan(2 * (trend.beta / Math.sqrt(25)));
    expect(trend.label).toBe('improving');
  });

  it('is deterministic: the same data gives the same value object', () => {
    expect(valueOf()).toEqual(valueOf());
  });
});
