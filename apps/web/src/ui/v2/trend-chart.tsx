import { useChart, type ChartTone } from '../chart/use-chart.js';

export type TrendData = {
  title: string;
  /** One quiet line under the title: the span, and what hovering shows. */
  sub: string;
  /** What the chart says aloud, as one sentence. */
  aria: string;
  categoryLabel: string;
  categories: string[];
  series: { name: string; values: (number | undefined)[]; tone?: ChartTone }[];
};

/**
 * A trend over time through the chart door: drawn in once on first view, a crosshair and a glass tooltip with the
 * exact values at the pointer, and a fresh measure whenever the page reflows (the drawer opening).
 */
export function TrendChart({ data }: { data: TrendData }) {
  const { ref, state } = useChart({
    kind: 'line',
    title: data.title,
    categoryLabel: data.categoryLabel,
    categories: data.categories,
    series: data.series,
    legend: data.series.length > 1,
    draw: true,
    tooltipClass: 'v2-glass-tip',
  });
  return (
    <section className="v2-card v2-pad" aria-label={data.title}>
      <div className="v2-card-head">
        <h2 className="v2-h2">{data.title}</h2>
        <p className="v2-sub">{data.sub}</p>
      </div>
      <div
        ref={ref}
        className="v2-trend"
        role="img"
        aria-label={data.aria}
        data-chart-state={state}
      />
    </section>
  );
}
