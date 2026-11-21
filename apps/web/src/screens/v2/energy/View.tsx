import { ChartCard } from '../../../ui/v2/chart-card.js';
import { useWhy, WhyButton } from '../../../ui/v2/why-toggle.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { HeatTiles } from '../../../ui/v2/domain/heat-tiles.js';
import { DrillAction, Section } from '../../../ui/v2/drill-action.js';
import { FigureTile } from '../../../ui/v2/figure-tile.js';
import { Row } from '../../../ui/v2/row.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { EntityShell } from '../entity/EntityShell.js';
import type { EnergyGridModel, EnergyModel } from './model.js';

/** A map's chart, kept behind a "Chart view" button under its tiles: the tiles already print every number it plots. */
function ChartView({
  chart,
  label,
}: {
  chart: NonNullable<EnergyGridModel['chart']>;
  label: string;
}) {
  const why = useWhy();
  return (
    <>
      <div>
        <WhyButton why={why} label={label} />
      </div>
      <div id={why.id} hidden={!why.open}>
        {why.open ? <ChartCard spec={chart.spec} sub={chart.sub} aria={chart.aria} /> : null}
      </div>
    </>
  );
}

/**
 * Energy: the answer first, the plant's connected and running load, then the three maps, tiles leading. Each tile is
 * tinted by its weight against its own map (the legend says the figures at its ends) and prints its figure, so the tint
 * is never the only sign; a tile with machines opens them in the drawer, and so does the page action for the whole
 * figure. A map's chart sits behind its "Chart view" button.
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
          <HeatTiles
            title={grid.title}
            tiles={grid.tiles}
            words={model.words.heat}
            scale={grid.scale}
          />
          {grid.chart ? <ChartView chart={grid.chart} label={model.words.chartView} /> : null}
        </Section>
      ))}
      <SourceLine text={model.source} />
    </EntityShell>
  );
}
