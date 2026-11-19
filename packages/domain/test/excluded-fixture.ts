import type { EngineData, MachineRow, ReportRow, TicketRow } from '../src/index.js';

/**
 * A ten-machine plant worked out by hand for ticket 77a. Five machines (K-1 to K-5) are counted in production data and
 * five (X-1 to X-5) are left out of it. The run date is 2026-03-31, so each machine is available for a quarter of the
 * plant's 6,000 annual hours (20 hours a day over 300 days): 1,500 hours a machine. Every code is invented.
 *
 * Breakdown hours, by machine. Counted: K-1 10 and 20 (two breakdowns), K-2 30, K-3 10 = 4 breakdowns, 70 hours.
 * Left out: X-1 40 and 40, X-2 50, X-3 20 = 4 breakdowns, 150 hours. PM: K-1 5 hours, X-1 10 hours.
 */

export const AS_OF = '2026-03-31';
export const COUNTED = ['K-1', 'K-2', 'K-3', 'K-4', 'K-5'] as const;
export const LEFT_OUT = ['X-1', 'X-2', 'X-3', 'X-4', 'X-5'] as const;

const machine = (code: string, excluded: boolean): MachineRow => ({
  id: code,
  code,
  segment: 'CNC',
  category: 'Turning Center',
  cell: 'Cell 1',
  location: 'Shop 1',
  make: null,
  model: null,
  controller: null,
  year: null,
  purchasedOn: null,
  powerKw: 10,
  capacityKva: 10,
  assetCode: null,
  status: 'active',
  criticality: 'B',
  excludedFromProduction: excluded,
  metadata: {},
});

/** One closed breakdown or PM entry: [machine, day, hours, who did it, PM?]. */
type Entry = readonly [string, string, number, string, boolean?];

const ENTRIES: readonly Entry[] = [
  ['K-1', '2026-01-10', 10, 'P-A'],
  ['K-1', '2026-02-10', 20, 'P-A'],
  ['K-2', '2026-01-15', 30, 'P-B'],
  ['K-3', '2026-03-05', 10, 'P-B'],
  ['K-1', '2026-03-01', 5, 'P-A', true],
  ['X-1', '2026-01-12', 40, 'P-A'],
  ['X-1', '2026-02-12', 40, 'P-B'],
  ['X-2', '2026-02-20', 50, 'P-B'],
  ['X-3', '2026-03-10', 20, 'P-A'],
  ['X-1', '2026-03-02', 10, 'P-A', true],
];

function ticket(index: number, entry: Entry): TicketRow {
  const [machineId, day, hours] = entry;
  const closed = new Date(Date.parse(`${day}T04:00:00.000Z`) + hours * 3_600_000);
  return {
    id: `t${index}`,
    ref: `BD-${index}`,
    kind: 'stopped',
    status: 'closed',
    machineId,
    reportedAt: `${day}T04:00:00.000Z`,
    closedAt: closed.toISOString(),
    source: 'history',
    downtimeMin: hours * 60,
    repairMin: hours * 60,
    workType: null,
  };
}

function report(index: number, entry: Entry): ReportRow {
  const [machineId, day, hours, doneBy, pm] = entry;
  return {
    id: `t${index}`,
    ticketId: `t${index}`,
    machineId,
    date: day,
    shift: 'A',
    problem: 'Spindle noise',
    downtimeMin: hours * 60,
    responseMin: null,
    repairMin: hours * 60,
    category: null,
    maintCode: pm ? 'PM' : 'MECH',
    spareUsed: null,
    rootCause: null,
    doneBy: [doneBy],
    supportedBy: [],
    recordedHours: hours,
  };
}

/**
 * The plant with the five left-out machines named in the settings only (`settings`), as the plant's own list, or also
 * flagged on their rows (`both`, how the server loads them), or not left out at all (`none`).
 */
export function plant(how: 'none' | 'settings' | 'both'): EngineData {
  const machines = [
    ...COUNTED.map((code) => machine(code, false)),
    ...LEFT_OUT.map((code) => machine(code, how === 'both')),
  ];
  return {
    timeZone: 'Asia/Kolkata',
    machines,
    moves: [],
    tickets: ENTRIES.map((entry, index) => ticket(index, entry)),
    tasks: [],
    reports: ENTRIES.map((entry, index) => report(index, entry)),
    people: ['P-A', 'P-B'].map((code) => ({
      id: code,
      code,
      displayName: `Person ${code}`,
      team: 'maintenance' as const,
      active: true,
    })),
    lists: {},
    settings: {
      excludedMachineIds: how === 'none' ? [] : [...LEFT_OUT],
      problemFixes: {},
      teamCodes: ['P-A', 'P-B'],
      cells: ['Cell 1'],
      locations: ['Shop 1'],
    },
  };
}
