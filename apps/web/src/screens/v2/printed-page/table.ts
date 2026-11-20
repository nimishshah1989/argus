import type {
  PrintedCell,
  PrintedChip,
  PrintedTable,
} from '../../../ui/v2/domain/printed-table.js';
export type { PrintedCell, PrintedChip, PrintedTable };
import type { PageTable } from '../../analytics/page-content.js';
import { dayValue, machineChip, numberValue, personChips, shortDate } from './printed.js';

const NUMBER = /^-?[\d,]+(\.\d+)?%?$/;
const DASH = '—';

/** What a column holds, read from the engine's own header: its words are data, as v1's own screens read them. */
function kindOf(label: string): 'machine' | 'people' | 'date' | 'text' {
  const name = label.trim().toLowerCase();
  if (name === 'machine') return 'machine';
  if (name === 'done by') return 'people';
  if (name === 'date') return 'date';
  return 'text';
}

function cellOf(kind: ReturnType<typeof kindOf>, printed: string, numeric: boolean): PrintedCell {
  if (kind === 'machine')
    return { text: printed, sort: printed, chips: printed === '' ? [] : [machineChip(printed)] };
  if (kind === 'people') return { text: printed, sort: printed, chips: personChips(printed) };
  if (kind === 'date') return { text: shortDate(printed), sort: dayValue(printed), chips: [] };
  return { text: printed, sort: numeric ? numberValue(printed) : printed, chips: [] };
}

/**
 * An engine table as the screen prints it. A column whose every cell the engine left empty is left out (the platform
 * printed an input there, which carries no text); `keep` lists the columns that stay whatever they hold.
 */
export function printedTable(
  table: PageTable,
  chips: PrintedChip[] = [],
  keep: readonly number[] = [],
): PrintedTable {
  const columns = table.header.flatMap((label, at) => {
    const cells = table.rows.map((row) => row[at] ?? '');
    const empty = cells.every((cell) => cell.trim() === '');
    if (empty && !keep.includes(at)) return [];
    const numeric =
      cells.length > 0 && cells.every((c) => c === DASH || c === '' || NUMBER.test(c));
    return [{ at, label, numeric, kind: kindOf(label) }];
  });
  return {
    title: table.title,
    header: columns.map(({ label, numeric }) => ({ label, numeric })),
    rows: table.rows.map((row) => columns.map((c) => cellOf(c.kind, row[c.at] ?? '', c.numeric))),
    chips,
  };
}
