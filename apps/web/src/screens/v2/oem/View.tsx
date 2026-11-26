import { EngineTable } from '../../../ui/v2/domain/engine-table.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { TileSet } from '../../../ui/v2/tile-set.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { EntityShell } from '../entity/EntityShell.js';
import { numberIn } from '../figures/read.js';
import type { OemModel } from './model.js';

/**
 * OEM analytics: the answer first (how many hours on young machines are the maker's or commissioning), the six
 * figures, then the young machines against their older peers, by make and model, the faults that repeat, and every
 * breakdown behind them.
 */
export function OemView({ model, nav, title }: { model: OemModel; nav: NavItem[]; title: string }) {
  return (
    <EntityShell nav={nav} title={title}>
      <Verdict verdict={model.verdict} whyLabel={model.words.why} />
      <TileSet items={model.kpis.map((kpi) => ({ kpi, n: numberIn(kpi.value) ?? Number.NaN }))} />
      {model.tables.map((table) => (
        <EngineTable key={table.id} table={table} />
      ))}
      <SourceLine text={model.source} />
    </EntityShell>
  );
}
