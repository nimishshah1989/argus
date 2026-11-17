import type { AnalyticsProfile } from '@uptimo/shared';
import { metadataNumber, roundValue } from './format.js';
import { machineAge } from './machine-facts.js';
import { effectiveHours, isHistory, isPm, sourcedReports, type SourcedReport } from './rows.js';
import type { Computer, EngineData, FigureValue, MachineRow } from './types.js';

/**
 * The machine page (ticket 39): one record per machine, as the platform's detail card prints it. The Guide is the
 * authority: connected load is the Power (KVA) on record, running load is connected × the efficiency factor, floor
 * area is Length × Width / 1e6, MTBF is (annual available hours − BD hours) ÷ breakdowns, and PM visits/hours are
 * the log's PM rows. A machine the plant leaves out of production data shows no breakdown summary.
 */
export interface MachineLoad {
  connectedKva: number | null;
  runningKva: number | null;
  supplyKva: number | null;
}

export interface MachineMove {
  id: string;
  date: string;
  fromCell: string | null;
  toCell: string | null;
  fromLocation: string | null;
  toLocation: string | null;
}

export interface MachineRecord {
  id: string;
  code: string;
  segment: string | null;
  category: string | null;
  make: string | null;
  model: string | null;
  serial: string | null;
  assetCode: string | null;
  controller: string | null;
  controllerModel: string | null;
  controllerSerial: string | null;
  year: number | null;
  purchasedOn: string | null;
  ageYears: number | null;
  ageBasis: 'purchase' | 'estimated' | null;
  location: string | null;
  cell: string | null;
  conveyor: string | null;
  lengthMm: number | null;
  widthMm: number | null;
  floorAreaM2: number | null;
  connectedKva: number | null;
  runningKva: number | null;
  efficiencyPct: number;
  supplyKva: number | null;
  breakdowns: number;
  bdHours: number;
  mttrHours: number | null;
  mtbfHours: number | null;
  pmVisits: number;
  pmHours: number;
  lastBreakdown: string | null;
  topProblem: { problem: string; count: number } | null;
  completeness: { filled: number; total: number };
  moves: MachineMove[];
}

const present = (value: unknown): boolean =>
  value !== null && value !== undefined && String(value).trim() !== '';

/** The nameplate fields the card counts: ten for a CNC machine, nine for a utility or DG set. */
function completeness(machine: MachineRow): { filled: number; total: number } {
  const length = metadataNumber(machine, 'length');
  const width = metadataNumber(machine, 'width');
  const power = machine.segment === 'DG' ? machine.capacityKva : machine.powerKw;
  const fields =
    machine.segment === 'CNC'
      ? [
          machine.make,
          machine.model,
          machine.serial,
          machine.year || machine.purchasedOn,
          machine.powerKw,
          machine.location,
          machine.cell,
          length,
          width,
          machine.controller,
        ]
      : [
          machine.make,
          machine.model,
          machine.serial,
          machine.year || machine.purchasedOn,
          power,
          machine.location,
          machine.cell,
          length,
          width,
        ];
  return { filled: fields.filter(present).length, total: fields.length };
}

/** Connected load and the Guide's running-load estimate; a DG set's capacity is supply, never load. */
function loadOf(machine: MachineRow, efficiencyPct: number): MachineLoad {
  if (machine.segment === 'DG') {
    return { connectedKva: null, runningKva: null, supplyKva: machine.capacityKva };
  }
  const connected = machine.powerKw;
  if (connected === null) return { connectedKva: null, runningKva: null, supplyKva: null };
  return {
    connectedKva: connected,
    runningKva: roundValue((connected * efficiencyPct) / 100, 2),
    supplyKva: null,
  };
}

/** One machine's breakdown summary from the history log, PM excluded and NO-DT worth zero hours. */
function summaryOf(machine: MachineRow, rows: readonly SourcedReport[], annual: number) {
  if (machine.excludedFromProduction) {
    return { breakdowns: 0, bdHours: 0, mttrHours: null, mtbfHours: null };
  }
  const actual = rows.filter((row) => !isPm(row));
  const hours = actual.reduce((sum, row) => sum + effectiveHours(row.report), 0);
  const count = actual.length;
  return {
    breakdowns: count,
    bdHours: roundValue(hours, 2),
    mttrHours: count > 0 ? roundValue(hours / count, 2) : null,
    mtbfHours: count > 0 ? roundValue((annual - hours) / count, 1) : null,
  };
}

