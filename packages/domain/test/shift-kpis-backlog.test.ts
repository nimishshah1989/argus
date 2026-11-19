import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import {
  runWith,
  type EngineData,
  type FigureResult,
  type MachineRow,
  type ReportRow,
  type TicketRow,
} from '../src/index.js';
import { COMPUTERS } from '../src/analytics/computers.js';
import { plantDayStart } from '../src/business-hours.js';
import { ENGINE_DATA } from './answer-key/fixture.js';
import { SHIFT_BACKLOG_EXPECTED as EXPECTED } from './shift-kpis-expected.js';

/**
 * The backlog (ticket 48, packet 48b): every breakdown ticket still open at the as-of plant date, aged in the
 * plant's own working hours to the start of the next plant day and bucketed. A support ticket, a PM job and a
 * general work request are not breakdowns (R4's kind test), and a closed or cancelled ticket is not open. The
 * fixture is purpose-built because the answer key holds no open ticket.
 */

const AS_OF = '2026-11-11';

interface BacklogTicket {
  id: string;
  ref: string;
  machineCode: string | null;
  status: TicketRow['status'];
  reportedAt: string;
  workingHours: number | null;
}

interface BacklogValue {
  screen: string;
  asOf: string;
  backlog: {
    count: number;
    oldestWorkingHours: number | null;
    under4: number | null;
    to24: number | null;
    to72: number | null;
    over72: number | null;
    tickets: BacklogTicket[];
  };
  pages: Array<{
    page: string;
    title: string;
    kpis: Array<{ label: string; value: string; sub: string | null }>;
    tables: Array<{ title: string; header: string[]; rows: string[][]; rowCount: number }>;
    charts: unknown[];
  }>;
}

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

function ticket(
  id: string,
  status: TicketRow['status'],
  reportedAt: string,
  rest: { kind?: TicketRow['kind']; source?: TicketRow['source'] } = {},
): TicketRow {
  return {
    id,
    ref: id.toUpperCase(),
    kind: rest.kind ?? 'stopped',
    status,
    machineId: 'm1',
    reportedAt,
    closedAt: status === 'closed' ? reportedAt : null,
    source: rest.source ?? 'live',
    downtimeMin: 0,
    repairMin: null,
    workType: null,
  };
}

const report = (id: string, ticketId: string, code: string): ReportRow => ({
  id,
  ticketId,
  machineId: 'm1',
  date: '2026-11-08',
  shift: '1',
  problem: 'x',
  downtimeMin: 60,
  responseMin: null,
  repairMin: null,
  category: null,
  maintCode: code,
  spareUsed: null,
  rootCause: null,
  doneBy: [],
  supportedBy: [],
});

