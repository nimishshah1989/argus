import type {
  EngineData,
  MachineRow,
  PersonRow,
  ReportRow,
  TaskRow,
  TicketRow,
} from '../src/index.js';

/**
 * Ticket 75, packet 75e: one full run on a 10,000-row plant (shared with the timing in `engine-scale.test.ts`). The plant is invented from one seeded rule (150
 * machines, 40 coded people, 10,000 closed history tickets and their reports, January 2022 to October 2026, many
 * different problem texts, 1,500 follow-up jobs, 300 open tickets, 300 machine moves and a PM plan per machine), so the same rows come out every time. The goal is a whole run in 20 seconds or less
 * (it was 30 s at 13,500 rows); the run here takes a few seconds, so the limit only fails a real regression.
 */

const MACHINES = 150;
const ROWS = 10_000;

let seed = 12_345;
const random = (): number => {
  seed = (seed * 1_103_515_245 + 12_345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)]!;
const pad = (value: number): string => String(value).padStart(2, '0');

const PROBLEMS = [
  'Axis jam',
  'Panel trip',
  'Oil leak',
  'Spindle noise',
  'Tool clamp fail',
  'Coolant pump',
  'Encoder fault',
  'Door interlock',
  'Hydraulic low',
  'Belt slip',
];
const PLACES = [
  'on axis',
  'at spindle',
  'in panel',
  'near door',
  'at pump',
  'on tool',
  'in coolant',
];
const SPARES = [
  'Bearing 6204',
  'Belt B52',
  'Fuse 10A',
  'Seal kit',
  'Relay 24V',
  'Encoder',
  'Filter',
];
const CODES = ['AX', 'EL', 'ME', 'HY', 'PM', 'NO DT'];

function machines(): MachineRow[] {
  const categories = ['Turning Center', 'Vertical Machining Center', 'Press', 'Grinder', 'Robot'];
  return Array.from({ length: MACHINES }, (_, index) => ({
    id: `M-${index}`,
    code: `M-${index}`,
    segment: index % 3 === 0 ? 'PRESS' : 'CNC',
    category: categories[index % categories.length]!,
    cell: String(1 + (index % 12)),
    location: null,
    make: pick(['Alpha', 'Beta', 'Gamma']),
    model: `Mod${index % 9}`,
    controller: null,
    year: 2018 + (index % 6),
    purchasedOn: `${2018 + (index % 6)}-0${1 + (index % 9)}-01`,
    powerKw: 10,
    capacityKva: 20,
    assetCode: null,
    status: 'active' as const,
    criticality: pick(['A', 'B', 'C', null] as const),
    excludedFromProduction: index % 40 === 0,
    metadata: {},
  }));
}

function people(): PersonRow[] {
  return Array.from({ length: 40 }, (_, index) => ({
    id: `P-${index}`,
    code: `P-${index}`,
    displayName: `Person ${index}`,
    team: 'maintenance' as const,
    active: true,
  }));
}

