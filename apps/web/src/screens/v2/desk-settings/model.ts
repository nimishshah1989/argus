import type {
  Criticality,
  ListItem,
  Machine,
  Severity,
  SeverityMatrix,
} from '@uptimo/shared/config';
import type { SlaPolicy } from '@uptimo/shared/sla';

/** The wireframe's "High": the most urgent severity. */
export const HIGH: Severity = 'S1';

/** Machines by criticality; `unset` = no criticality stored. */
export type CriticalityTakeaway = { total: number; unset: number } & Record<Criticality, number>;

/** One cell of the severity matrix, in the order the matrix is drawn. */
export type MatrixCell =
  `${Criticality}.${'stopped' | 'support'}` | 'workRequest' | 'urgentWorkRequest';
export const MATRIX_CELLS: readonly MatrixCell[] = [
  'A.stopped',
  'A.support',
  'B.stopped',
  'B.support',
  'C.stopped',
  'C.support',
  'workRequest',
  'urgentWorkRequest',
];

/** Active wait reasons that pause the restore clock (by `sort`), out of every active wait reason. */
export type PausingReasons = { pausing: ListItem[]; total: number };

/** Null when there is no machine. */
export function criticalityTakeaway(machines: readonly Machine[]): CriticalityTakeaway | null {
  if (machines.length === 0) return null;
  const out: CriticalityTakeaway = { total: machines.length, unset: 0, A: 0, B: 0, C: 0 };
  for (const m of machines) {
    if (m.criticality === null) out.unset += 1;
    else out[m.criticality] += 1;
  }
  return out;
}

/** The severity one matrix cell is set to. */
export function cellValue(matrix: SeverityMatrix, cell: MatrixCell): Severity {
  if (cell === 'workRequest' || cell === 'urgentWorkRequest') return matrix[cell];
  const [crit, kind] = cell.split('.') as [Criticality, 'stopped' | 'support'];
  return matrix.default[crit][kind];
}

/** The cells set to `HIGH`, in `MATRIX_CELLS` order. */
export function highCells(matrix: SeverityMatrix): MatrixCell[] {
  return MATRIX_CELLS.filter((cell) => cellValue(matrix, cell) === HIGH);
}

const ORDER: readonly Severity[] = ['S1', 'S2', 'S3', 'S4'];

/** The policies S1 → S4, without changing the input. */
export function slaRows(policies: readonly SlaPolicy[]): SlaPolicy[] {
  return [...policies].sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity));
}

export function pausingReasons(waitReasons: readonly ListItem[]): PausingReasons {
  const active = waitReasons.filter((r) => r.active);
  const pausing = active.filter((r) => r.pausesSla).sort((a, b) => a.sort - b.sort);
  return { pausing, total: active.length };
}
