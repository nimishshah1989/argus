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
  return page.tables.map((table) => {
    const keep = table.header.flatMap((h, i) => (h.fixed ? [] : [i]));
    return {
      name: table.title,
      rows: [
        keep.map((i) => table.header[i]!.label),
        ...table.rows.map((cells) =>
          keep.map((i) => {
            const cell = cells[i];
            if (!cell) return '';
            if (
              table.header[i]!.numeric &&
              typeof cell.sort === 'number' &&
              Number.isFinite(cell.sort)
            )
              return cell.sort;
            return cell.note ? `${cell.text} ${cell.note}` : cell.text;
          }),
        ),
      ],
    };
  });
}
