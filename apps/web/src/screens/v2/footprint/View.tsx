import { EngineTable } from '../../../ui/v2/domain/engine-table.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { KpiCard } from '../../../ui/v2/kpi-card.js';
import { Row } from '../../../ui/v2/row.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { TrendChart } from '../../../ui/v2/trend-chart.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { EntityShell } from '../entity/EntityShell.js';
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
      <Row cols={model.kpis.length >= 5 ? 3 : 2}>
        {model.kpis.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} />
        ))}
      </Row>
      {model.growth ? <TrendChart data={model.growth} /> : null}
      {model.tables.map((table) => (
        <EngineTable key={table.id} table={table} />
      ))}
      <SourceLine text={model.source} />
    </EntityShell>
  );
}