function backlogData(tickets: TicketRow[], reports: ReportRow[] = []): EngineData {
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

/**
 * The plan's three open tickets and the six that must stay out: a closed live ticket, a cancelled one, a closed
 * history row (the old log is closed, and this figure counts tickets, never reports), a PM job, an open support
 * ticket and an open general work request.
 */
function fixture(): EngineData {
  return backlogData(
    [
      ticket('t1', 'open', '2026-11-10T11:30:00.000Z'), // 17:00 on 10 November in the plant
      ticket('t2', 'working', '2026-11-11T03:30:00.000Z'), // 09:00 on 11 November
      ticket('t3', 'waiting', '2026-11-09T14:30:00.000Z'), // 20:00 on 9 November
      ticket('c1', 'closed', '2026-11-08T03:30:00.000Z'),
      ticket('x1', 'cancelled', '2026-11-08T03:30:00.000Z'),
      ticket('h1', 'closed', '2026-11-08T03:30:00.000Z', { source: 'history' }),
      ticket('p1', 'open', '2026-11-08T03:30:00.000Z', { kind: 'general' }),
      ticket('s1', 'open', '2026-11-08T03:30:00.000Z', { kind: 'support' }),
      ticket('g1', 'open', '2026-11-08T03:30:00.000Z', { kind: 'general' }),
    ],
    [report('r1', 'h1', 'E'), report('r2', 'p1', 'PM')],
  );
}

function figureOf(data: EngineData, asOf = AS_OF, key = 'shift-kpis.backlog'): FigureResult {
  const compute = COMPUTERS[key];
  if (compute === undefined) throw new Error(`the engine knows no figure ${key}`);
  const result = runWith({ [key]: compute }, { data, asOf, profile: DEFAULT_PROFILE });
  const found = result.figures.find((candidate) => candidate.key === key);
  if (!found) throw new Error(`the engine knows no figure ${key}`);
  return found;
}

function valueOf(data: EngineData, asOf = AS_OF): BacklogValue {
  const computed = figureOf(data, asOf);
  if (computed.status !== 'ready') throw new Error(`shift-kpis.backlog is ${computed.status}`);
  return computed.value as unknown as BacklogValue;
}

const kpiOf = (value: BacklogValue, label: string) => {
  const found = value.pages[0]!.kpis.find((kpi) => kpi.label === label);
  if (found === undefined) throw new Error(`the backlog holds no KPI "${label}"`);
  return found;
};

describe('the plant day', () => {
  it('starts at local midnight in the plant’s own zone, not at UTC midnight', () => {
    expect(plantDayStart('2026-11-12', 'Asia/Kolkata').toISOString()).toBe(
      '2026-11-11T18:30:00.000Z',
    );
    expect(plantDayStart('2026-11-12', 'UTC').toISOString()).toBe('2026-11-12T00:00:00.000Z');
    // A daylight-saving plant: 8 March 2026 starts on EST, 9 March on EDT.
    expect(plantDayStart('2026-03-08', 'America/New_York').toISOString()).toBe(
      '2026-03-08T05:00:00.000Z',
    );
    expect(plantDayStart('2026-03-09', 'America/New_York').toISOString()).toBe(
      '2026-03-09T04:00:00.000Z',
    );
  });
});

describe('the backlog figure', () => {
  it('counts the three open breakdowns and ages them in working hours, oldest first', () => {
    const value = valueOf(fixture());
    expect({ screen: value.screen, asOf: value.asOf }).toEqual({
      screen: 'shift-kpis',
      asOf: AS_OF,
    });
    const { backlog } = value;
    expect(backlog.count).toBe(EXPECTED.count);
    expect(backlog.oldestWorkingHours!).toBeCloseTo(EXPECTED.oldestWorkingHours, 10);
    expect(backlog.tickets.map((row) => row.ref)).toEqual(['T3', 'T1', 'T2']);
    expect(backlog.tickets.map((row) => row.id)).toEqual([...EXPECTED.order]);
    expect(backlog.tickets.map((row) => row.workingHours)).toEqual([
      expect.closeTo(EXPECTED.t3, 10),
      expect.closeTo(EXPECTED.t1, 10),
      expect.closeTo(EXPECTED.t2, 10),
    ]);
    expect(value.pages[0]!.tables[0]!.header).toEqual([
      'Ticket',
      'Machine',
      'Status',
      'Reported',
      'Age (working hours)',
    ]);
    expect(value.pages[0]!.tables[0]!.rows).toEqual([
      ['T3', 'm1', 'waiting', '09-11-2026', '36.0'],
      ['T1', 'm1', 'open', '10-11-2026', '23.0'],
      ['T2', 'm1', 'working', '11-11-2026', '15.0'],
    ]);
  });

  it('buckets the ages as 0 / 2 / 1 / 0, printed on the page', () => {
    const value = valueOf(fixture());
    expect({
      under4: value.backlog.under4,
      to24: value.backlog.to24,
      to72: value.backlog.to72,
      over72: value.backlog.over72,
    }).toEqual(EXPECTED.buckets);
    expect(kpiOf(value, 'Open Breakdowns').value).toBe(String(EXPECTED.count));
    expect(kpiOf(value, 'Oldest').value).toBe('36.0');
    expect(
      ['Under 4 h', '4 to 24 h', '24 to 72 h', 'Over 72 h'].map(
        (label) => kpiOf(value, label).value,
      ),
    ).toEqual(['0', '2', '1', '0']);
  });

  it('drills the open tickets, oldest first, and never the excluded ones', () => {
    const computed = COMPUTERS['shift-kpis.backlog']!({
      data: fixture(),
      asOf: AS_OF,
      profile: DEFAULT_PROFILE,
    });
    expect(computed.drillIds).toEqual([...EXPECTED.order]);
    // The engine returns the drill's ids sorted, so the figure names the same three without their order.
    const result = figureOf(fixture());
    expect([...result.drill.ids].sort()).toEqual([...EXPECTED.order].sort());
    for (const excluded of ['c1', 'x1', 'h1', 'p1', 's1', 'g1'])
      expect(result.drill.ids).not.toContain(excluded);
  });

  it('leaves out a closed ticket, a cancelled one, a history row, a PM job, support and general work', () => {
    const { backlog } = valueOf(fixture());
    const named = new Set(backlog.tickets.map((row) => row.id));
    for (const excluded of ['c1', 'x1', 'h1', 'p1', 's1', 'g1']) {
      expect(named.has(excluded), excluded).toBe(false);
    }
    expect(backlog.tickets.every((row) => row.status !== 'closed')).toBe(true);
  });

  it('ages a ticket reported at 23:59 as under one working hour, and never negative', () => {
    const late = backlogData([ticket('late', 'open', '2026-11-11T18:29:00.000Z')]);
    const { backlog } = valueOf(late);
    expect(backlog.count).toBe(1);
    expect(backlog.tickets[0]!.workingHours!).toBeCloseTo(1 / 60, 10);
    expect(backlog.tickets[0]!.workingHours!).toBeGreaterThanOrEqual(0);
    expect(backlog.tickets[0]!.workingHours!).toBeLessThan(1);
    expect(backlog.under4).toBe(1);
  });

  it('covers Saturday and Sunday: the plant has no holiday calendar', () => {
    const weekend = backlogData([ticket('sat', 'open', '2026-11-14T02:30:00.000Z')]);
    // Reported 08:00 on Saturday 14 November; as of Sunday the 15th, the window ends at Monday midnight.
    const { backlog } = valueOf(weekend, '2026-11-15');
    expect(backlog.tickets[0]!.workingHours!).toBeCloseTo((960 + 960) / 60, 10);
    expect(backlog.to24).toBe(0);
    expect(backlog.to72).toBe(1);
  });

  it('prints dashes, not a zero, when the plant has no shift window to age by', () => {
    const value = valueOf({
      ...backlogData([ticket('o1', 'open', '2026-11-10T11:30:00.000Z')]),
      shifts: [],
    });
    expect(value.backlog.count).toBe(1);
    expect(value.backlog.oldestWorkingHours).toBeNull();
    expect(value.backlog.tickets[0]!.workingHours).toBeNull();
    expect([
      value.backlog.under4,
      value.backlog.to24,
      value.backlog.to72,
      value.backlog.over72,
    ]).toEqual([null, null, null, null]);
    expect(kpiOf(value, 'No shift windows in Settings').value).toBe('—');
    expect(value.pages[0]!.tables[0]!.rows[0]![4]).toBe('—');
  });

  it('prints nothing when no breakdown is open, the house rule for a figure with no rows', () => {
    const empty = figureOf(backlogData([ticket('c1', 'closed', '2026-11-08T03:30:00.000Z')]));
    expect(empty.status).toBe('ready');
    expect(empty.value).toBeNull();
    expect(empty.drill.ids).toEqual([]);
    expect(figureOf(backlogData([])).value).toBeNull();
  });
});