/** The closed history tickets and their reports, `ROWS` of them. */
function closedRows(
  fleet: readonly MachineRow[],
  team: readonly PersonRow[],
): { tickets: TicketRow[]; reports: ReportRow[] } {
  const tickets: TicketRow[] = [];
  const reports: ReportRow[] = [];
  while (tickets.length < ROWS) {
    const machine = fleet[Math.floor(random() * fleet.length)]!;
    const year = 2022 + Math.floor(random() * 5);
    const month = 1 + Math.floor(random() * (year === 2026 ? 10 : 12));
    const date = `${year}-${pad(month)}-${pad(1 + Math.floor(random() * 27))}`;
    if (date < machine.purchasedOn!) continue;
    const n = tickets.length;
    const code = pick(CODES);
    const minutes = 20 + Math.floor(random() * 400);
    const shift = pick(['1', '2']);
    const start = new Date(`${date}T${shift === '1' ? '08:00' : '18:29'}:00+05:30`);
    const ticket: TicketRow = {
      id: `T-${n}`,
      ref: `T-${n}`,
      kind: 'stopped',
      status: 'closed',
      machineId: machine.id,
      reportedAt: start.toISOString(),
      closedAt: new Date(start.getTime() + minutes * 60_000).toISOString(),
      source: 'history',
      downtimeMin: minutes,
      repairMin: null,
      workType: code,
      ...(code === 'PM' ? { raisedChannel: 'pm', scheduledOn: date } : {}),
    };
    tickets.push(ticket);
    reports.push({
      id: `R-${n}`,
      ticketId: ticket.id,
      machineId: machine.id,
      date,
      shift,
      problem: `${pick(PROBLEMS)} ${pick(PLACES)} ${pick(['X', 'Y', 'Z', 'A', 'B'])}${Math.floor(random() * 60)}`,
      downtimeMin: minutes,
      responseMin: 5 + Math.floor(random() * 30),
      repairMin: Math.floor(minutes * 0.7),
      category: code === 'PM' ? 'PM' : pick(['M', 'E', 'H']),
      maintCode: code,
      spareUsed: random() < 0.5 ? pick(SPARES) : null,
      rootCause:
        random() < 0.5
          ? `${pick(['Wear', 'Loose', 'Dust', 'Overload'])} ${Math.floor(random() * 20)}`
          : null,
      doneBy: [pick(team).id],
      supportedBy: random() < 0.3 ? [pick(team).id] : [],
    });
  }
  return { tickets, reports };
}

/** The follow-up jobs, open tickets, moves and PM plans the real loader also hands the engine. */
function extras(fleet: readonly MachineRow[], tickets: readonly TicketRow[]) {
  const tasks: TaskRow[] = tickets.slice(0, 1500).map((ticket, index) => ({
    ...ticket,
    id: `K-${index}`,
    ref: `K-${index}`,
    parentId: ticket.id,
    reason: 'follow-up',
    expectedOn: '2026-10-01',
    status: index % 3 === 0 ? 'open' : 'closed',
    closedAt: index % 3 === 0 ? null : ticket.closedAt,
  }));
  const open: TicketRow[] = Array.from({ length: 300 }, (_, index) => ({
    ...tickets[index]!,
    id: `O-${index}`,
    ref: `O-${index}`,
    status: pick(['open', 'working', 'waiting'] as const),
    closedAt: null,
    source: 'live' as const,
    reportedAt: new Date(Date.UTC(2026, 9, 1 + (index % 40))).toISOString(),
  }));
  const moves = Array.from({ length: 300 }, (_, index) => ({
    id: `V-${index}`,
    machineId: fleet[index % fleet.length]!.id,
    fromCell: '1',
    toCell: '2',
    effectiveFrom: `202${3 + (index % 3)}-0${1 + (index % 9)}-15`,
  }));
  const pmPlans = fleet.map((machine, index) => ({
    id: `PL-${index}`,
    machineId: machine.id,
    category: null,
    intervalDays: 30 + (index % 5) * 30,
    createdAt: '2022-01-01T00:00:00Z',
    lastDoneOn: '2026-09-01',
    active: true,
    updatedAt: '2026-01-01T00:00:00Z',
  }));
  return { tasks, open, moves, pmPlans };
}

export function scalePlant(): EngineData {
  seed = 12_345;
  const fleet = machines();
  const team = people();
  const { tickets, reports } = closedRows(fleet, team);
  const { tasks, open, moves, pmPlans } = extras(fleet, tickets);
  return {
    timeZone: 'Asia/Kolkata',
    machines: fleet,
    moves,
    tickets: [...tickets, ...open],
    tasks,
    pmPlans,
    reports,
    people: team,
    lists: {},
    shifts: [
      {
        code: '1',
        name: '1',
        startMinute: 480,
        endMinute: 1109,
        crossesMidnight: false,
        active: true,
      },
      {
        code: '2',
        name: '2',
        startMinute: 1109,
        endMinute: 300,
        crossesMidnight: true,
        active: true,
      },
    ],
  };
}
