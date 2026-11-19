import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { run } from '../src/analytics/engine.js';
import type { EngineData, MachineRow, PersonRow, ReportRow, TicketRow } from '../src/index.js';

/**
 * Ticket 75, packet 75e: one full run on a 10,000-row plant. The plant is invented from one seeded rule (150
 * machines, 40 coded people, 10,000 closed history tickets and their reports, January 2022 to October 2026, many
 * different problem texts), so the same rows come out every time. The goal is a whole run in 20 seconds or less
 * (it was 30 s at 13,500 rows); the run here takes a few seconds, so the limit only fails a real regression.
 */

const MACHINES = 150;
const ROWS = 10_000;
const LIMIT_MS = 20_000;

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

function plant(): EngineData {
  const fleet = machines();
  const team = people();
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
  return {
    timeZone: 'Asia/Kolkata',
    machines: fleet,
    moves: [],
    tickets,
    tasks: [],
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

describe('a full run on a 10,000-row plant', () => {
  it('finishes in 20 seconds or less and computes every figure it has a computer for', () => {
    const data = plant();
    const started = performance.now();
    const result = run(data, '2026-11-11', DEFAULT_PROFILE);
    const took = performance.now() - started;
    expect(result.rows.reports).toBe(ROWS);
    expect(result.figures.filter((figure) => figure.status === 'ready').length).toBeGreaterThan(40);
    expect(took).toBeLessThanOrEqual(LIMIT_MS);
  }, 60_000);
});
