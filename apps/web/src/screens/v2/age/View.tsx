import { EngineTable } from '../../../ui/v2/domain/engine-table.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { DrillAction } from '../../../ui/v2/drill-action.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { TileSet } from '../../../ui/v2/tile-set.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { EntityShell } from '../entity/EntityShell.js';
import { numberIn } from '../figures/read.js';
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
      <TileSet items={model.kpis.map((kpi) => ({ kpi, n: numberIn(kpi.value) ?? Number.NaN }))} />
      <EngineTable table={model.bands} />
      <SourceLine text={model.source} />
    </EntityShell>
  );
}
