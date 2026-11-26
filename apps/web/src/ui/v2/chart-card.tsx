import { useTranslation } from 'react-i18next';
import { useChart, type ChartSpec } from '../chart/use-chart.js';
import { ChartNumbers } from './chart-numbers.js';
import { useDestination, type Drill } from './drill.js';
import { DrillButton } from './drill-button.js';
import { LinkButton } from './button.js';

/**
 * A chart the engine sent, through the chart door: a card with its title, one quiet line under it and a sentence for
 * screen readers. Bars, lines and bubbles all draw from their spec; nothing is recomputed here. With a `drill`, a
 * button beside the title opens the rows the chart was drawn from. With `numbers`, the plotted numbers sit under the
 * chart behind "Show the numbers", as they did in v1. With no `drill` the card looks itself up in the destinations
 * map (ADR 0058), under its screen's default: its rows, or a link to the page that explains it, beside the title. The
 * chart itself stays the reader's to hover (its tooltip and crosshair), so the control is the header button, not the
 * whole card.
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
  const { t } = useTranslation();
  // A chart has no id of its own: the map answers with the screen's default, under the short "See the rows".
  const to = useDestination('', spec.title, { drill });
  const rows = drill ?? (to.drill && { ...to.drill, label: t('analytics.drill.open') });
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
        {rows ? (
          <DrillButton drill={rows} />
        ) : to.link ? (
          <LinkButton href={to.link.href}>{to.link.label}</LinkButton>
        ) : null}
      </div>
      <div className="v2-trend-scroll" data-chart-scroll>
        <div ref={ref} className="v2-trend" role="img" aria-label={aria} data-chart-state={state} />
      </div>
      {numbers ? <ChartNumbers spec={spec} /> : null}
    </section>
  );
}
