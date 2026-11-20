import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tableView } from '../chart/chart-table.js';
import type { ChartSpec } from '../chart/use-chart.js';

const shown = (value: string | number | undefined): string =>
  typeof value === 'number'
    ? value.toLocaleString('en-IN', { maximumFractionDigits: 2 })
    : (value ?? '—');

/** The numbers a chart plots, categories down and series across: the table v1's "Show the numbers" opened. */
export function NumbersTable({ spec }: { spec: ChartSpec }) {
  const table = tableView(spec);
  return (
    <div className="v2-table-scroll">
      <table className="v2-table v2-chart-numbers">
        <thead>
          <tr>
            <th scope="col">{table.categoryLabel}</th>
            {table.series.map((series) => (
              <th key={series.name} scope="col" className="v2-num-head">
                {series.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.categories.map((category, row) => (
            <tr key={`${category}-${row}`}>
              <th scope="row">{category}</th>
              {table.series.map((series) => (
                <td key={series.name} className="v2-num-cell">
                  {shown(series.values[row])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * "Show the numbers" under a chart, as in v1: a disclosure that holds the plotted numbers, so colour and shape are
 * never the only signal. The table is built only once it is opened, so a closed chart adds nothing to the page.
 */
export function ChartNumbers({ spec }: { spec: ChartSpec }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <details className="v2-numbers" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{t('kit.chart.table')}</summary>
      {open ? <NumbersTable spec={spec} /> : null}
    </details>
  );
}
