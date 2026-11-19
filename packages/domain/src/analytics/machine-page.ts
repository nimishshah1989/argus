import type { AnalyticsProfile } from '@uptimo/shared';
import type { Period } from './availability.js';
import { metadataNumber, roundValue } from './format.js';
import { machineAge } from './machine-facts.js';
import { effectiveHours, isHistory, isPm, sourcedReports, type SourcedReport } from './rows.js';
import type { Computer, EngineData, FigureValue, MachineRow } from './types.js';

/**
 * The machine page (ticket 39): one record per machine, keyed by machine id, as the platform's detail card prints
 * it. The Guide is the authority: connected load is the Power (KVA) on record, running load is connected × the
 * efficiency factor, floor area is Length × Width / 1e6, MTBF is (annual available hours − BD hours) ÷ breakdowns,
 * and PM visits/hours are the log's PM rows. A machine the plant leaves out of production data has no breakdown
 * summary; a missing length, width or purchase date stays null, never a zero or a guess.
 */
export interface PageMachine {
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
  lengthMm: number | null;
  widthMm: number | null;
  conveyor: string | null;
}

export interface MachineBreakdowns {
  count: number;
  hours: number;
  mttr: number | null;
  mtbf: number | null;
  lastOn: string | null;
  topProblem: { problem: string; count: number } | null;
}

export interface MachineMove {
  id: string;
  machineId: string;
  date: string;
  fromCell: string | null;
  toCell: string | null;
  fromLocation: string | null;
  toLocation: string | null;
}

export interface MachineRecord {
  machine: PageMachine;
  ageYears: number | null;
  ageEstimated: boolean;
  floorAreaM2: number | null;
  efficiencyPct: number;
  connectedKva: number | null;
  runningKva: number | null;
  breakdowns: MachineBreakdowns | null;
  pm: { visits: number; hours: number } | null;
  completeness: { recorded: number; of: number; missing: string[] };
  moves: MachineMove[];
  drill: { breakdowns: string[]; pm: string[]; moves: string[] };
}

/** The nameplate fields the card prints, reading only what the rows hold. */
const nameplate = (machine: MachineRow): PageMachine => ({
  id: machine.id,
  code: machine.code,
  segment: machine.segment,
  category: machine.category,
  make: machine.make,
  model: machine.model,
  serial: machine.serial ?? null,
  controller: machine.controller,
  controllerModel: machine.controllerModel ?? null,
  controllerSerial: machine.controllerSerial ?? null,
  year: machine.year,
  purchasedOn: machine.purchasedOn,
  powerKva: machine.powerKw,
  capacityKva: machine.capacityKva,
  location: machine.location,
  cell: machine.cell,
  assetCode: machine.assetCode,
  lengthMm: metadataNumber(machine, 'length'),
  widthMm: metadataNumber(machine, 'width'),
  conveyor: typeof machine.metadata.conveyor === 'string' ? machine.metadata.conveyor : null,
});

/** The record-completeness fields, named so the face can say which one is missing. */
function completenessOf(machine: MachineRow): MachineRecord['completeness'] {
  const fields: Array<[string, unknown]> =
    machine.segment === 'CNC'
      ? [
          ['make', machine.make],
          ['model', machine.model],
          ['serial', machine.serial],
          ['year or purchase date', machine.year || machine.purchasedOn],
          ['power', machine.powerKw],
          ['location', machine.location],
          ['cell', machine.cell],
          ['length', metadataNumber(machine, 'length')],
          ['width', metadataNumber(machine, 'width')],
          ['controller', machine.controller],
        ]
      : [
          ['make', machine.make],
          ['model', machine.model],
          ['serial', machine.serial],
          ['year or purchase date', machine.year || machine.purchasedOn],
          ['power', machine.segment === 'DG' ? machine.capacityKva : machine.powerKw],
          ['location', machine.location],
          ['cell', machine.cell],
          ['length', metadataNumber(machine, 'length')],
          ['width', metadataNumber(machine, 'width')],
        ];
  const missing = fields
    .filter(([, value]) => value === null || value === undefined || String(value).trim() === '')
    .map(([name]) => name);
  return { recorded: fields.length - missing.length, of: fields.length, missing };
}

/** One machine's breakdowns in the span: PM excluded, NO-DT counted but worth zero hours; `lastOn` is the latest ever. */
function breakdownsOf(
  machine: MachineRow,
  rows: readonly SourcedReport[],
  annual: number,
  lastOn: string | null,
): MachineBreakdowns | null {
  if (machine.segment !== 'CNC' || machine.excludedFromProduction) return null;
  const actual = rows.filter((row) => !isPm(row));
  const hours = actual.reduce((sum, row) => sum + effectiveHours(row.report), 0);
  const count = actual.length;
  const counts = new Map<string, number>();
  for (const row of actual) {
    const problem = row.report.problem.trim();
    if (problem !== '') counts.set(problem, (counts.get(problem) ?? 0) + 1);
  }
  let topProblem: MachineBreakdowns['topProblem'] = null;
  for (const [problem, n] of counts)
    if (!topProblem || n > topProblem.count) topProblem = { problem, count: n };
  return {
    count,
    hours: roundValue(hours, 2),
    mttr: count > 0 ? roundValue(hours / count, 2) : null,
    mtbf: count > 0 ? roundValue((annual - hours) / count, 1) : null,
    lastOn,
    topProblem,
  };
}

