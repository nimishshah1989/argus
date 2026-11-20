import { useSearchParams } from 'react-router-dom';
import { EngineTable } from '../../../ui/v2/domain/engine-table.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { DrillAction } from '../../../ui/v2/drill-action.js';
import { KpiCard } from '../../../ui/v2/kpi-card.js';
import { Row } from '../../../ui/v2/row.js';
import { Segmented } from '../../../ui/v2/segmented.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { EntityShell } from '../entity/EntityShell.js';
import type { RegistersModel } from './model.js';

const REGISTER_PARAM = 'register';

/**
 * The Machines register: one page per register (CNC, Conventional, Process, Utilities, DG, Robots), each opening
 * with its count, load and age, then the controller and make splits, the by-category table and the machine list. The
 * register in view is in the URL, so a link opens it and Back leaves it. A machine or a cell opens in the drawer.
 */
export function RegistersView({
  model,
  nav,
  title,
}: {
  model: RegistersModel;
  nav: NavItem[];
  title: string;
}) {
  const [params, setParams] = useSearchParams();
  const page = model.pages.find((p) => p.id === params.get(REGISTER_PARAM)) ?? model.pages[0];
  const choose = (id: string) =>
    setParams(
      (was) => {
        const next = new URLSearchParams(was);
        next.set(REGISTER_PARAM, id);
        return next;
      },
      { replace: true },
    );
  return (
    <EntityShell nav={nav} title={title}>
      {page ? (
        <>
          <Segmented
            label={model.words.tabs}
            options={model.pages.map((p) => ({ key: p.id, label: p.label }))}
            value={page.id}
            onChange={choose}
          />
          <Verdict verdict={page.verdict} whyLabel={model.words.why} />
          {model.drill ? <DrillAction drill={model.drill} /> : null}
          <Row cols={page.kpis.length >= 4 ? 4 : page.kpis.length === 2 ? 2 : 3}>
            {page.kpis.map((kpi) => (
              <KpiCard key={kpi.id} kpi={kpi} />
            ))}
          </Row>
          {page.tables.map((table) => (
            <EngineTable key={`${page.id}-${table.id}`} table={table} />
          ))}
          <SourceLine text={model.source} />
        </>
      ) : null}
    </EntityShell>
  );
}
