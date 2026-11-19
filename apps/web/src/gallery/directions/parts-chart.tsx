/* eslint-disable i18next/no-literal-string -- only class names, style values and CSS variable names remain; every word goes through t() */
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useChart } from '../../ui/chart/use-chart.js';
import { DISPLAY_STYLE } from './direction-props.js';
import { keySlot, type SeriesChart } from './chart-key.js';
import { formatIN, type Variant } from './variant.js';

export type { SeriesChart };

function seriesOf(spec: SeriesChart): { name: string; values: (number | undefined)[] }[] {
  if (spec.kind === 'mixed') return [...spec.bars, ...(spec.line ? [spec.line] : [])];
  return spec.series;
}

/** Where the key sits: chips above the chart, text beside the title, or a row below. */
function Key({ place, spec }: { place: Variant['legend']; spec: SeriesChart }) {
  const chip = place === 'above' ? 'border border-neutral-200 bg-surface px-2 py-1' : '';
  return (
    <ul data-legend={place} className="flex flex-wrap gap-x-3 gap-y-1">
      {seriesOf(spec).map(({ name }, i) => (
        <li
          key={name}
          className={`flex items-center gap-1 text-caption text-neutral-600 ${chip}`}
          style={place === 'above' ? { borderRadius: 'var(--proto-radius-chip)' } : undefined}
        >
          <span
            aria-hidden="true"
            className="inline-block h-2 w-4"
            style={{ background: `var(--color-chart-${keySlot(spec, i) + 1})` }}
          />
          {name}
        </li>
      ))}
    </ul>
  );
}

/** The chart's numbers as a table (prototype only: the kit's `Chart` keeps its own, and 81 deletes this one). */
function Numbers({ spec }: { spec: SeriesChart }) {
  const { t } = useTranslation();
  const series = seriesOf(spec);
  return (
    <details>
      <summary className="flex min-h-target-min cursor-pointer items-center text-footnote font-semibold text-accent-text">
        {t('kit.chart.table')}
      </summary>
      <table className="w-full text-left text-footnote">
        <thead>
          <tr>
            <th scope="col" className="p-2">
              {spec.categoryLabel}
            </th>
            {series.map((s) => (
              <th key={s.name} scope="col" className="p-2">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spec.categories.map((category, row) => (
            <tr key={category} className="border-t border-neutral-200">
              <th scope="row" className="p-2">
                {category}
              </th>
              {series.map((s) => (
                <td key={s.name} className="p-2">
                  {s.values[row] === undefined ? '—' : formatIN(s.values[row])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** A level-1 card on surface, a panel on surface-2, or a stretch between two rules on the page. */
const FRAME: Record<Variant['chartFrame'], string> = {
  card: 'bg-surface p-3',
  panel: 'border border-neutral-200 bg-neutral-50 p-3',
  rules: 'border-y border-neutral-200 py-3',
};

/** One chart in the direction's frame, height and key place, drawn by the kit's own `useChart`. */
export function FramedChart({ variant, spec }: { variant: Variant; spec: SeriesChart }) {
  const { t } = useTranslation();
  const { ref, state } = useChart(spec);
  const frame: CSSProperties = {
    borderRadius: variant.chartFrame === 'rules' ? 0 : 'var(--proto-radius-card)',
    boxShadow: 'var(--proto-shadow-raised)',
  };
  return (
    <figure
      data-chart-frame={variant.chartFrame}
      className={`flex min-w-0 flex-col gap-2 ${FRAME[variant.chartFrame]}`}
      style={frame}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-body font-semibold" style={DISPLAY_STYLE}>
          {spec.title}
        </span>
        {variant.legend === 'inline' ? <Key place="inline" spec={spec} /> : null}
      </figcaption>
      {variant.legend === 'above' ? <Key place="above" spec={spec} /> : null}
      <div
        ref={ref}
        data-testid="chart"
        data-chart-state={state}
        role="img"
        aria-label={t('kit.chart.label', { title: spec.title })}
        className="w-full"
        style={{ height: variant.chartHeight }}
      />
      {variant.legend === 'below' ? <Key place="below" spec={spec} /> : null}
      {state === 'error' ? (
        <p className="text-footnote text-neutral-600">{t('kit.chart.unavailable')}</p>
      ) : null}
      <Numbers spec={spec} />
    </figure>
  );
}
