import { Fragment, type ReactNode } from 'react';
import { Chart } from '../../ui/chart/chart.js';
import { Stack } from '../../ui/layout.js';
import type { FigureContent } from './figure-content.js';
import { DataTable, HeatTable, StatCard } from './parts.js';
import type { PageTable } from './page-content.js';
import { SortTable } from './sort-table.js';

export type PageContent = Extract<FigureContent, { kind: 'page' }>;

/**
 * A key-shaped engine page (packet 40e-1, extended by 41e-1): its KPIs, tables and charts in the kit's own
 * pieces, so the log, A1 and A4 share one renderer. The page title, KPI labels, table titles and cells are the
 * engine's printed data; the charts carry catalogue titles because the engine sends only their id. A table the
 * mapper marks sortable opens in the one sortable table; `renderTable` lets a screen own one card
 * without forking the renderer.
 */
export function PageFigure({
  content,
  renderTable,
}: {
  content: PageContent;
  renderTable?: (table: PageTable, index: number) => ReactNode;
}) {
  return (
    <Stack gap={4}>
      {content.title === '' ? null : <h2 className="text-title3 font-semibold">{content.title}</h2>}
      {content.kpis.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {content.kpis.map((kpi, index) => (
            <li key={`${kpi.label}-${index}`}>
              <StatCard label={kpi.label} value={kpi.value} sub={kpi.sub} />
            </li>
          ))}
        </ul>
      ) : null}
      {content.tables.map((table, index) => {
        const replaced = renderTable?.(table, index);
        const key = `${table.title}-${index}`;
        if (replaced !== undefined) return <Fragment key={key}>{replaced}</Fragment>;
        if (table.heat === true)
          return (
            <HeatTable
              key={key}
              title={table.title === '' ? null : table.title}
              header={table.header}
              rows={table.rows}
            />
          );
        return table.sortable === true ? (
          <SortTable
            key={key}
            title={table.title === '' ? null : table.title}
            header={table.header}
            rows={table.rows}
          />
        ) : (
          <DataTable
            key={key}
            title={table.title === '' ? null : table.title}
            header={table.header}
            rows={table.rows}
          />
        );
      })}
      {content.charts.map((spec, index) => (
        <Chart key={`${spec.title}-${index}`} spec={spec} />
      ))}
    </Stack>
  );
}
