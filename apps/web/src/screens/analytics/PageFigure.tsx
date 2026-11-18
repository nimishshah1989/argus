import { Chart } from '../../ui/chart/chart.js';
import { Stack } from '../../ui/layout.js';
import type { FigureContent } from './figure-content.js';
import { DataTable, StatCard } from './parts.js';

export type PageContent = Extract<FigureContent, { kind: 'page' }>;

/**
 * A key-shaped engine page (packet 40e-1): its KPIs, tables and charts in the kit's own pieces, so the log and
 * A1 share one renderer. The page title, KPI labels, table titles and cells are the engine's printed data; the
 * two A1 charts carry catalogue titles because the engine sends only their id.
 */
export function PageFigure({ content }: { content: PageContent }) {
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
      {content.tables.map((table, index) => (
        <DataTable
          key={`${table.title}-${index}`}
          title={table.title === '' ? null : table.title}
          header={table.header}
          rows={table.rows}
        />
      ))}
      {content.charts.map((spec, index) => (
        <Chart key={`${spec.title}-${index}`} spec={spec} />
      ))}
    </Stack>
  );
}
