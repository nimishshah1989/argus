import { useChart, type ChartSpec } from '../chart/use-chart.js';

/**
 * A chart the engine sent, through the chart door: a card with its title, one quiet line under it and a sentence for
 * screen readers. Bars, lines and bubbles all draw from their spec; nothing is recomputed here.
 */
export function ChartCard({ spec, sub, aria }: { spec: ChartSpec; sub: string; aria: string }) {
  const { ref, state } = useChart(
    spec.kind === 'scatter' ? spec : ({ ...spec, draw: true } as ChartSpec),
  );
  return (
    <section className="v2-card v2-pad" aria-label={spec.title}>
      <div className="v2-card-head">
        <div>
          <h2 className="v2-h2">{spec.title}</h2>
          <p className="v2-sub">{sub}</p>
        </div>
      </div>
      <div ref={ref} className="v2-trend" role="img" aria-label={aria} data-chart-state={state} />
    </section>
  );
}
