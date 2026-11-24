import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { printedTakeaway } from '../../../screens/v2/insight.js';
import {
  DataTable,
  type Column,
  type FilterChip,
  type TableWords,
} from '../../../ui/v2/data-table.js';
import { EntityChip, EntityOpenContext, type EntityChipProps } from '../entity-chip.js';
import type { Meaning } from '../takeaway.js';

/** One cell of an engine table: what to print, what orders it, and the chips it holds (a machine, the people who did it). */
export type PrintedCell = { text: string; sort: number | string; chips: EntityChipProps[] };

/** A filter chip on a printed table: keeps the rows whose `column` holds `value` (`match` absent: every row). */
export type PrintedChip = { key: string; label: string; match?: { column: number; value: string } };

/** An engine table ready to print: the engine's own header and cells, dates as DD-MMM-YYYY, codes and names as chips. */
export type PrintedTable = {
  title: string;
  header: { label: string; numeric: boolean }[];
  rows: PrintedCell[][];
  chips: PrintedChip[];
  /** What the table counts and how to read it, in the platform's own words: one quiet line under its title. */
  note?: string;
  /**
   * The table's measure (ticket 620): its column, read by each cell's numeric `sort`, and what it means. The table then
   * opens with the takeaway `printedTakeaway` picks, ranks worst first, marks the worst row, bars and folds.
   */
  meaning?: Meaning & { column: number };
  /**
   * The table's total row (the engine's "PLANT TOTAL"), taken out of `rows` (ADR 0036 R14): drawn as the table's
   * footer, `PrintedDataTable` passing `total.map((c) => c.text)` as DataTable `total`. Absent when the engine printed none.
   */
  total?: PrintedCell[];
};

type Row = { id: string; cells: PrintedCell[] };

function content(cell: PrintedCell) {
  if (cell.chips.length === 0) return cell.text;
  return (
    <div className="v2-row v2-gap-6">
      {cell.chips.map((chip) => (
        <EntityChip key={chip.id} {...chip} />
      ))}
    </div>
  );
}

/**
 * Any table the engine printed, as the kit's table: every column the engine sent, sortable (the order its numbers
 * and dates carry), searchable, ten rows a page, with a machine or a person in a cell as a chip. A row opens the first
 * machine it names, or the first person.
 */
export function PrintedDataTable({
  table,
  words,
  selected,
}: {
  table: PrintedTable;
  words: TableWords;
  selected?: string;
}) {
  const open = useContext(EntityOpenContext);
  const { t } = useTranslation();
  const rows: Row[] = table.rows.map((cells, at) => ({ id: String(at), cells }));
  const { meaning } = table;
  const columns: Column<Row>[] = table.header.map((h, at) => ({
    key: String(at),
    label: h.label,
    numeric: h.numeric,
    sortBy: h.label === '' ? undefined : (r) => r.cells[at]?.sort ?? '',
    ...(meaning?.column === at
      ? { meaning: { ...meaning, value: (r: Row) => Number(r.cells[at]?.sort) } }
      : {}),
    cell: (r) => (r.cells[at] ? content(r.cells[at]) : null),
  }));
  const filters: FilterChip<Row>[] = table.chips.map((c) => ({
    key: c.key,
    label: c.label,
    test: c.match ? (r) => r.cells[c.match!.column]?.text === c.match!.value : undefined,
  }));
  return (
    <DataTable
      rows={rows}
      rowKey={(r) => r.id}
      columns={columns}
      filters={filters}
      text={(r) => r.cells.map((c) => c.text).join(' ')}
      words={{
        ...words,
        title: table.title || words.title,
        ...(table.note ? { sub: table.note } : {}),
      }}
      selected={selected}
      takeaway={printedTakeaway(table, t) ?? undefined}
      onOpen={(r) => {
        const first = r.cells.flatMap((c) => c.chips)[0];
        if (first) open(first);
      }}
    />
  );
}
