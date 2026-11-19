import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import {
  COMPUTERS,
  runWith,
  type EngineData,
  type MachineRow,
  type ReliabilityValue,
  type ReportRow,
  type TicketRow,
} from '../src/index.js';
import { partKey, partsOf } from '../src/analytics/critical-spares.js';
import { isProduction } from '../src/analytics/machine-facts.js';
import { failureEvents } from '../src/analytics/standard-kpis.js';
import { spareNames } from '../src/analytics/team-focus-spares.js';
import { ENGINE_DATA } from './answer-key/fixture.js';
import { RELIABILITY_EXPECTED as EXPECTED } from './reliability-expected.js';

/**
 * The critical spares (ticket 67, packet 67a): the parts written on a machine's own breakdown reports, keyed with
 * their digits kept, ranked by how often and then by how many hours, the top five, and no money. The key is the one
 * place the free-text log is touched; the fixture's "No", "Yes", a mangled part number and a sentence in one cell
 * are the cases the rule has to survive.
 */

const AS_OF = '2026-11-11';
const WINDOW_START = '2026-01-01';

const RESULT = runWith(COMPUTERS, { data: ENGINE_DATA, asOf: AS_OF, profile: DEFAULT_PROFILE });

function valueOf(data: EngineData = ENGINE_DATA): ReliabilityValue {
  const result =
    data === ENGINE_DATA
      ? RESULT
      : runWith(COMPUTERS, { data, asOf: AS_OF, profile: DEFAULT_PROFILE });
  const figure = result.figures.find((candidate) => candidate.key === 'reliability');
  if (figure === undefined) throw new Error('the engine knows no reliability figure');
  return figure.value as unknown as ReliabilityValue;
}

const sparesOf = (value: ReliabilityValue, id: string) => {
  const record = value.machines[id];
  if (record === undefined) throw new Error(`the figure holds no machine ${id}`);
  return record.spares;
};

const machine = (id: string): MachineRow => ({
  id,
  code: id,
  segment: 'CNC',
  category: 'Turning Center',
  cell: '1',
  location: null,
  make: null,
  model: null,
  controller: null,
  year: 2020,
  purchasedOn: null,
  powerKw: null,
  capacityKva: null,
  assetCode: null,
  status: 'active',
  criticality: null,
  excludedFromProduction: false,
  metadata: {},
});

const ticket = (id: string, machineId: string, date: string): TicketRow => ({
  id,
  ref: id,
  kind: 'stopped',
  status: 'closed',
  machineId,
  reportedAt: `${date}T08:00:00+05:30`,
  closedAt: `${date}T10:00:00+05:30`,
  source: 'history',
  downtimeMin: 60,
  repairMin: 30,
  workType: 'E',
});

function report(
  id: string,
  ticketId: string,
  date: string,
  rest: { spares?: string[]; minutes?: number; code?: string | null } = {},
): ReportRow {
  const spares = rest.spares ?? [];
  return {
    id,
    ticketId,
    machineId: 'm1',
    date,
    shift: '1',
    problem: 'x',
    downtimeMin: rest.minutes ?? 60,
    responseMin: null,
    repairMin: null,
    category: null,
    maintCode: rest.code ?? 'E',
    spareUsed: spares[0] ?? null,
    spares,
    rootCause: null,
    doneBy: [],
    supportedBy: [],
  };
}

/** One production machine and the rows the list reads, on the plant's two shifts. */
function plant(
  rows: ReadonlyArray<{ date: string; spares: string[]; minutes?: number; code?: string }>,
): EngineData {
  const tickets = rows.map((row, index) => ticket(`t${index}`, 'm1', row.date));
  const reports = rows.map((row, index) =>
    report(`r${index}`, `t${index}`, row.date, {
      spares: row.spares,
      minutes: row.minutes ?? 60,
      code: row.code ?? 'E',
    }),
  );
  return {
    timeZone: 'Asia/Kolkata',
    machines: [machine('m1')],
    moves: [],
    tickets,
    tasks: [],
    reports,
    people: [],
    lists: {},
    shifts: ENGINE_DATA.shifts,
  };
}

describe('the part key', () => {
  it('keeps digits, drops the stop words and a trailing quantity, and sorts the words', () => {
    expect(partKey('Bearing 6205')).toBe('6205 bearing');
    expect(partKey('Bearing 6305')).toBe('6305 bearing');
    expect(partKey('Seal 20422243 (5 set)')).toBe('20422243 seal');
    expect(partKey('20422243( set)')).toBe('20422243');
    expect(partKey('1" transperant pipe')).toBe('1 pipe transperant');
    expect(partKey('No')).toBe('');
    expect(partKey('Yes')).toBe('');
    expect(partKey('No any')).toBe('');
  });

  it('names a bare number and a whole sentence one part each, with the text kept whole', () => {
    const sentence = '20422243(Seal, ASSY HP 7/8" SL-IV/V 50 HYBRID 7)  5 -Nos';
    expect(partKey('2.04222431011039e+23')).not.toBe('');
    expect(partKey(sentence)).not.toBe(partKey('2.04222431011039e+23'));
  });
});

