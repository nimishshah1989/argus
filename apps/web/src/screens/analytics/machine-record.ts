import type { MessageKey } from '@uptimo/shared/i18n';
import { cellMoves, type CellMove } from './machine-values.js';
import { bag, num, pickNum, pickText, text, texts, type Bag } from './read-value.js';

/**
 * One machine's page from the engine's `machine-page` value. Every reader is total: a missing length, width or
 * purchase date stays null so the screen can say "Not available"; it is never turned into a zero or a guess.
 */

export interface MachineFacts {
  id: string;
  code: string;
  segment: string | null;
  category: string | null;
  make: string | null;
  model: string | null;
  serial: string | null;
  controller: string | null;
  controllerModel: string | null;
  controllerSerial: string | null;
  year: number | null;
  purchasedOn: string | null;
  powerKva: number | null;
  capacityKva: number | null;
  location: string | null;
  cell: string | null;
  assetCode: string | null;
  conveyor: string | null;
  lengthMm: number | null;
  widthMm: number | null;
}

export interface BreakdownSummary {
  count: number | null;
  hours: number | null;
  mttr: number | null;
  mtbf: number | null;
  lastOn: string | null;
  topProblem: { problem: string; count: number | null } | null;
}

export interface PmSummary {
  visits: number | null;
  hours: number | null;
}

/** The field codes the completeness record names; the screen maps each to a catalogue label. */
export const MACHINE_FIELD_LABELS: Readonly<Record<string, MessageKey>> = {
  make: 'analytics.machine.field.make',
  model: 'analytics.machine.field.model',
  serial: 'analytics.machine.field.serial',
  controller: 'analytics.machine.field.controller',
  year: 'analytics.machine.field.year',
  purchasedOn: 'analytics.machine.field.purchasedOn',
  powerKva: 'analytics.machine.field.powerKva',
  lengthMm: 'analytics.machine.field.lengthMm',
  widthMm: 'analytics.machine.field.widthMm',
  assetCode: 'analytics.machine.field.assetCode',
  cell: 'analytics.machine.field.cell',
  location: 'analytics.machine.field.location',
};

export interface Completeness {
  recorded: number;
  of: number;
  missing: string[];
}

export interface MachineDrills {
  breakdowns: string[];
  pm: string[];
  moves: string[];
}

export interface MachineRecord {
  machine: MachineFacts;
  /** The engine's own age where it gave one; null means "work it out from the purchase record". */
  ageYears: number | null;
  ageEstimated: boolean;
  floorAreaM2: number | null;
  efficiencyPct: number | null;
  connectedKva: number | null;
  runningKva: number | null;
  breakdowns: BreakdownSummary | null;
  pm: PmSummary | null;
  completeness: Completeness | null;
  moves: CellMove[];
  drills: MachineDrills;
}

