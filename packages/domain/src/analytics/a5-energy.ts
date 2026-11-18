import { metadataNumber } from './format.js';
import type { Computer, FigureValue, MachineRow } from './types.js';

/**
 * A5, the energy heatmap (ticket 41, packet 41b): the plant's installed load by cell and by location, with the
 * efficiency factor behind the running figures. The fleet is every CNC machine — the excluded ones included,
 * because the platform's energy page reads its machine list, not its production data (R5).
 *
 * Per-machine efficiency is the 11 Nov rule the committed export lacks: a machine's own `efficiency` metadata
 * (clamped 0..100) beats the plant's factor, and running load is summed per machine rather than applied to the
 * bucket total, so the key's 97.40000000000002 survives.
 */

/** The platform's own bucket for a machine whose cell Settings does not list. */
const DASH = '—';

interface Bucket {
  key: string;
  machines: number;
  totalKva: number;
  avgKva: number;
  runningKva: number;
  avgRunningKva: number;
  machineIds: string[];
}

const isCnc = (machine: MachineRow): boolean => machine.segment === 'CNC';

/** The rated power the platform parses; a missing or unusable nameplate value adds no load. */
const powerKva = (machine: MachineRow): number =>
  machine.powerKw !== null && Number.isFinite(machine.powerKw) ? machine.powerKw : 0;

/** The machine's own efficiency, clamped to 0..100, when it carries one; else the plant's factor. */
function efficiencyPct(machine: MachineRow, factor: number): number {
  const own = metadataNumber(machine, 'efficiency');
  return own === null ? factor : Math.min(100, Math.max(0, own));
}

/** The cell a machine belongs to: its trimmed cell when Settings lists it, else the platform's dash bucket. */
function cellOf(machine: MachineRow, cells: ReadonlySet<string>): string {
  const cell = machine.cell?.trim() ?? '';
  return cells.has(cell) ? cell : DASH;
}

/** One grid bucket: its machines in data order, their load summed in that order, averages over the count. */
function bucketOf(key: string, machines: readonly MachineRow[], factor: number): Bucket {
  let totalKva = 0;
  let runningKva = 0;
  for (const machine of machines) {
    const power = powerKva(machine);
    totalKva += power;
    runningKva += (power * efficiencyPct(machine, factor)) / 100;
  }
  return {
    key,
    machines: machines.length,
    totalKva,
    avgKva: machines.length === 0 ? 0 : totalKva / machines.length,
    runningKva,
    avgRunningKva: machines.length === 0 ? 0 : runningKva / machines.length,
    machineIds: machines.map((machine) => machine.id),
  };
}

/** The Settings cells in their own order, then the dash bucket only when a machine's cell is blank or unknown. */
function cellBuckets(
  machines: readonly MachineRow[],
  cells: readonly string[],
  factor: number,
): Bucket[] {
  const known = new Set(cells);
  const buckets = cells.map((key) =>
    bucketOf(
      key,
      machines.filter((machine) => cellOf(machine, known) === key),
      factor,
    ),
  );
  const unknown = machines.filter((machine) => cellOf(machine, known) === DASH);
  return unknown.length === 0 ? buckets : [...buckets, bucketOf(DASH, unknown, factor)];
}

/** The Settings locations in their own order; a machine whose location is unlisted belongs to no bucket. */
function locationBuckets(
  machines: readonly MachineRow[],
  locations: readonly string[],
  factor: number,
): Bucket[] {
  return locations.map((key) =>
    bucketOf(
      key,
      machines.filter((machine) => machine.location === key),
      factor,
    ),
  );
}

/**
 * The A5 figure: the key's page and its two grids. A plant with no CNC machine has no load to print, so the value
 * is null rather than a fabricated zero. The drill names every CNC machine, excluded ones included.
 */
export const a5EnergyFigure: Computer = ({ data, asOf, profile }) => {
  const fleet = data.machines.filter(isCnc);
  if (fleet.length === 0) return { value: null, drillIds: [] };
  const factor = profile.efficiencyFactor;
  const value = {
    screen: 'a5-energy',
    asOf,
    pages: [{ page: 'a5', title: 'Energy Heatmap', kpis: [], tables: [], charts: [] }],
    extra: {
      byCell: cellBuckets(fleet, data.settings?.cells ?? [], factor),
      byLocation: locationBuckets(fleet, data.settings?.locations ?? [], factor),
      effFactorPct: factor,
    },
  };
  return { value: value as unknown as FigureValue, drillIds: fleet.map((machine) => machine.id) };
};
