import { useId, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../ui/card.js';
import { Chart } from '../../ui/chart/chart.js';
import type { ChartSpec } from '../../ui/chart/use-chart.js';
import {
  DataTable,
  KpiTile,
  NO_VALUE,
  useClientTable,
  type Column,
  type TableLabels,
} from '../../ui/elements/index.js';
import { drawnChart } from './key-chart.js';
import type { PageKpi, PageTable } from './page-content.js';
import { cellNumber, isMissing } from './sort-table.js';

/**
 * The inside of a key-shaped engine page on the shared elements (ticket 87): its KPIs as tiles, its tables in the
 * one data table, its charts in a card through the chart door. Every printed string is the engine's own and is
 * shown as it came: a figure is never parsed back into a number to be printed again.
 */

/** A KPI the engine printed: its text is the value, so the tile prints it whole and never counts it up. */
export function KeyKpi({ kpi }: { kpi: PageKpi }) {
  return (
    <KpiTile
      label={kpi.label}
      value={isMissing(kpi.value) ? null : 0}
      format={() => kpi.value}
      note={kpi.sub ?? undefined}
    />
  );
}

/** One engine row with its place in the engine's order, which is its key however the table is sorted. */
interface Row {
  at: number;
  cells: readonly string[];
}

/** A column is numeric when every printed cell that is not a dash is a number: it aligns right and sorts as one. */
function isNumeric(rows: readonly Row[], at: number): boolean {
  const cells = rows.map((row) => row.cells[at] ?? '').filter((cell) => !isMissing(cell));
  return cells.length > 0 && cells.every((cell) => cellNumber(cell) !== null);
}

/** The columns of an engine table: a header per cell, sorted by the number it carries (a dash sorts last). */
export function columnsOf(table: PageTable, rows: readonly Row[]): Column<Row>[] {
  return table.header.map((header, at) => {
    const numeric = isNumeric(rows, at);
    const printed = (row: Row) => row.cells[at] ?? '';
    return {
      id: String(at),
      header,
      numeric,
      cell: (row) => (isMissing(printed(row)) ? NO_VALUE : printed(row)),
      ...(table.sortable === true
        ? {
            sortValue: (row: Row): number | string => {
              if (isMissing(printed(row))) return Number.NaN;
              return numeric ? (cellNumber(printed(row)) ?? Number.NaN) : printed(row);
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

/** One engine table: its title over the data table; a table the engine left untitled is named by its header. */
export function KeyTable({ table }: { table: PageTable }) {
  const headingId = useId();
  const rows = useMemo(() => table.rows.map((cells, at) => ({ at, cells })), [table]);
  const columns = useMemo(() => columnsOf(table, rows), [table, rows]);
  const caption = table.title === '' ? table.header.join(' · ') : table.title;
  const labels = useTableLabels(caption);
  const view = useClientTable(rows, columns, (row) => row.cells.join(' '), 50);
  return (
    <section
      aria-labelledby={table.title === '' ? undefined : headingId}
      className="flex flex-col gap-2"
    >
      {table.title === '' ? null : (
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
}: {
  tables: readonly PageTable[];
  charts: readonly ChartSpec[];
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
          <KeyTable table={table} />
        </div>
      ))}
    </>
  );
}
