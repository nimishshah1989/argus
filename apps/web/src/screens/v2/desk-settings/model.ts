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
  void machines;
  throw new Error('not implemented');
}

/** The cells set to `HIGH`, in `MATRIX_CELLS` order. */
export function highCells(matrix: SeverityMatrix): MatrixCell[] {
  void matrix;
  throw new Error('not implemented');
}

/** The policies S1 → S4, without changing the input. */
export function slaRows(policies: readonly SlaPolicy[]): SlaPolicy[] {
  void policies;
  throw new Error('not implemented');
}

export function pausingReasons(waitReasons: readonly ListItem[]): PausingReasons {
  void waitReasons;
  throw new Error('not implemented');
}