/** The PM visits and hours the machine's own PM rows record, or null when breakdown tracking does not cover it. */
function pmOf(machine: MachineRow, rows: readonly SourcedReport[]) {
  if (machine.segment !== 'CNC' || machine.excludedFromProduction) return null;
  const pm = rows.filter(isPm);
  return {
    visits: pm.length,
    hours: roundValue(
      pm.reduce((sum, row) => sum + effectiveHours(row.report), 0),
      2,
    ),
  };
}

/** The moves logged for one machine, newest first, as the cell log shapes them. */
const movesOf = (data: EngineData, machineId: string): MachineMove[] =>
  data.moves
    .filter((move) => move.machineId === machineId)
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))
    .map((move) => ({
      id: move.id,
      machineId: move.machineId,
      date: move.effectiveFrom,
      fromCell: move.fromCell,
      toCell: move.toCell,
      fromLocation: move.fromLocation ?? null,
      toLocation: move.toLocation ?? null,
    }));

/** What one machine's record reads beside its row: its log rows and the engine's own context. */
interface RecordContext {
  rows: readonly SourcedReport[];
  annual: number;
  period: Period | undefined;
  efficiencyPct: number;
  asOf: string;
  moves: MachineMove[];
}

/**
 * The flat year the MTBF divides by: the profile's annual hours for each calendar year of the span from the machine's
 * purchase year on, less its no-records months. One year gives the annual hours; no span names one year.
 */
function annualOver(machine: MachineRow, annual: number, period: Period | undefined): number {
  if (period === undefined) return annual;
  const bought = machine.purchasedOn === null ? 0 : Number(machine.purchasedOn.slice(0, 4));
  const first = Math.max(Number(period.from.slice(0, 4)), bought);
  const last = Number(period.to.slice(0, 4));
  const gaps = (period.noRecords ?? []).filter((key) => key >= `${first}-01`).length;
  return first > last ? 0 : (annual * (12 * (last - first + 1) - gaps)) / 12;
}

/**
 * One machine's page record: nameplate, age, area, load, completeness and moves as of the run date, its last failure
 * from the whole history, and its breakdown summary, PM and drills from the span's own rows.
 */
function recordOf(machine: MachineRow, context: RecordContext): MachineRecord {
  const { annual, efficiencyPct, asOf, moves, period } = context;
  const lastOn =
    context.rows
      .filter((row) => !isPm(row))
      .map((row) => row.report.date)
      .sort()
      .at(-1) ?? null;
  const rows =
    period === undefined
      ? context.rows
      : context.rows.filter(({ report }) => report.date >= period.from && report.date <= period.to);
  const connected = machine.segment === 'DG' ? null : machine.powerKw;
  const running = connected === null ? null : roundValue((connected * efficiencyPct) / 100, 2);
  const length = metadataNumber(machine, 'length');
  const width = metadataNumber(machine, 'width');
  const age = machineAge(machine, asOf);
  const actual = rows.filter((row) => !isPm(row));
  const pm = rows.filter(isPm);
  return {
    machine: nameplate(machine),
    ageYears: age,
    ageEstimated: machine.purchasedOn === null && age !== null,
    floorAreaM2:
      length === null || width === null || length <= 0 || width <= 0
        ? null
        : roundValue((length * width) / 1e6, 2),
    efficiencyPct,
    connectedKva: connected,
    runningKva: running,
    breakdowns: breakdownsOf(machine, rows, annualOver(machine, annual, period), lastOn),
    pm: pmOf(machine, rows),
    completeness: completenessOf(machine),
    moves,
    drill: {
      breakdowns: actual.map((row) => row.ticket.id),
      pm: pm.map((row) => row.ticket.id),
      moves: moves.map((move) => move.id),
    },
  };
}

/** One record per machine, keyed by machine id, drilling to every machine's page. */
export const machinePage: Computer = ({ data, asOf, profile }) => {
  const history = sourcedReports(data).filter(isHistory);
  const annual = annualHours(profile);
  const byMachine: Record<string, MachineRecord> = {};
  for (const machine of data.machines) {
    byMachine[machine.id] = recordOf(machine, {
      rows: history.filter((row) => row.report.machineId === machine.id),
      annual,
      period: data.period,
      efficiencyPct: profile.efficiencyFactor,
      asOf,
      moves: movesOf(data, machine.id),
    });
  }
  return {
    value: { byMachine } as unknown as FigureValue,
    drillIds: data.machines.map((m) => m.id),
  };
};

const annualHours = (profile: AnalyticsProfile): number =>
  profile.prodHrsPerDay * profile.workDaysPerYear;
