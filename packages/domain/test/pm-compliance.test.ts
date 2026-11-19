import { DEFAULT_PROFILE, addDays } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import {
  run,
  type EngineData,
  type MachineRow,
  type PmPlanRow,
  type TicketRow,
} from '../src/index.js';
import { computePmCompliance } from '../src/analytics/pm-compliance.js';
import {
  PM_COMPLIANCE_EXPECTED as EXPECTED,
  PM_COMPLIANCE_LATER,
} from './pm-compliance-expected.js';

/**
 * Both definitions of ticket 50b, on the plan's hand-computed fixture. The three cases that prove the figures are
 * different arithmetic: B1 is a PM early miss but a schedule hit, A1 is the reverse, and G1 is PM-pending while the
 * scheduled week has already ended — a test that checked one figure only would pass with the other definition.
 */

const AS_OF = '2026-11-11';
const FROM = '2026-01-01';
const TO = AS_OF;
const ZONE = 'Asia/Kolkata';

const machine = (id: string, code: string, category = 'VMC'): MachineRow => ({
  id,
  code,
  segment: 'CNC',
  category,
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

const plan = (id: string, machineId: string, intervalDays: number): PmPlanRow => ({
  id,
  machineId,
  category: null,
  intervalDays,
  createdAt: '2025-06-01T00:00:00.000Z',
  lastDoneOn: null,
  active: true,
  updatedAt: '2025-06-01T00:00:00.000Z',
});

/** One planned work order: its scheduled day is the ticket's `task_expected_on`, the raise a week before it. */
function ticket(input: {
  id: string;
  ref: string;
  machineId: string;
  scheduledOn: string;
  channel?: string;
  closedOn?: string | null;
  status?: TicketRow['status'];
}): TicketRow {
  const { id, ref, machineId, scheduledOn, channel = 'pm', closedOn = null, status } = input;
  return {
    id,
    ref,
    kind: 'general',
    status: status ?? (closedOn === null ? 'open' : 'closed'),
    machineId,
    reportedAt: `${addDays(scheduledOn, -7)}T04:00:00.000Z`,
    closedAt: closedOn === null ? null : `${closedOn}T06:00:00.000Z`,
    source: 'live',
    downtimeMin: null,
    repairMin: null,
    workType: null,
    raisedChannel: channel,
    scheduledOn,
  };
}

/** Seven plans (one per PM machine, one of them unused) and the fixture's eleven planned work orders. */
const DATA: EngineData = {
  timeZone: ZONE,
  machines: [
    machine('m1', 'VC-1'),
    machine('m2', 'VC-2'),
    machine('m3', 'VC-3'),
    machine('m4', 'VC-4'),
    machine('m5', 'VC-5'),
    machine('m6', 'VC-6'),
    machine('m7', 'VC-7'),
    machine('m8', 'HMC-8', 'HMC'),
    machine('m9', 'GRD-9', 'GRD'),
  ],
  moves: [],
  tasks: [],
  reports: [],
  people: [],
  lists: {},
  pmPlans: [
    plan('p-a', 'm1', 182),
    plan('p-b', 'm2', 30),
    plan('p-c', 'm3', 182),
    plan('p-d', 'm4', 182),
    plan('p-g', 'm5', 182),
    plan('p-h', 'm6', 30),
    plan('p-e', 'm7', 30),
  ],
  tickets: [
    ticket({
      id: 't-a1',
      ref: 'PM-A1',
      machineId: 'm1',
      channel: 'pm',
      scheduledOn: '2026-06-01',
      closedOn: '2026-06-10',
    }),
    ticket({
      id: 't-b1',
      ref: 'PM-B1',
      machineId: 'm2',
      channel: 'pm',
      scheduledOn: '2026-01-19',
      closedOn: '2026-01-14',
    }),
    ticket({
      id: 't-b2',
      ref: 'PM-B2',
      machineId: 'm2',
      channel: 'pm',
      scheduledOn: '2026-02-13',
      closedOn: '2026-02-20',
    }),
    ticket({
      id: 't-b3',
      ref: 'PM-B3',
      machineId: 'm2',
      channel: 'pm',
      scheduledOn: '2026-03-22',
      closedOn: null,
    }),
    ticket({
      id: 't-c1',
      ref: 'PM-C1',
      machineId: 'm3',
      channel: 'pm',
      scheduledOn: '2026-07-02',
      closedOn: '2026-07-20',
    }),
    ticket({
      id: 't-d1',
      ref: 'PM-D1',
      machineId: 'm4',
      channel: 'pm',
      scheduledOn: '2026-04-01',
      closedOn: '2026-04-01',
    }),
    ticket({
      id: 't-d2',
      ref: 'PM-D2',
      machineId: 'm4',
      channel: 'pm',
      scheduledOn: '2026-09-30',
      closedOn: null,
    }),
    ticket({
      id: 't-g1',
      ref: 'PM-G1',
      machineId: 'm5',
      channel: 'pm',
      scheduledOn: '2026-10-30',
      closedOn: null,
    }),
    ticket({
      id: 't-h1',
      ref: 'PM-H1',
      machineId: 'm6',
      channel: 'pm',
      scheduledOn: '2026-08-31',
      closedOn: '2026-09-02',
      status: 'cancelled',
    }),
    ticket({
      id: 't-i1',
      ref: 'IN-I1',
      machineId: 'm8',
      channel: 'inspection',
      scheduledOn: '2026-10-01',
      closedOn: '2026-10-03',
    }),
    ticket({
      id: 't-i2',
      ref: 'IN-I2',
      machineId: 'm9',
      channel: 'inspection',
      scheduledOn: '2026-10-05',
      closedOn: null,
    }),
  ],
};

const compliance = (data: EngineData = DATA, asOf = AS_OF, to = TO) =>
  computePmCompliance(data, { from: FROM, to, asOf });

/** The only fixture ticket with this id, so a single row's two outcomes can be asserted in isolation. */
const only = (id: string): EngineData => ({
  ...DATA,
  tickets: DATA.tickets.filter((row) => row.id === id),
});

describe('PM compliance and schedule compliance', () => {
  it('computes both definitions from the hand-computed fixture: 2 of 8 PM and 3 of 11 planned', () => {
    const { value } = compliance();
    expect(value).toEqual(EXPECTED.value);
  });

  it('names every planned work order of the window once, in scheduled order', () => {
    expect(compliance().drillIds).toEqual([...EXPECTED.drill]);
  });

  it('is the pm-calendar figure: computed on read for the calendar year, with owner 50 and the ticket drill', () => {
    const result = run(DATA, AS_OF, DEFAULT_PROFILE);
    const figure = result.figures.find((row) => row.key === 'pm-compliance');
    expect(figure).toMatchObject({
      key: 'pm-compliance',
      screen: 'pm-calendar',
      owner: 50,
      status: 'ready',
      drill: { type: 'ticket' },
    });
    expect(figure?.value).toMatchObject({
      from: FROM,
      to: AS_OF,
      pm: { eligible: 8, pct: 25 },
      schedule: { eligible: 11, pct: 27.3 },
    });
    expect([...figure!.drill.ids].sort()).toEqual([...EXPECTED.drill].sort());
  });

  it('counts a closed PM job with no report row: the close is the ticket’s own date', () => {
    const { value } = compliance({ ...DATA, reports: [] });
    expect(value.pm).toMatchObject({ onTime: 2, eligible: 8, pct: 25 });
    expect(value.schedule).toMatchObject({ done: 3, eligible: 11, pct: 27.3 });
  });

  it('counts a cancelled job past its window as a PM cancelled miss and a schedule miss', () => {
    const { value } = compliance(only('t-h1'));
    expect(value.pm).toMatchObject({ eligible: 1, cancelled: 1, pending: 0, pct: 0 });
    expect(value.schedule).toMatchObject({ eligible: 1, done: 0, missed: 1, pct: 0 });
  });

  it('keeps a close after asOf out of the window, and judges it on the +15 boundary when asOf moves', () => {
    const closedLater = {
      ...DATA,
      tickets: DATA.tickets.map((row) =>
        row.id === 't-g1'
          ? ticket({
              id: 't-g1',
              ref: 'PM-G1',
              machineId: 'm5',
              channel: 'pm',
              scheduledOn: '2026-10-30',
              closedOn: '2026-11-14',
            })
          : row,
      ),
    };
    const early = compliance(closedLater, AS_OF, AS_OF).value;
    expect(early.pm).toMatchObject({ pending: 1, onTime: 2, eligible: 8 });
    expect(early.schedule).toMatchObject({ missed: 8, done: 3 });
    const later = compliance(
      closedLater,
      PM_COMPLIANCE_LATER.value.to,
      PM_COMPLIANCE_LATER.value.to,
    ).value;
    expect(later).toEqual(PM_COMPLIANCE_LATER.value);
  });

  it('answers zero with null percentages and no drill when no planned work order is in the window', () => {
    const onlyBreakdown: EngineData = {
      ...DATA,
      tickets: [
        ticket({
          id: 't-floor',
          ref: 'BD-1',
          machineId: 'm1',
          channel: 'floor',
          scheduledOn: '2026-06-01',
          closedOn: '2026-06-01',
        }),
      ],
    };
    const { value, drillIds } = compliance(onlyBreakdown);
    expect(value.pm).toEqual({
      eligible: 0,
      onTime: 0,
      early: 0,
      late: 0,
      overdue: 0,
      cancelled: 0,
      pending: 0,
      pct: null,
    });
    expect(value.schedule).toEqual({ eligible: 0, done: 0, missed: 0, pending: 0, pct: null });
    expect(drillIds).toEqual([]);
    const figure = run(onlyBreakdown, AS_OF, DEFAULT_PROFILE).figures.find(
      (row) => row.key === 'pm-compliance',
    );
    expect(figure).toMatchObject({ status: 'ready', drill: { ids: [] } });
  });
});

describe('the two definitions part where they must', () => {
  it('judges an inspection ticket by its scheduled week and never in the PM counts', () => {
    const data: EngineData = {
      ...DATA,
      pmPlans: [],
      tickets: [
        ticket({
          id: 't-sat',
          ref: 'IN-SAT',
          machineId: 'm1',
          channel: 'inspection',
          scheduledOn: '2026-10-01',
          closedOn: '2026-10-03',
        }),
        ticket({
          id: 't-mon',
          ref: 'IN-MON',
          machineId: 'm2',
          channel: 'inspection',
          scheduledOn: '2026-10-01',
          closedOn: '2026-10-05',
        }),
      ],
    };
    const { value } = compliance(data);
    expect(value.pm).toMatchObject({ eligible: 0, pct: null });
    // Saturday 3 October is inside 28 September–4 October; Monday 5 October is after the week's Sunday.
    expect(value.schedule).toMatchObject({ eligible: 2, done: 1, missed: 1, pending: 0, pct: 50 });
  });

  it('judges a 30-day plan at ±2 and a 182-day plan at ±15: the same three-day-late close is a miss and a hit', () => {
    const data: EngineData = {
      ...DATA,
      pmPlans: [plan('p1', 'm1', 30), plan('p2', 'm2', 182)],
      tickets: [
        ticket({
          id: 't-30',
          ref: 'PM-30',
          machineId: 'm1',
          channel: 'pm',
          scheduledOn: '2026-06-05',
          closedOn: '2026-06-08',
        }),
        ticket({
          id: 't-182',
          ref: 'PM-182',
          machineId: 'm2',
          channel: 'pm',
          scheduledOn: '2026-06-05',
          closedOn: '2026-06-08',
        }),
      ],
    };
    const { value } = compliance(data);
    expect(value.pm).toMatchObject({ eligible: 2, late: 1, onTime: 1, pct: 50 });
    // Friday 5 June's week ends Sunday 7 June: both closes are the Monday after it.
    expect(value.schedule).toMatchObject({ eligible: 2, done: 0, missed: 2, pct: 0 });
  });

  it('reads the tolerance from the machine’s effective plan, and 15 days for a ticket with no plan', () => {
    const category: PmPlanRow = { ...plan('p-cat', 'm1', 30), machineId: null, category: 'VMC' };
    const data: EngineData = {
      ...DATA,
      // The category plan covers every VMC machine: m2's ticket is judged at ±2 and the three-day close is late.
      pmPlans: [category],
      // m8 has no plan at all (it is not a VMC machine), so its ticket keeps the default ±15 and is on time.
      tickets: [
        ticket({
          id: 't-cat',
          ref: 'PM-CAT',
          machineId: 'm2',
          channel: 'pm',
          scheduledOn: '2026-06-05',
          closedOn: '2026-06-08',
        }),
        ticket({
          id: 't-none',
          ref: 'PM-NONE',
          machineId: 'm8',
          channel: 'pm',
          scheduledOn: '2026-06-05',
          closedOn: '2026-06-08',
        }),
      ],
    };
    expect(compliance(data).value.pm).toMatchObject({ eligible: 2, late: 1, onTime: 1 });
  });
});
