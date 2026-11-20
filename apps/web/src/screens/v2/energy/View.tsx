import { ChartCard } from '../../../ui/v2/chart-card.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { HeatTiles } from '../../../ui/v2/domain/heat-tiles.js';
import { DrillAction, Section } from '../../../ui/v2/drill-action.js';
import { FigureTile } from '../../../ui/v2/figure-tile.js';
import { Row } from '../../../ui/v2/row.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { EntityShell } from '../entity/EntityShell.js';
import type { EnergyModel } from './model.js';

/**
 * Energy: the answer first, the plant's connected and running load, then the three maps. Each tile is tinted by its
 * weight against its own map and prints its figure, so the tint is never the only sign; a tile with machines opens
 * them in the drawer, and so does the page action for the whole figure.
 */
export function EnergyView({
  model,
  nav,
  title,
}: {
  model: EnergyModel;
  nav: NavItem[];
  title: string;
}) {
  return (
    <EntityShell nav={nav} title={title}>
      <Verdict verdict={model.verdict} whyLabel={model.words.why} />
      <Row cols={model.figures.length === 4 ? 4 : 3}>
        {model.figures.map((figure) => (
          <FigureTile key={figure.id} figure={figure} />
        ))}
      </Row>
      {model.drill ? (
        <div>
          <DrillAction drill={model.drill} />
        </div>
      ) : null}
      {model.grids.map((grid) => (
        <Section key={grid.id} title={grid.title} sub={grid.sub}>
          {grid.chart ? (
            <ChartCard spec={grid.chart.spec} sub={grid.chart.sub} aria={grid.chart.aria} />
          ) : null}
          <HeatTiles title={grid.title} tiles={grid.tiles} words={model.words.heat} />
        </Section>
      ))}
      <SourceLine text={model.source} />
    </EntityShell>
  );
}