function parseFacts(raw: unknown, id: string): MachineFacts {
  const machine = bag(raw) ?? {};
  return {
    id,
    code: pickText(machine, 'code', 'id') ?? id,
    segment: pickText(machine, 'segment'),
    category: pickText(machine, 'category'),
    make: pickText(machine, 'make'),
    model: pickText(machine, 'model'),
    serial: pickText(machine, 'serial'),
    controller: pickText(machine, 'controller'),
    controllerModel: pickText(machine, 'controllerModel', 'ctrlModel'),
    controllerSerial: pickText(machine, 'controllerSerial', 'ctrlSerial'),
    year: pickNum(machine, 'year'),
    purchasedOn: pickText(machine, 'purchasedOn', 'datePurchase'),
    powerKva: pickNum(machine, 'powerKva', 'power'),
    capacityKva: pickNum(machine, 'capacityKva', 'capacity'),
    location: pickText(machine, 'location'),
    cell: pickText(machine, 'cell'),
    assetCode: pickText(machine, 'assetCode'),
    conveyor: pickText(machine, 'conveyor'),
    lengthMm: pickNum(machine, 'lengthMm', 'length'),
    widthMm: pickNum(machine, 'widthMm', 'width'),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** L × W in mm to m²; null unless both are recorded as real sizes (zero is a gap, not a size). */
export function areaFrom(machine: MachineFacts): number | null {
  if (machine.lengthMm === null || machine.widthMm === null) return null;
  if (machine.lengthMm <= 0 || machine.widthMm <= 0) return null;
  return round2((machine.lengthMm * machine.widthMm) / 1_000_000);
}

/** Running load from the connected load and the efficiency factor; null when either is missing. */
export function runningFrom(connected: number | null, efficiencyPct: number | null): number | null {
  if (connected === null || efficiencyPct === null) return null;
  return round2((connected * efficiencyPct) / 100);
}

/** The engine's most frequent problem, read as its record; anything that is not a named problem is null. */
function parseTopProblem(raw: unknown): BreakdownSummary['topProblem'] {
  const found = bag(raw);
  if (!found) return null;
  const problem = text(found.problem);
  return problem === null ? null : { problem, count: num(found.count) };
}

function parseBreakdowns(raw: unknown): BreakdownSummary | null {
  const countFromNumber = num(raw);
  if (countFromNumber !== null)
    return {
      count: countFromNumber,
      hours: null,
      mttr: null,
      mtbf: null,
      lastOn: null,
      topProblem: null,
    };
  const summary = bag(raw);
  const count = summary ? num(summary.count) : null;
  if (!summary || count === null) return null;
  return {
    count,
    hours: num(summary.hours),
    mttr: num(summary.mttr),
    mtbf: num(summary.mtbf),
    lastOn: pickText(summary, 'lastOn', 'lastBreakdown'),
    topProblem: parseTopProblem(summary.topProblem),
  };
}

function parsePm(raw: unknown): PmSummary | null {
  const pm = bag(raw);
  if (!pm) return null;
  const visits = num(pm.visits);
  const hours = num(pm.hours);
  return visits === null && hours === null ? null : { visits, hours };
}

function parseCompleteness(raw: unknown): Completeness | null {
  const complete = bag(raw);
  if (!complete) return null;
  const recorded = num(complete.recorded);
  const of = num(complete.of);
  if (recorded === null || of === null || of <= 0) return null;
  return { recorded, of, missing: texts(complete.missing) };
}

function parseDrills(raw: unknown, moves: readonly CellMove[]): MachineDrills {
  const drill = bag(raw) ?? {};
  const read = (key: string): string[] => texts(drill[key]);
  const moveIds = read('moves');
  return {
    breakdowns: read('breakdowns'),
    pm: read('pm'),
    moves: moveIds.length > 0 ? moveIds : moves.map((move) => move.id),
  };
}

/** The size and load figures, computed only from what the record actually holds. */
function figuresOf(entry: Bag, extra: Bag, machine: MachineFacts) {
  const efficiencyPct = num(entry.efficiencyPct) ?? num(extra.efficiencyPct);
  const connectedKva = num(entry.connectedKva) ?? machine.powerKva;
  return {
    efficiencyPct,
    connectedKva,
    runningKva: num(entry.runningKva) ?? runningFrom(connectedKva, efficiencyPct),
    floorAreaM2: num(entry.floorAreaM2) ?? areaFrom(machine),
  };
}

function ageFields(entry: Bag) {
  const age = bag(entry.age);
  return {
    ageYears: num(entry.ageYears) ?? num(age?.years),
    ageEstimated: entry.ageEstimated === true || age?.estimated === true,
  };
}

function parseRecord(entry: Bag, id: string): MachineRecord {
  const extra = bag(entry.extra) ?? {};
  const machine = parseFacts(bag(entry.machine) ?? bag(extra.machine) ?? entry, id);
  const moves = cellMoves(entry.moves);
  return {
    machine,
    ...ageFields(entry),
    ...figuresOf(entry, extra, machine),
    breakdowns: parseBreakdowns(entry.breakdowns ?? extra.breakdowns),
    pm: parsePm(entry.pm),
    completeness: parseCompleteness(entry.completeness),
    moves,
    // `extra.breakdowns` is only the count; a raw key-shaped record has no ticket ids to drill to.
    drills: parseDrills(entry.drill ?? entry.drills, moves),
  };
}

/**
 * One machine's page from a ready `machine-page` value. `{ byMachine: { [uuid]: record } }` is the 39b shape;
 * a bare record or the answer key's `{ pages, extra }` for one machine is accepted too. Null when the value
 * holds no record for this id — the screen then says so instead of inventing one.
 */
export function machineRecord(value: unknown, id: string): MachineRecord | null {
  const root = bag(value);
  if (!root) return null;
  const map = bag(root.byMachine) ?? bag(root.machines);
  if (map) {
    const entry = bag(map[id]);
    return entry ? parseRecord(entry, id) : null;
  }
  const direct = bag(root[id]);
  if (direct) return parseRecord(direct, id);
  // The answer key's bare `{ pages, extra }`: only a value that actually carries a machine is a record.
  const looksLikeMachine =
    bag(root.machine) !== null ||
    bag(root.extra) !== null ||
    pickText(root, 'code') !== null ||
    pickText(root, 'category') !== null;
  return looksLikeMachine ? parseRecord(root, id) : null;
}

/**
 * The id a machine's record is kept under, from what a link carries: the id itself, or the machine's code (the v2
 * chips and drawers name a machine by its code). An id or code the value does not hold comes back as it was asked.
 */
export function machineIdOf(value: unknown, idOrCode: string): string {
  const map = bag(bag(value)?.byMachine) ?? bag(bag(value)?.machines);
  if (!map || bag(map[idOrCode])) return idOrCode;
  const found = Object.entries(map).find(([, entry]) => {
    const record = bag(entry);
    return pickText(bag(record?.machine) ?? record ?? {}, 'code') === idOrCode;
  });
  return found?.[0] ?? idOrCode;
}

/** Completed years from the purchase record to the plant day; a year-only machine says it is estimated. */
export function ageOf(
  machine: MachineFacts,
  asOf: string,
  given: number | null,
  estimated: boolean,
): { years: number; estimated: boolean } | null {
  if (given !== null) return { years: Math.max(0, Math.floor(given)), estimated };
  if (machine.purchasedOn !== null) {
    const bought = new Date(`${machine.purchasedOn}T00:00:00Z`);
    const at = new Date(`${asOf}T00:00:00Z`);
    if (!Number.isNaN(bought.getTime()) && !Number.isNaN(at.getTime())) {
      let years = at.getUTCFullYear() - bought.getUTCFullYear();
      const beforeAnniversary =
        at.getUTCMonth() < bought.getUTCMonth() ||
        (at.getUTCMonth() === bought.getUTCMonth() && at.getUTCDate() < bought.getUTCDate());
      if (beforeAnniversary) years -= 1;
      return { years: Math.max(0, years), estimated: false };
    }
  }
  if (machine.year !== null) {
    const atYear = Number(asOf.slice(0, 4));
    if (Number.isFinite(atYear))
      return { years: Math.max(0, atYear - machine.year), estimated: true };
  }
  return null;
}
