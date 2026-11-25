import type { Sheet } from '@uptimo/shared/xlsx';
import type { PmCalendarModel } from './model.js';

/**
 * Sweep #706 (ADR 0041 #690): the PM calendar's two tables for "Download Excel" (DOC. NO. `DOC_REF.pm`), as shown.
 *
 * 1. "Spread the load" — only when `model.spread` is not empty (the page hides the table otherwise).
 *    `name` = `words.spread.title`; header `[columns.machine, columns.planned, columns.free]`; one row per job in
 *    `spread`, by `planned.value` ascending (ties keep their order): `[machine.label, planned.shown,
 *    suggested?.shown ?? words.spread.noFreeDay]`.
 * 2. "Jobs this month" — always, even with no jobs (header only). `name` = `words.jobs.title`; header
 *    `[columns.machine, columns.job, columns.planned, columns.due, columns.tolerance, columns.status]` (no action
 *    column); one row per job in `monthJobs`, by `planned.value` ascending (ties keep their order):
 *    `[machine.label, title, planned.shown, due.shown, tolerance.value (the number of days), status]` where status =
 *    `statusWord`, plus ` · ${words.legend.crowded}` when the job is crowded.
 */
export function pmSheets(model: Pick<PmCalendarModel, 'spread' | 'monthJobs' | 'words'>): Sheet[] {
  void model;
  throw new Error('not implemented');
}
