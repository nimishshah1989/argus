import type { EngineData, MachineRow, MoveRow, ReportRow, TicketRow } from '../../src/index.js';

/**
 * The small second fixture of ticket 76 (packet 76x): a no-records month inside the latest 180 days, which the
 * two-year fixture does not have (its gap is July 2025, nearly a year before its last record). Its hand values are
 * in `gap-tail.test.ts`; no real data, coded machines only.
 *
 * - Machines A-1 and A-2 (CNC, Turning Center, production), both bought 2020-01-01, A-1 in cell 1 all year.
 * - A-2 starts in cell 1 and moves to cell 2 on 2026-06-16.
 * - 2026, every month but October: each machine has one `AX` breakdown on day 10 (shift 1), 60 minutes, a closed
 *   history ticket and its report. October holds no report and no ticket. The last record is 10 December.
 */

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12];
const pad = (value: number): string => String(value).padStart(2, '0');

function machine(id: string, cell: string): MachineRow {
  return {
    id,
    code: id,
    segment: 'CNC',
    category: 'Turning Center',
    cell,
    location: null,
    make: null,
    model: null,
    controller: null,
    year: 2020,
    purchasedOn: '2020-01-01',
    powerKw: null,
    capacityKva: null,
    assetCode: null,
    status: 'active',
    criticality: null,
    excludedFromProduction: false,
    metadata: {},
  };
}

function rowsOf(machineId: string, month: number): [TicketRow, ReportRow] {
  const date = `2026-${pad(month)}-10`;
  const id = `${machineId}-${date}`;
  const start = new Date(`${date}T08:00:00+05:30`);
  const ticket: TicketRow = {
    id: `T-${id}`,
    ref: `T-${id}`,
    kind: 'stopped',
    status: 'closed',
    machineId,
    reportedAt: start.toISOString(),
    closedAt: new Date(start.getTime() + 60 * 60_000).toISOString(),
    source: 'history',
    downtimeMin: 60,
    repairMin: null,
    workType: 'AX',
  };
  const report: ReportRow = {
    id: `R-${id}`,
    ticketId: ticket.id,
    machineId,
    date,
    shift: '1',
    problem: 'Axis jam',
    downtimeMin: 60,
    responseMin: null,
    repairMin: null,
    category: 'M',
    maintCode: 'AX',
    spareUsed: null,
    rootCause: null,
    doneBy: ['P-1'],
    supportedBy: [],
  };
  return [ticket, report];
}

const MACHINES: MachineRow[] = [machine('A-1', '1'), machine('A-2', '2')];
const MOVES: MoveRow[] = [
  { id: 'M-1', machineId: 'A-2', fromCell: '1', toCell: '2', effectiveFrom: '2026-06-16' },
];

function build(): EngineData {
  const pairs = MACHINES.flatMap((owner) => MONTHS.map((month) => rowsOf(owner.id, month)));
  return {
    timeZone: 'Asia/Kolkata',
    machines: MACHINES,
    moves: MOVES,
    tickets: pairs.map(([ticket]) => ticket),
    tasks: [],
    reports: pairs.map(([, report]) => report),
    people: [
      { id: 'P-1', code: 'P-1', displayName: 'Person 1', team: 'maintenance', active: true },
    ],
    lists: {},
    shifts: [
      {
        code: '1',
        name: '1',
        startMinute: 8 * 60,
        endMinute: 18 * 60 + 29,
        crossesMidnight: false,
        active: true,
      },
    ],
  };
}

export const GAP_TAIL: EngineData = build();
export const GAP_TAIL_ASOF = '2026-12-31';
export const GAP_TAIL_SPAN = { from: '2026-01-01', to: '2026-12-31' };
