import { useEffect, useRef, useState } from 'react';
import { ToggleGroup } from 'radix-ui';
import { useTranslation } from 'react-i18next';
import {
  BIG_HOURS,
  LAST_FULL,
  fixed,
  metricOf,
  monthLong,
  type Metric,
  type MetricId,
} from './data.js';
import { Delta } from './delta.js';
import { trendOption } from './trend-option.js';
import { useEchart } from './use-echart.js';

/** The month pointed at in a chart other than the trend. */
export const pointed = (month: number | null): Hover => ({ month, from: 'other' });

export interface Hover {
  month: number | null;
  from: 'trend' | 'other';
}

const CHOICES: MetricId[] = ['availability', 'downtime', 'mtbf'];

function MetricToggle({ id, onChange }: { id: MetricId; onChange: (id: MetricId) => void }) {
  const { t } = useTranslation('showcase');
  return (
    <ToggleGroup.Root
      type="single"
      value={id}
      onValueChange={(v) => v && onChange(v as MetricId)}
      aria-label={t('trend.metric')}
      className="sc-toggle"
    >
      {CHOICES.map((c) => (
        <ToggleGroup.Item key={c} value={c} className="sc-toggle-item" data-testid={`trend-${c}`}>
          {t(`toggle.${c}`)}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

/** A small key above the chart: the line, the usual-range band and the marker for a day-long breakdown. */
function Key({ metric }: { metric: Metric }) {
  const { t } = useTranslation('showcase');
  return (
    <ul className="sc-key">
      <li>
        <span className="sc-key-line" />
        {t(`trend.${metric.id}`)}
      </li>
      <li>
        <span className="sc-key-band" />
        {t('trend.range')}
      </li>
      <li>
        <span className="sc-key-pin" />
        {t('trend.big', { n: BIG_HOURS })}
      </li>
    </ul>
  );
}

/**
 * The hero: the figure by month with its usual range, a marker on every month that had a breakdown of a day or
 * more, a crosshair and a designed tooltip, and a slider to look at a stretch. Pointing at a month tells the rest of
 * the page (`onHover`), and the page can point back (`hover`).
 */
export function TrendChart({ hover, onHover }: { hover: Hover; onHover: (h: Hover) => void }) {
  const { t, i18n } = useTranslation('showcase');
  const [id, setId] = useState<MetricId>('availability');
  const metric = metricOf(id);
  const emit = useRef(onHover);
  emit.current = onHover;
  const { ref, chart, ready } = useEchart(
    (ink) => trendOption(ink, metric, t),
    [id, i18n.language],
    (instance) => {
      instance.on('updateAxisPointer', (e: unknown) => {
        const value = (e as { axesInfo?: { value: number | string }[] }).axesInfo?.[0]?.value;
        if (typeof value === 'number') emit.current({ month: value, from: 'trend' });
      });
      instance.on('globalout', () => emit.current({ month: null, from: 'trend' }));
    },
  );
  useEffect(() => {
    if (!ready || hover.from === 'trend') return;
    chart.current?.dispatchAction(
      hover.month === null
        ? { type: 'hideTip' }
        : { type: 'showTip', seriesIndex: 0, dataIndex: hover.month },
    );
  }, [hover, ready, chart]);
  const shown = hover.month ?? LAST_FULL;
  return (
    <section className="sc-card sc-hero" aria-labelledby="sc-trend-title">
      <header className="sc-card-head">
        <div>
          <h2 id="sc-trend-title">{t('trend.title')}</h2>
          <p className="sc-sum" aria-live="polite">
            {t('trend.sum', {
              metric: t(`trend.${id}`),
              month: monthLong(shown),
              value: `${fixed(metric.values[shown], metric.digits)}${metric.unit ? ` ${metric.unit}` : ''}`,
            })}{' '}
            <Delta metric={metric} i={shown} />
          </p>
        </div>
        <MetricToggle id={id} onChange={setId} />
      </header>
      <Key metric={metric} />
      <div
        ref={ref}
        className="sc-chart sc-chart-hero"
        data-testid="trend-chart"
        role="img"
        aria-label={t('trend.title')}
      />
    </section>
  );
}
