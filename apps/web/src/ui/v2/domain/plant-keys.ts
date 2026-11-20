/**
 * Arrow-key moves over the plant map. `rows` holds the codes a reader can reach, one row per cell (filtered-out
 * machines are left out, so the keys skip them). Left and right run along the whole map, wrapping from one cell's
 * end to the next cell's start; up and down keep the place in the row, clamped to the shorter row; Home and End
 * go to the first and last machine. Any other key, or a code not on the map, moves nowhere.
 */
export function nextTile(rows: string[][], at: string, key: string): string | undefined {
  const filled = rows.filter((r) => r.length > 0);
  const flat = filled.flat();
  const i = flat.indexOf(at);
  if (i < 0) return undefined;
  const r = filled.findIndex((row) => row.includes(at));
  const c = filled[r]!.indexOf(at);
  const inRow = (row: string[] | undefined) => row?.[Math.min(c, row.length - 1)];
  switch (key) {
    case 'ArrowRight':
      return flat[Math.min(i + 1, flat.length - 1)];
    case 'ArrowLeft':
      return flat[Math.max(i - 1, 0)];
    case 'ArrowDown':
      return inRow(filled[r + 1]) ?? at;
    case 'ArrowUp':
      return inRow(filled[r - 1]) ?? at;
    case 'Home':
      return flat[0];
    case 'End':
      return flat[flat.length - 1];
    default:
      return undefined;
  }
}
