import { EngineTable } from '../../../ui/v2/domain/engine-table.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { DrillAction } from '../../../ui/v2/drill-action.js';
import { KpiCard } from '../../../ui/v2/kpi-card.js';
import { Row } from '../../../ui/v2/row.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { EntityShell } from '../entity/EntityShell.js';
import type { AgeModel } from './model.js';

/**
 * Age analysis: the answer first (which band of machines loses the most hours each), a card per age band, then the
 * band table with the hours, the fleet behind each band and how its average was worked out.
 */
export function AgeView({ model, nav, title }: { model: AgeModel; nav: NavItem[]; title: string }) {
  return (
    <EntityShell nav={nav} title={title}>
      <Verdict verdict={model.verdict} whyLabel={model.words.why} />
      {model.drill ? <DrillAction drill={model.drill} /> : null}
      <Row cols={3}>
        {model.kpis.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} />
        ))}
      </Row>
      <EngineTable table={model.bands} />
      <SourceLine text={model.source} />
    </EntityShell>
  );
}
