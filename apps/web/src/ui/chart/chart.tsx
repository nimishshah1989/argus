import { useTranslation } from 'react-i18next';
import { useChart, type ChartSpec } from './use-chart.js';

interface TableView {
  categoryLabel: string;
  categories: string[];
  series: { name: string; values: (number | undefined)[] }[];
}

/** The one table every kind shares: categories down, series across. */
function tableView(spec: ChartSpec): TableView {
  if (spec.kind === 'scatter') {
    return {
      categoryLabel: spec.machineLabel,
      categories: spec.points.map((point) => point.label),
      series: [
        { name: spec.xLabel, values: spec.points.map((point) => point.x) },
        { name: spec.yLabel, values: spec.points.map((point) => point.y) },
        { name: spec.mttrLabel, values: spec.points.map((point) => point.mttr) },
      ],
    };
  }
  if (spec.kind === 'mixed') {
    return {
      categoryLabel: spec.categoryLabel,
      categories: spec.categories,
      series: [...spec.bars, ...(spec.line === undefined ? [] : [spec.line])],
    };
  }
  return { categoryLabel: spec.categoryLabel, categories: spec.categories, series: spec.series };
}

/** A chart with its numbers in a table underneath; colour is never the only signal. */
export function Chart({ spec }: { spec: ChartSpec }) {
  const { t } = useTranslation();
  const { ref, state } = useChart(spec);
  const table = tableView(spec);
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-body font-semibold">{spec.title}</figcaption>
      <div
        ref={ref}
        data-testid="chart"
        data-chart-state={state}
        role="img"
        aria-label={t('kit.chart.label', { title: spec.title })}
        className="h-48 w-full"
      />
      {state === 'error' ? (
        <p className="text-footnote text-neutral-600">{t('kit.chart.unavailable')}</p>
      ) : null}
      <details>
        <summary className="flex min-h-target cursor-pointer items-center text-body font-semibold text-accent-strong">
          {t('kit.chart.table')}
        </summary>
        <table className="w-full text-left text-footnote">
          <thead>
            <tr>
              {}
              <th scope="col" className="p-2">
                {table.categoryLabel}
              </th>
              {table.series.map((s) => (
                <th key={s.name} scope="col" className="p-2">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.categories.map((category, row) => (
              <tr key={category} className="border-t border-neutral-200">
                {}
                <th scope="row" className="p-2">
                  {category}
                </th>
                {table.series.map((s) => (
                  <td key={s.name} className="p-2 tabular-nums">
                    {s.values[row]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