/** The most frequent problem on a machine, first recorded wins a tie as the platform's stable sort does. */
function topProblemOf(machine: MachineRow, rows: readonly SourcedReport[]) {
  if (machine.excludedFromProduction) return null;
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (isPm(row)) continue;
    const problem = row.report.problem.trim();
    if (problem !== '') counts.set(problem, (counts.get(problem) ?? 0) + 1);
  }
  let top: { problem: string; count: number } | null = null;
  for (const [problem, count] of counts) if (!top || count > top.count) top = { problem, count };
  return top;
}

/** A plant date (`YYYY-MM-DD`) as the platform prints it (`DD-MM-YYYY`). */
const displayDate = (date: string): string =>
  date.length >= 10 ? `${date.slice(8, 10)}-${date.slice(5, 7)}-${date.slice(0, 4)}` : date;

/** The moves logged for one machine, newest first, with the locations 0014 carries. */
const movesOf = (data: EngineData, machineId: string): MachineMove[] =>
  data.moves
    .filter((move) => move.machineId === machineId)
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))
    .map((move) => ({
      id: move.id,
      date: displayDate(move.effectiveFrom),
      fromCell: move.fromCell,
      toCell: move.toCell,
      fromLocation: move.fromLocation ?? null,
      toLocation: move.toLocation ?? null,
    }));

/** What one machine's record reads beside the machine row: its log rows and the engine's own context. */
interface RecordContext {
  rows: readonly SourcedReport[];
  annual: number;
  efficiencyPct: number;
  asOf: string;
  moves: MachineMove[];
}

/** One machine's page record: identity, age, area, load, breakdown summary, PM, completeness and its moves. */
function recordOf(machine: MachineRow, context: RecordContext): MachineRecord {
  const { rows, annual, efficiencyPct, asOf, moves } = context;
  const lengthMm = metadataNumber(machine, 'length');
  const widthMm = metadataNumber(machine, 'width');
  const pm = rows.filter((row) => isPm(row));
  const dates = rows.filter((row) => !isPm(row)).map((row) => row.report.date);
  const load = loadOf(machine, efficiencyPct);
  const age = machineAge(machine, asOf);
  return {
    id: machine.id,
    code: machine.code,
    segment: machine.segment,
    category: machine.category,
    make: machine.make,
    model: machine.model,
    serial: machine.serial ?? null,
    assetCode: machine.assetCode,
    controller: machine.controller,
    controllerModel: machine.controllerModel ?? null,
    controllerSerial: machine.controllerSerial ?? null,
    year: machine.year,
    purchasedOn: machine.purchasedOn,
    ageYears: age,
    ageBasis: machine.purchasedOn !== null ? 'purchase' : age === null ? null : 'estimated',
    location: machine.location,
    cell: machine.cell,
    conveyor: typeof machine.metadata.conveyor === 'string' ? machine.metadata.conveyor : null,
    lengthMm,
    widthMm,
    floorAreaM2:
      lengthMm !== null && widthMm !== null && lengthMm > 0 && widthMm > 0
        ? roundValue((lengthMm * widthMm) / 1e6, 2)
        : null,
    ...load,
    efficiencyPct,
    ...summaryOf(machine, rows, annual),
    pmVisits: pm.length,
    pmHours: roundValue(
      pm.reduce((sum, row) => sum + effectiveHours(row.report), 0),
      2,
    ),
    lastBreakdown: dates.length > 0 ? dates.sort().at(-1)! : null,
    topProblem: topProblemOf(machine, rows),
    completeness: completeness(machine),
    moves,
  };
}

/** Every machine's page record, drilling to every machine. */
export const machinePage: Computer = ({ data, asOf, profile }) => {
  const history = sourcedReports(data).filter(isHistory);
  const annual = annualHours(profile);
  const records = data.machines.map((machine) =>
    recordOf(machine, {
      rows: history.filter((row) => row.report.machineId === machine.id),
      annual,
      efficiencyPct: profile.efficiencyFactor,
      asOf,
      moves: movesOf(data, machine.id),
    }),
  );
  return {
    value: { records } as unknown as FigureValue,
    drillIds: records.map((record) => record.id),
  };
};

const annualHours = (profile: AnalyticsProfile): number =>
  profile.prodHrsPerDay * profile.workDaysPerYear;
