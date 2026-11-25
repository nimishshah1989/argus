import { EngineTable } from '../../../ui/v2/domain/engine-table.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { TileSet } from '../../../ui/v2/tile-set.js';
import { TrendChart } from '../../../ui/v2/trend-chart.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { EntityShell } from '../entity/EntityShell.js';
import { numberIn } from '../figures/read.js';
import type { FootprintModel } from './model.js';

/**
 * Footprint: how much floor the fleet needs and where its space goes. The answer first, five cards, the growth of the
 * fleet's area by purchase year, then the tables by category, cell, location and year, and the ten largest machines.
 */
export function FootprintView({
  model,
  nav,
  title,
}: {
  model: FootprintModel;
  nav: NavItem[];
  title: string;
}) {
  return (
    <EntityShell nav={nav} title={title}>
      <Verdict verdict={model.verdict} whyLabel={model.words.why} />
      <TileSet items={model.kpis.map((kpi) => ({ kpi, n: numberIn(kpi.value) ?? Number.NaN }))} />
      {model.growth ? <TrendChart data={model.growth} /> : null}
      {model.tables.map((table) => (
        <EngineTable key={table.id} table={table} />
      ))}
      <SourceLine text={model.source} />
    </EntityShell>
  );
}
