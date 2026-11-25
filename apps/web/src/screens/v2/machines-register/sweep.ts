import type { Sheet } from '@uptimo/shared/xlsx';
import type { RegisterPageModel } from './model.js';

/**
 * The Machines register's "Download Excel" for the register in view (ADR 0036 R6, ADR 0041). The View passes
 * `docRef={DOC_REF.machines}` to `<DownloadExcel>`; the DOC. NO. is never written into these rows. One sheet per
 * `page.tables` entry, in order, each the table as the page shows it:
 * - name: the table's `title` (the kit cuts it to Excel's 31 characters);
 * - header row first: every `header[i].label`, skipping each column whose `fixed` is true (a column of buttons);
 * - then one row per `rows` entry, in the model's order, the same columns skipped. A cell is its `sort` when the
 *   column is `numeric` and `sort` is a finite number (exact, never re-rounded); otherwise its `text`, then one space
 *   and its `note` when it has one ("VC-1 NOT IN PRODUCTION DATA"). A row shorter than the header gives '' for the
 *   missing cells.
 * No tables → `[]`. Never mutates the page.
 */
export function registerSheets(page: RegisterPageModel): Sheet[] {
  void page;
  throw new Error('not implemented');
}
