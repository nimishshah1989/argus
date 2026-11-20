import { useContext, useMemo } from 'react';
import { DataTable, type Column, type FilterChip, type TableWords } from '../data-table.js';
import { EntityChip, EntityOpenContext, type EntityChipProps } from '../entity-chip.js';
import { ScreenStates, type Loaded } from '../screen-states.js';
import type { SortState } from '../table-parts.js';
import { DetailFigure, SourceLine } from './detail-parts.js';

/** One cell as the table prints it: its words (also what search and a screen reader use), and what else it is. */
export type RowCell = {
  text: string;
  /** What the column sorts by when the words are not the order (a number, an ISO date). */
  sort?: number | string;
  /** A machine, cell, person or decision: printed as its chip. */
  chip?: EntityChipProps;
  /** A thing with a page of its own (a ticket): printed as a link to it. */
  href?: string;
};
export type RowsBehindColumn = {
  key: string;
  label: string;
  numeric?: boolean;
  sortable?: boolean;
};
export type RowsBehindRow = {
  /** Unique and readable (a code, a reference): it names the row's Open button aloud, so never an id. */
  key: string;
  cells: Record<string, RowCell>;
  /** The filter chips this row answers to. */
  tags: string[];
  /** What opening the row does: a machine, cell, person or decision opens its drawer; anything else goes to its page. */
  open: { chip: EntityChipProps } | { href: string };
};

/**
 * The rows behind one figure, every word and figure ready to print: which figure and its exact value (as the engine
 * sent it), what was counted, the rows, and where they came from.
 */
export type RowsBehindModel = {
  figure: string;
  label: string;
  value: string;
  /** What the rows are: "64 tickets". */
  counted: string;
  /** Where the rows came from and how fresh they are (DD-MMM-YYYY, IST). */
  source: string;
  columns: RowsBehindColumn[];
  rows: RowsBehindRow[];
  /** The two to four useful ways to narrow the rows, after "All"; none when the rows have no such split. */
  filters: { key: string; label: string }[];
  initialSort?: SortState;
};

export type RowsBehindWords = TableWords & {
  /** The first chip, which clears the narrowing. */
  all: string;
  /** Said when the figure counts nothing. */
  empty: string;
};

const cellOf = (row: RowsBehindRow, key: string): RowCell => row.cells[key] ?? { text: '' };

/** A cell: its chip, a link to its page, or its words. The link and the chip keep the click to themselves. */
function Cell({ cell }: { cell: RowCell }) {
  if (cell.chip) return <EntityChip {...cell.chip} />;
  if (cell.href)
    return (
      <a className="v2-ref" href={cell.href} onClick={(e) => e.stopPropagation()}>
        {cell.text}
      </a>
    );
  return cell.text;
}

function columnsOf(model: RowsBehindModel): Column<RowsBehindRow>[] {
  return model.columns.map((c) => ({
    key: c.key,
    label: c.label,
    numeric: c.numeric,
    sortBy: c.sortable ? (row) => cellOf(row, c.key).sort ?? cellOf(row, c.key).text : undefined,
    cell: (row) => <Cell cell={cellOf(row, c.key)} />,
  }));
}

function filtersOf(model: RowsBehindModel, all: string): FilterChip<RowsBehindRow>[] {
  if (model.filters.length === 0) return [];
  return [
    { key: '', label: all },
    ...model.filters.map((f) => ({
      key: f.key,
      label: f.label,
      test: (row: RowsBehindRow) => row.tags.includes(f.key),
    })),
  ];
}

/** The rows themselves: ten a page, search, sort on each meaningful column, a chip or the page of what each row is. */
function Rows({ model, words }: { model: RowsBehindModel; words: RowsBehindWords }) {
  const openEntity = useContext(EntityOpenContext);
  const columns = useMemo(() => columnsOf(model), [model]);
  const filters = useMemo(() => filtersOf(model, words.all), [model, words.all]);
  return (
    <DataTable
      rows={model.rows}
      rowKey={(row) => row.key}
      columns={columns}
      filters={filters}
      text={(row) => model.columns.map((c) => cellOf(row, c.key).text).join(' ')}
      words={words}
      initialSort={model.initialSort}
      onOpen={(row) =>
        'chip' in row.open ? openEntity(row.open.chip) : window.location.assign(row.open.href)
      }
    />
  );
}

/**
 * The drawer view of a figure: which figure and its exact value at the top, then the rows it counted, then where they
 * came from. Loading, error and "counts nothing" are the kit's states; "no rows match" is the table's own.
 */
export function RowsBehind({
  loaded,
  words,
}: {
  loaded: Loaded<RowsBehindModel>;
  words: RowsBehindWords;
}) {
  return (
    <ScreenStates loaded={loaded} emptyText={words.empty}>
      {(model) => (
        <div className="v2-detail v2-rows-behind">
          <h2 className="v2-drawer-title">{model.label}</h2>
          <DetailFigure label={model.counted} value={model.value} />
          <Rows model={model} words={words} />
          <SourceLine text={model.source} />
        </div>
      )}
    </ScreenStates>
  );
}