describe('WJ-01: the reference critical-spares list', () => {
  it('prints the five parts by uses then downtime, and the total behind them', () => {
    const value = valueOf();
    const spares = sparesOf(value, 'WJ-01');
    expect(spares.total).toBe(EXPECTED.spares.wj01.total);
    expect(spares.rows).toHaveLength(5);
    expect(spares.rows.map((row) => row.name)).toEqual(
      EXPECTED.spares.wj01.rows.map((row) => row.name),
    );
    spares.rows.forEach((row, index) => {
      const expected = EXPECTED.spares.wj01.rows[index]!;
      expect(row.uses, row.name).toBe(expected.uses);
      expect(row.downtimeHours, row.name).toBeCloseTo(expected.downtimeHours, 9);
      expect(row.lastOn, row.name).toBe(expected.lastOn);
    });
  });

  it('counts 23 reports, two of them sharing one part across two reports', () => {
    const value = valueOf();
    const reports = failureEvents(ENGINE_DATA).filter(
      (event) =>
        event.report.machineId === 'WJ-01' &&
        event.report.date >= WINDOW_START &&
        event.report.date <= AS_OF,
    );
    expect(reports).toHaveLength(EXPECTED.spares.wj01.reports);
    const top = sparesOf(value, 'WJ-01').rows[0]!;
    expect(top.uses).toBe(2);
    // The two reports behind "Seal 20422243": 257 and 540 recorded minutes = 13.2833 h.
    expect(top.downtimeHours).toBeCloseTo((257 + 540) / 60, 9);
  });
});

describe('HMC-2: the NO DT rule and the tie-break in one list', () => {
  it('lists four parts, the two NO DT parts at zero hours and ordered by key', () => {
    const spares = sparesOf(valueOf(), 'HMC-2');
    expect(spares.total).toBe(EXPECTED.hmc2.spares.length);
    expect(spares.rows.map((row) => row.name)).toEqual(EXPECTED.hmc2.spares.map((row) => row.name));
    spares.rows.forEach((row, index) => {
      const expected = EXPECTED.hmc2.spares[index]!;
      expect(row.uses, row.name).toBe(expected.uses);
      expect(row.downtimeHours, row.name).toBeCloseTo(expected.downtimeHours, 9);
      expect(row.lastOn, row.name).toBe(expected.lastOn);
    });
    // 2 amp break rectifier < brake hub: the two zero-hour parts have one order, not the log's.
    const zero = spares.rows.filter((row) => row.downtimeHours === 0).map((row) => row.name);
    expect(zero).toEqual(['Break Rectifier 2 amp', 'Brake hub']);
  });
});

