/** A cell the engine printed as a string or a finite number; anything else is not a printable cell. */
export function printableOf(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

/**
 * A table's printable rows, and A6's ticket id for each (`rowTicketIds`, parallel to the engine's rows). A row
 * dropped as unprintable drops its id with it, so the ids always stay in step with the rows kept. A table with no
 * such ids, or ids that do not line up with its rows, has none (null): a row then has no ticket to act on.
 */
export function tableRows(table: Record<string, unknown>): {
  rows: string[][];
  rowTicketIds: string[] | null;
} {
  const rawRows = Array.isArray(table.rows) ? table.rows : [];
  const rawIds = Array.isArray(table.rowTicketIds) ? table.rowTicketIds : null;
  const paired =
    rawIds !== null &&
    rawIds.length === rawRows.length &&
    rawIds.every((id) => typeof id === 'string');
  const rows: string[][] = [];
  const ids: string[] = [];
  rawRows.forEach((row, position) => {
    const cells = (Array.isArray(row) ? row : []).map(printableOf);
    if (cells.length === 0 || !cells.every((cell) => cell !== null)) return;
    rows.push(cells as string[]);
    if (paired) ids.push(rawIds[position] as string);
  });
  return { rows, rowTicketIds: paired ? ids : null };
}
