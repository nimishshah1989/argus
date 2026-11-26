import { Fragment, useContext, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { printedTakeaway } from '../../../screens/v2/insight.js';
import { Button } from '../button.js';
import { DataTable, type Column, type FilterChip, type TableWords } from '../data-table.js';
import { EntityChip, EntityOpenContext, type EntityChipProps } from '../entity-chip.js';
import type { Meaning } from '../takeaway.js';
import type { ColumnLook } from '../table-look.js';

/** One printed cell: what it says, what it sorts by, and the thing it names when it names one. */
export type Cell = {
  text: string;
  sort: number | string;
  chip?: EntityChipProps;
  /** Several things in one cell (the machines a fault happened on). */
  chips?: EntityChipProps[];
  /** What goes between several chips ("4 → 2"). */
  join?: string;
  /** A button in the cell: its id goes to `onAction`; `text` is its label. */
  action?: string;
  /** A word the engine printed beside the thing (a machine marked "NOT IN PRODUCTION DATA"). */
  note?: string;
  /** A link out of the page (a ticket on the desk): `text` is what it says. */
  href?: string;
  /** A bar under the text, its length this share (0 to 1) of the longest in its column: length is the message. */
  bar?: number;
};

export type EngineTableWords = TableWords & { all: string };

/** A table of the engine's printed cells, ready to draw: numbers right, every cell sortable, the chips that filter it. */
export type TableModel = {
  id: string;
  title: string;
  header: {
    label: string;
    numeric: boolean;
    /** A column of buttons: not sorted. */ fixed?: boolean;
    /** How the column colours itself (ADR 0058), read from the engine's header by `lookOfHeader`. */
    look?: ColumnLook;
  }[];
  rows: Cell[][];
  /** Filter chips after "All": each keeps the rows whose `column` says `key`. */
  chips: { key: string; label: string; column: number }[];
  words: EngineTableWords;
  /**
   * The table's measure (ticket 620): its column, read by each cell's numeric `sort`, and what it means. The table then
   * opens with the takeaway `printedTakeaway` picks, ranks worst first, marks the worst row, bars and folds.
   */
  meaning?: Meaning & { column: number };
};

type Row = { id: string; cells: Cell[] };

/** The thing a row opens in the drawer: the first thing it names; a row that names nothing opens nothing. */
const firstChip = (row: Row): EntityChipProps | undefined =>
  row.cells.find((c) => c.chip)?.chip ?? row.cells.find((c) => c.chips?.length)?.chips?.[0];

function columnsOf(table: TableModel, onAction?: (id: string) => void): Column<Row>[] {
  const { meaning } = table;
  return table.header.map((h, i) => ({
    key: `c${i}`,
    label: h.label,
    numeric: h.numeric,
    look: h.look,
    ...(h.fixed ? {} : { sortBy: (row: Row) => row.cells[i]?.sort ?? '' }),
    ...(meaning?.column === i
      ? { meaning: { ...meaning, value: (row: Row) => Number(row.cells[i]?.sort) } }
      : {}),
    cell: (row) => {
      const cell = row.cells[i];
      if (!cell) return null;
      if (meaning?.column === i) return cell.text; // the kit draws this column's bar
      if (cell.action)
        return (
          <span onClick={(e) => e.stopPropagation()}>
            <Button onClick={() => onAction?.(cell.action ?? '')}>{cell.text}</Button>
          </span>
        );
      if (cell.chips?.length)
        return cell.chips.map((chip, at) => (
          <Fragment key={`${at}-${chip.id}`}>
            {at > 0 ? cell.join : null}
            <EntityChip {...chip} />
          </Fragment>
        ));
      if (cell.bar !== undefined)
        return (
          <span className="v2-cellbar">
            {cell.text}
            <span className="v2-cellbar-track" aria-hidden="true">
              <span
                style={{ width: `${Math.min(100, Math.max(0, cell.bar * 100)).toFixed(1)}%` }}
              />
            </span>
          </span>
        );
      if (cell.href)
        return (
          <a className="v2-ref" href={cell.href} onClick={(e) => e.stopPropagation()}>
            {cell.text}
          </a>
        );
      if (!cell.chip) return cell.text;
      return (
        <>
          <EntityChip {...cell.chip} />
          {cell.note ? <span className="v2-sub"> {cell.note}</span> : null}
        </>
      );
    },
  }));
}

/**
 * The engine's own table in the kit's table: search over every cell, a chip for each common value of one column, sort
 * on every column, ten rows a page. A cell that names a machine or a cell is a chip, and its row opens that thing.
 */
export function EngineTable({
  table,
  onAction,
  aside,
}: {
  table: TableModel;
  onAction?: (id: string) => void;
  /** Beside the title (the way to the rows behind the table's figure). */
  aside?: ReactNode;
}) {
  const open = useContext(EntityOpenContext);
  const { t } = useTranslation();
  const rows: Row[] = table.rows.map((cells, i) => ({ id: String(i), cells }));
  const named = rows.some((row) => firstChip(row));
  const filters: FilterChip<Row>[] = [
    { key: 'all', label: table.words.all },
    ...table.chips.map((c) => ({
      key: c.key,
      label: c.label,
      test: (row: Row) => row.cells[c.column]?.text === c.key,
    })),
  ];
  return (
    <DataTable
      rows={rows}
      rowKey={(row) => row.id}
      rowLabel={(row) => firstChip(row)?.id ?? row.id}
      columns={columnsOf(table, onAction)}
      filters={filters}
      text={(row) => row.cells.map((c) => c.text).join(' ')}
      words={table.words}
      aside={aside}
      takeaway={printedTakeaway(table, t) ?? undefined}
      onOpen={
        named
          ? (row) => {
              const chip = firstChip(row);
              if (chip) open({ kind: chip.kind, id: chip.id });
            }
          : undefined
      }
    />
  );
}
