import type {
  EngineData,
  MachineRow,
  PersonRow,
  ReportRow,
  ShiftRow,
  TicketRow,
} from '../../src/index.js';

/**
 * The two-year fixture of ticket 76 (packet 76b), built by one rule and no real data: coded machines and people only.
 * Its expected values are in `hand.ts`, worked out by hand from the rule below.
 *
 * - Machines (CNC, production): TC-1 and VC-1 in cell 1, TC-2 and VC-2 in cell 2. VC-2 is bought on 2026-01-01.
 * - 2025, every month but July: each machine that exists has `AX` on day 5 (shift 1) and `EL` on day 20 (shift 2),
 *   60 minutes each. July 2025 holds no report and no ticket.
 * - 2026, every month: `AX` on days 5 and 12 (shift 1) and `EL` on day 20 (shift 2), 120 minutes each.
 * - Both years: `NO DT` (30 minutes, shift 1) on 8 January, `PM` (180 minutes, shift 1) on day 15 of March, June,
 *   September and December. A PM ticket is raised through the `pm` channel and carries its scheduled day.
 * - Every row is one closed history ticket and its report. `doneBy` follows the code: `AX` and `NO DT` Person 1,
 *   `EL` and `PM` Person 2.
 */

type Code = 'AX' | 'EL' | 'NO DT' | 'PM';
interface Entry {
  code: Code;
  day: number;
  minutes: number;
}

const RECORDED_2025 = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12];
const RECORDED_2026 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const BREAKDOWNS: Record<number, readonly Entry[]> = {
  2025: [
    { code: 'AX', day: 5, minutes: 60 },
    { code: 'EL', day: 20, minutes: 60 },
  ],
  2026: [
    { code: 'AX', day: 5, minutes: 120 },
    { code: 'AX', day: 12, minutes: 120 },
    { code: 'EL', day: 20, minutes: 120 },
  ],
};

const KIND: Record<Code, { problem: string; shift: '1' | '2'; category: string; by: string }> = {
  AX: { problem: 'Axis jam', shift: '1', category: 'M', by: 'P-1' },
  EL: { problem: 'Panel trip', shift: '2', category: 'E', by: 'P-2' },
  'NO DT': { problem: 'Checked outside production', shift: '1', category: 'M', by: 'P-1' },
  PM: { problem: 'Planned service', shift: '1', category: 'PM', by: 'P-2' },
};

const SHIFT_START: Record<'1' | '2', string> = { '1': '08:00', '2': '18:29' };

const SHIFTS: ShiftRow[] = [
  {
    code: '1',
    name: '1',
    startMinute: 8 * 60,
    endMinute: 18 * 60 + 29,
    crossesMidnight: false,
    active: true,
  },
  {
    code: '2',
    name: '2',
    startMinute: 18 * 60 + 29,
    endMinute: 5 * 60,
    crossesMidnight: true,
    active: true,
  },
];

const PEOPLE: PersonRow[] = ['1', '2'].map((number) => ({
  id: `P-${number}`,
  code: `P-${number}`,
  displayName: `Person ${number}`,
  team: 'maintenance',
  active: true,
}));

function machine(id: string, category: string, cell: string, purchasedOn: string): MachineRow {
  return {
    id,
    code: id,
    segment: 'CNC',
    category,
    cell,
    location: null,
    make: null,
    model: null,
    controller: null,
    year: Number(purchasedOn.slice(0, 4)),
    purchasedOn,
    powerKw: null,
    capacityKva: null,
    assetCode: null,
    status: 'active',
    criticality: null,
    excludedFromProduction: false,
    metadata: {},
  };
}

const TURNING = 'Turning Center';
const VERTICAL = 'Vertical Machining Center';
const MACHINES: MachineRow[] = [
  machine('TC-1', TURNING, '1', '2020-01-01'),
  machine('VC-1', VERTICAL, '1', '2020-01-01'),
  machine('TC-2', TURNING, '2', '2020-01-01'),
  machine('VC-2', VERTICAL, '2', '2026-01-01'),
];

const pad = (value: number): string => String(value).padStart(2, '0');

/** The rows one month adds for one machine: its breakdowns, then `NO DT` in January and `PM` every third month. */
function monthEntries(year: number, month: number): Entry[] {
  return [
    ...BREAKDOWNS[year]!,
    ...(month === 1 ? [{ code: 'NO DT' as const, day: 8, minutes: 30 }] : []),
    ...(month % 3 === 0 ? [{ code: 'PM' as const, day: 15, minutes: 180 }] : []),
  ];
}

/** The ticket and the report of one entry. A plant instant is its date at the shift's start in Asia/Kolkata. */
function rowsOf(machineId: string, date: string, entry: Entry): [TicketRow, ReportRow] {
  const kind = KIND[entry.code];
  const id = `${machineId}-${date}-${entry.code.replace(' ', '')}`;
  const start = new Date(`${date}T${SHIFT_START[kind.shift]}:00+05:30`);
  const closed = new Date(start.getTime() + entry.minutes * 60_000);
  const planned = entry.code === 'PM' ? { raisedChannel: 'pm', scheduledOn: date } : {};
  const ticket: TicketRow = {
    id: `T-${id}`,
    ref: `T-${id}`,
    kind: 'stopped',
    status: 'closed',
    machineId,
    reportedAt: start.toISOString(),
    closedAt: closed.toISOString(),
    source: 'history',
    downtimeMin: entry.minutes,
    repairMin: null,
    workType: entry.code,
    ...planned,
  };
  const report: ReportRow = {
    id: `R-${id}`,
    ticketId: ticket.id,
    machineId,
    date,
    shift: kind.shift,
    problem: kind.problem,
    downtimeMin: entry.minutes,
    responseMin: null,
    repairMin: null,
    category: kind.category,
    maintCode: entry.code,
    spareUsed: null,
    rootCause: null,
    doneBy: [kind.by],
    supportedBy: [],
  };
  return [ticket, report];
}

function build(): EngineData {
  const tickets: TicketRow[] = [];
  const reports: ReportRow[] = [];
  const years: Array<[number, readonly number[]]> = [
    [2025, RECORDED_2025],
    [2026, RECORDED_2026],
  ];
  for (const [year, months] of years) {
    for (const month of months) {
      for (const owner of MACHINES.filter((m) => m.purchasedOn!.slice(0, 4) <= String(year))) {
        for (const entry of monthEntries(year, month)) {
          const [ticket, report] = rowsOf(
            owner.id,
            `${year}-${pad(month)}-${pad(entry.day)}`,
            entry,
          );
          tickets.push(ticket);
          reports.push(report);
        }
      }
    }
  }
  return {
    timeZone: 'Asia/Kolkata',
    machines: MACHINES,
    moves: [],
    tickets,
    tasks: [],
    reports,
    people: PEOPLE,
    lists: {},
    shifts: SHIFTS,
  };
}

export const MANY_YEARS: EngineData = build();
