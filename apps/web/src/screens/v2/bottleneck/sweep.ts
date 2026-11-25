import type { Sheet } from '@uptimo/shared/xlsx';
import { tableSheets } from '../problem-analysis/sweep.js';
import type { BottleneckModel } from './model.js';

/**
 * The Download Excel sheets for the Bottleneck page (ADR 0041): `tableSheets` (from `../problem-analysis/sweep.ts`, the
 * one rule for printed tables) of `model.tables`, every table in the engine's order, one sheet each.
 */
export function bottleneckSheets(model: BottleneckModel): Sheet[] {
  return tableSheets(model.tables);
}