describe('the rule the fixture cannot exercise', () => {
  it('counts a part named twice on one report once, with one downtime contribution', () => {
    const value = valueOf(
      plant([{ date: '2026-05-01', spares: ['Bearing 6205', 'Bearing 6205 (1 Nos)'] }]),
    );
    const spares = sparesOf(value, 'm1');
    expect(spares.total).toBe(1);
    expect(spares.rows).toHaveLength(1);
    expect(spares.rows[0]).toMatchObject({ name: 'Bearing 6205', uses: 1 });
    expect(spares.rows[0]!.downtimeHours).toBeCloseTo(1, 9);
  });

  it('keeps 6205 and 6305 apart, and drops “No” and “Yes” as answers rather than parts', () => {
    const two = valueOf(
      plant([
        { date: '2026-05-01', spares: ['Bearing 6205'] },
        { date: '2026-06-01', spares: ['Bearing 6305'] },
      ]),
    );
    expect(sparesOf(two, 'm1').total).toBe(2);
    expect(
      sparesOf(two, 'm1')
        .rows.map((row) => row.name)
        .sort(),
    ).toEqual(['Bearing 6205', 'Bearing 6305']);

    const answers = valueOf(
      plant([
        { date: '2026-05-01', spares: ['No'] },
        { date: '2026-06-01', spares: ['Yes'] },
      ]),
    );
    expect(sparesOf(answers, 'm1')).toEqual({ rows: [], total: 0 });
  });

  it('keeps a bare number and a sentence each as one part, and the label whole', () => {
    const sentence = '20422243(Seal, ASSY HP 7/8" SL-IV/V 50 HYBRID 7)  5 -Nos';
    const value = valueOf(
      plant([
        { date: '2026-05-01', spares: ['2.04222431011039e+23'] },
        { date: '2026-06-01', spares: [sentence] },
      ]),
    );
    const spares = sparesOf(value, 'm1');
    expect(spares.total).toBe(2);
    expect(spares.rows.map((row) => row.name).sort()).toEqual(
      ['2.04222431011039e+23', sentence].sort(),
    );
  });

  it('ranks by uses, then downtime, and caps the list at five with the total kept', () => {
    const value = valueOf(
      plant([
        { date: '2026-05-01', spares: ['Alpha part'], minutes: 60 },
        { date: '2026-05-02', spares: ['Alpha part'], minutes: 30 },
        { date: '2026-06-01', spares: ['Beta part'], minutes: 240 },
        { date: '2026-06-02', spares: ['Gamma part'], minutes: 180 },
        { date: '2026-07-01', spares: ['Delta part'], minutes: 120 },
        { date: '2026-07-02', spares: ['Epsilon part'], minutes: 90 },
        { date: '2026-08-01', spares: ['Zeta part'], minutes: 60 },
      ]),
    );
    const spares = sparesOf(value, 'm1');
    expect(spares.total).toBe(6);
    expect(spares.rows).toHaveLength(5);
    expect(spares.rows.map((row) => row.name)).toEqual([
      'Alpha part',
      'Beta part',
      'Gamma part',
      'Delta part',
      'Epsilon part',
    ]);
    expect(spares.rows[0]!.uses).toBe(2);
    expect(spares.rows[0]!.downtimeHours).toBeCloseTo(1.5, 9);
  });

  it('gives a NO DT report its place in the list and no downtime hours', () => {
    const value = valueOf(
      plant([{ date: '2026-05-01', spares: ['Bearing 6205'], minutes: 120, code: 'NO DT' }]),
    );
    const spares = sparesOf(value, 'm1');
    expect(spares.total).toBe(1);
    expect(spares.rows[0]!.downtimeHours).toBe(0);
    expect(spares.rows[0]!.uses).toBe(1);
  });
});

describe('the plant-wide spares', () => {
  it('reads 236 part fields on 215 reports, 205 spellings, and lists a part on 67 machines', () => {
    const reports = failureEvents(ENGINE_DATA).filter(
      (event) => event.report.date >= WINDOW_START && event.report.date <= AS_OF,
    );
    const fields = reports.flatMap((event) => spareNames(event.report));
    const withField = reports.filter((event) => spareNames(event.report).length > 0);
    expect(fields).toHaveLength(EXPECTED.spares.fields);
    expect(new Set(fields).size).toBe(EXPECTED.spares.spellings);
    expect(withField).toHaveLength(EXPECTED.spares.reportsWithField);
    expect(fields.filter((name) => partKey(name) === '' && name.trim() === 'No')).toHaveLength(
      EXPECTED.spares.droppedNo,
    );
    expect(fields.filter((name) => partKey(name) === '' && name.trim() === 'Yes')).toHaveLength(
      EXPECTED.spares.droppedYes,
    );

    const value = valueOf();
    const withPart = ENGINE_DATA.machines
      .filter(isProduction)
      .filter((one) => sparesOf(value, one.id).rows.length > 0);
    expect(withPart).toHaveLength(EXPECTED.spares.machinesWithPart);
    expect(EXPECTED.machines - withPart.length).toBe(EXPECTED.spares.machinesWithoutPart);
  });

  it('names the reports behind the listed parts, and nothing for a machine with no part', () => {
    const value = valueOf();
    const record = value.machines['HMC-2']!;
    expect(record.drill.spares).toHaveLength(EXPECTED.hmc2.spareReports);
    const known = new Set([...ENGINE_DATA.tickets, ...ENGINE_DATA.tasks].map((row) => row.id));
    expect(record.drill.spares.every((id) => known.has(id))).toBe(true);
    // VC-57 has no failure at all: no part, no report to open.
    expect(value.machines['VC-57']!.drill.spares).toEqual([]);
  });
});

describe('partsOf', () => {
  it('reads the same events the figure reads and ranks them', () => {
    const events = failureEvents(ENGINE_DATA).filter(
      (event) =>
        event.report.machineId === 'WJ-01' &&
        event.report.date >= WINDOW_START &&
        event.report.date <= AS_OF,
    );
    const parts = partsOf(events);
    expect(parts).toHaveLength(EXPECTED.spares.wj01.total);
    expect(parts[0]!.name).toBe(EXPECTED.spares.wj01.rows[0]!.name);
    expect(parts[0]!.uses).toBe(2);
    expect(DEFAULT_PROFILE.workDaysPerYear).toBe(300);
  });
});
