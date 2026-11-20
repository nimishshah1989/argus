import { useId, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../ui/card.js';
import { Chart } from '../../ui/chart/chart.js';
import type { ChartSpec } from '../../ui/chart/use-chart.js';
import {
  DataTable,
  KpiTile,
  tableView,
  type Column,
  type Sort,
  type TableLabels,
} from '../../ui/elements/index.js';
import { drawnChart } from './key-chart.js';
import type { PageKpi, PageTable } from './page-content.js';
import { HeatTable } from './parts.js';
import { cellNumber, isMissing } from './sort-table.js';

/**
 * The inside of a key-shaped engine page on the shared elements (ticket 87): its KPIs as tiles, its tables in the
 * one data table, its charts in a card through the chart door. Every printed string is the engine's own and is
 * shown as it came: a figure is never parsed back into a number to be printed again.
 */

/**
 * A KPI the engine printed: its text is the value, so the tile prints it exactly as it came (a blank, a hyphen or
 * an en dash included) and never counts it up. The tile is given a number only so it does not print its own dash.
 */
export function KeyKpi({ kpi }: { kpi: PageKpi }) {
  return (
    <KpiTile label={kpi.label} value={0} format={() => kpi.value} note={kpi.sub ?? undefined} />
  );
}

/** One engine row with its place in the engine's order, which is its key however the table is sorted. */
interface Row {
  at: number;
  cells: readonly string[];
}

const RUPEES: Record<string, number> = { lakh: 1e5, cr: 1e7, crore: 1e7 };
const MONEY = /^([-+])?\s*₹\s*([-+])?\s*(\d[\d,]*(?:\.\d+)?)\s*(lakh|crore|cr)?\b/i;

/**
 * The number a printed cell carries, for ordering only: a plain number or percentage, or money in the form the
 * engine prints ("₹ 38.23 lakh", "₹ 1.2 cr", "₹ 71,784") read to rupees so lakh and crore rows sort by value.
 */
export function sortNumber(cell: string): number | null {
  const plain = cellNumber(cell);
  if (plain !== null) return plain;
  const found = MONEY.exec(cell.trim());
  if (found === null) return null;
  const value = Number((found[3] ?? '').replaceAll(',', ''));
  const sign = found[1] === '-' || found[2] === '-' ? -1 : 1;
  return (
    sign * (Math.round(value * (RUPEES[(found[4] ?? '').toLowerCase()] ?? 1) * 100) / 100) || 0
  );
}

/** A column is numeric when every printed cell that is not a dash is a number: it aligns right and sorts as one. */
function isNumeric(rows: readonly Row[], at: number): boolean {
  const cells = rows.map((row) => row.cells[at] ?? '').filter((cell) => !isMissing(cell));
  return cells.length > 0 && cells.every((cell) => sortNumber(cell) !== null);
}

/**
 * The columns of an engine table: a header per cell, sorted by the number it carries (a dash sorts last). A cell is
 * printed exactly as the engine wrote it: the engine's own dash stays a dash and a blank cell stays blank. A
 * column with no header cannot be sorted, because its sort button would have no name.
 */
export function columnsOf(table: PageTable, rows: readonly Row[]): Column<Row>[] {
  return table.header.map((header, at) => {
    const numeric = isNumeric(rows, at);
    const printed = (row: Row) => row.cells[at] ?? '';
    return {
      id: String(at),
      header,
      numeric,
      cell: printed,
      ...(table.sortable === true && header.trim() !== ''
        ? {
            sortValue: (row: Row): number | string => {
              if (isMissing(printed(row))) return Number.NaN;
              return numeric ? (sortNumber(printed(row)) ?? Number.NaN) : printed(row);
            },
          }
        : {}),
    };
  });
}

/** The pager's words, in the catalogue, with Indian grouping on the counts. */
export function useTableLabels(caption: string): TableLabels {
  const { t } = useTranslation();
  return {
    caption,
    filter: caption,
    previous: t('analytics.keytable.previous'),
    next: t('analytics.keytable.next'),
    page: (page, pages) => t('analytics.keytable.page', { page, pages }),
    range: (from, to, total) =>
      t('analytics.keytable.range', {
        from: from.toLocaleString('en-IN'),
        to: to.toLocaleString('en-IN'),
        total: total.toLocaleString('en-IN'),
      }),
    empty: t('analytics.keytable.empty'),
  };
}

const rowText = (row: Row) => row.cells.join(' ');
const PAGE_SIZE = 50;

/**
 * The state of a table held in memory: the sort and the page. Unlike `useClientTable` it has no row limit, because an
 * engine table is already bounded by the engine and a limit that throws would blank the whole screen.
 */
function usePagedRows(rows: Row[], columns: Column<Row>[]) {
  const [sort, setSort] = useState<Sort>();
  const [page, setPage] = useState(0);
  const view = useMemo(
    () => tableView(rows, columns, { sort, filter: '', page, pageSize: PAGE_SIZE }, rowText),
    [rows, columns, sort, page],
  );
  const onSort = (column: string) => {
    setSort(
      sort?.column !== column
        ? { column, dir: 'asc' }
        : sort.dir === 'asc'
          ? { column, dir: 'desc' }
          : undefined,
    );
    setPage(0);
  };
  return { ...view, sort, pageSize: PAGE_SIZE, onSort, onPage: setPage };
}

/**
 * One engine table: its title over the data table; a table the engine left untitled is named by its header. `fits`
 * leaves the pager out when every row is on the one page; `heading={false}` leaves the visible title to the screen,
 * which prints its own, and keeps the title as the table's name.
 */
export function KeyTable({
  table,
  fits = false,
  heading = true,
  dim,
}: {
  table: PageTable;
  /** Columns printed in the quiet ink (a read-only cell). */
  dim?: (column: number) => boolean;
  fits?: boolean;
  heading?: boolean;
}) {
  const headingId = useId();
  const rows = useMemo(() => table.rows.map((cells, at) => ({ at, cells })), [table]);
  const columns = useMemo(
    () =>
      columnsOf(table, rows).map((column, at) =>
        dim?.(at) === true
          ? {
              ...column,
              cell: (row: Row) => <span className="text-neutral-600">{column.cell(row)}</span>,
            }
          : column,
      ),
    [table, rows, dim],
  );
  const caption = table.title === '' ? table.header.join(' · ') : table.title;
  const labels = useTableLabels(caption);
  const view = usePagedRows(rows, columns);
  const titled = heading && table.title !== '';
  if (table.heat === true)
    return (
      <HeatTable
        title={table.title === '' ? null : table.title}
        header={table.header}
        rows={table.rows}
      />
    );
  return (
    <section aria-labelledby={titled ? headingId : undefined} className="flex flex-col gap-2">
      {!titled ? null : (
        <h3 id={headingId} className="text-body font-semibold">
          {table.title}
        </h3>
      )}
      <DataTable
        columns={columns}
        rows={view.rows}
        rowKey={(row) => String(row.at)}
        total={view.total}
        page={view.page}
        pageSize={view.pageSize}
        sort={view.sort}
        labels={labels}
        onSort={view.onSort}
        onPage={view.onPage}
        hidePagerWhenFits={fits}
      />
    </section>
  );
}

/** A chart in its own card: it draws in once, names its series in a legend from two up and keeps the numbers behind a button. */
export function KeyChart({ spec }: { spec: ChartSpec }) {
  return (
    <Card fill>
      <Chart spec={drawnChart(spec)} />
    </Card>
  );
}

/**
 * The tables and charts of a page for a template's main region: charts two to a row, each table the whole row.
 * KPIs go to the template's figures row, so a screen places them itself.
 */
export function KeyBody({
  tables,
  charts,
  renderTable,
  fits,
}: {
  tables: readonly PageTable[];
  charts: readonly ChartSpec[];
  /** A screen's own card for one table (A4's Specialization); every other table keeps the shared one. */
  renderTable?: (table: PageTable) => ReactNode;
  /** Leave a table's pager out when its rows fit on one page. */
  fits?: boolean;
}): ReactNode {
  return (
    <>
      {charts.map((spec, at) => (
        <div key={`${spec.title}-${at}`} data-span={charts.length === 1 ? 'full' : undefined}>
          <KeyChart spec={spec} />
        </div>
      ))}
      {tables.map((table, at) => (
        <div key={`${table.title}-${at}`} data-span="full">
          {renderTable?.(table) ?? <KeyTable table={table} fits={fits} />}
        </div>
      ))}
    </>
  );
}
