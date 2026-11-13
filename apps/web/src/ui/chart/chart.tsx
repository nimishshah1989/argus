import { useTranslation } from 'react-i18next';
import { useChart, type ChartSpec } from './use-chart.js';

/** A chart with its numbers in a table underneath; colour is never the only signal. */
export function Chart({ spec }: { spec: ChartSpec }) {
  const { t } = useTranslation();
  const { ref, state } = useChart(spec);
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
                {spec.categoryLabel}
              </th>
              {spec.series.map((s) => (
                <th key={s.name} scope="col" className="p-2">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {spec.categories.map((category, row) => (
              <tr key={category} className="border-t border-neutral-200">
                {}
                <th scope="row" className="p-2">
                  {category}
                </th>
                {spec.series.map((s) => (
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
