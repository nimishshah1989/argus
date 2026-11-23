import { useChart, type ChartSpec } from '../chart/use-chart.js';
import { ChartNumbers } from './chart-numbers.js';
import type { Drill } from './drill.js';
import { DrillButton } from './drill-button.js';

/**
 * A chart the engine sent, through the chart door: a card with its title, one quiet line under it and a sentence for
 * screen readers. Bars, lines and bubbles all draw from their spec; nothing is recomputed here. With a `drill`, a
 * button beside the title opens the rows the chart was drawn from. With `numbers`, the plotted numbers sit under the
 * chart behind "Show the numbers", as they did in v1.
 */
export function ChartCard({
  spec,
  sub,
  aria,
  drill,
  numbers,
}: {
  spec: ChartSpec;
  sub: string;
  aria: string;
  drill?: Drill;
  numbers?: boolean;
}) {
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
        {drill ? <DrillButton drill={drill} /> : null}
      </div>
      <div ref={ref} className="v2-trend" role="img" aria-label={aria} data-chart-state={state} />
      {numbers ? <ChartNumbers spec={spec} /> : null}
    </section>
  );
}
