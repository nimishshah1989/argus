import type { Sheet } from '@uptimo/shared/xlsx';
import type { ForecastLabModel } from './model.js';

const PLAIN = /^-?[\d,]+(\.\d+)?$/;

/**
 * Sweep 706 (ADR 0041 690): the Forecast Lab's tables for "Download Excel", one sheet per table, in the page's order.
 *
 * Each sheet: `name` = the table's title; `rows` = the header labels first, then one row per table row in the model's
 * order (not re-sorted), one value per header column. A cell is a number only when its column is `numeric` and its
 * text is a plain printed number (`/^-?[\d,]+(\.\d+)?$/`): then `Number(text without commas)`, exact as printed
 * ("1,234.5" → 1234.5, "0.123456" → 0.123456, never re-rounded). Every other cell is its printed `text` unchanged
 * ("99.3%", "—", "", a code, "2026" in a non-numeric column). A table with no rows is a sheet holding the header only.
 * No tables → `[]`.
 */
export function labSheets(model: Pick<ForecastLabModel, 'tables'>): Sheet[] {
  return model.tables.map((table) => ({
    name: table.title,
    rows: [
      table.header.map((h) => h.label),
      ...table.rows.map((row) =>
        row.map((cell, at) =>
          table.header[at]?.numeric && PLAIN.test(cell.text)
            ? Number(cell.text.replaceAll(',', ''))
            : cell.text,
        ),
      ),
    ],
  }));
}
