/* eslint-disable i18next/no-literal-string -- typed keys only; every visible word comes from the model */
import { Link } from 'react-router-dom';
import { ChartCard } from '../../../ui/v2/chart-card.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { EngineTable } from '../../../ui/v2/domain/engine-table.js';
import { EntityChip } from '../../../ui/v2/entity-chip.js';
import { KeyPill } from '../../../ui/v2/key-pill.js';
import { KpiCard } from '../../../ui/v2/kpi-card.js';
import { Panel } from '../../../ui/v2/panel.js';
import { Pareto } from '../../../ui/v2/pareto.js';
import { Row } from '../../../ui/v2/row.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { EntityShell } from '../entity/EntityShell.js';
import type { DashboardModel, NeedItem, NeedsNowModel } from './model.js';

/** One ticket that needs a person: where, what it is, how long, which clock ran out, and the way to its page. */
function Need({ item, open }: { item: NeedItem; open: string }) {
  return (
    <li className="v2-item" data-need={item.id}>
      <div className="v2-row v2-gap-8">
        {item.where.chip ? <EntityChip {...item.where.chip} /> : <span>{item.where.text}</span>}
        <span className="v2-sub">{item.ref}</span>
        {item.breach ? <KeyPill text={item.breach} tone="loss" icon="alert" /> : null}
      </div>
      <p>{item.problem}</p>
      <p className="v2-sub">{item.line}</p>
      <Link className="v2-btn v2-btn-ghost" to={item.href}>
        {open}
      </Link>
    </li>
  );
}

/** What needs a person now: the count line, then each ticket, or the all-clear. */
function NeedsNow({ needs }: { needs: NeedsNowModel }) {
  return (
    <Panel title={needs.title} sub={needs.counts} flush>
      {needs.items.length === 0 ? (
        <p className="v2-sub v2-item">{needs.empty}</p>
      ) : (
        <ul className="v2-list">
          {needs.items.map((item) => (
            <Need key={item.id} item={item} open={needs.open} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

/**
 * The Dashboard on the engine's own figures: the verdict, the Action Center's counts, what needs a person now, every
 * `dashboard.*` figure as a card in its own period with its change and the rows behind it, the costliest problems, and
 * the two pictures. A chip opens that machine in the drawer, which lives in the URL.
 */
export function DashboardView({
  model,
  nav,
  title,
}: {
  model: DashboardModel;
  nav: NavItem[];
  title: string;
}) {
  const { words } = model;
  return (
    <EntityShell nav={nav} title={title}>
      <Verdict verdict={model.verdict} whyLabel={words.why} />
      {model.banner ? (
        <div className="v2-card v2-pad v2-row v2-gap-8" data-banner="action-center">
          <KeyPill text={model.banner.text} tone="risk" icon="alert" />
          <Link className="v2-btn v2-btn-primary" to={model.banner.href}>
            {words.openActionCenter}
          </Link>
        </div>
      ) : null}
      {model.needs ? <NeedsNow needs={model.needs} /> : null}
      <Row cols={4}>
        {model.kpis.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} />
        ))}
      </Row>
      {model.costliest ? (
        <div className="v2-stack" data-kpi="dashboard.costliest-problems">
          <Panel title={model.costliest.title}>
            <Pareto data={model.costliest.pareto} whyLabel={words.why} actions={null} />
          </Panel>
          <EngineTable table={model.costliest.table} />
        </div>
      ) : null}
      <Row>
        {model.charts.map((chart) => (
          <ChartCard
            key={chart.id}
            spec={chart.spec}
            sub={chart.sub}
            aria={chart.aria}
            drill={chart.drill}
            id={chart.id}
          />
        ))}
      </Row>
      <SourceLine text={model.source} />
    </EntityShell>
  );
}
