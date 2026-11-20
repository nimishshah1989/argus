import { ChartCard } from '../../../ui/v2/chart-card.js';
import { LinkButton } from '../../../ui/v2/button.js';
import { EngineTable } from '../../../ui/v2/domain/engine-table.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { DrillButton } from '../../../ui/v2/drill-button.js';
import { KpiCard } from '../../../ui/v2/kpi-card.js';
import { Panel } from '../../../ui/v2/panel.js';
import { Segs } from '../../../ui/v2/points.js';
import { Row } from '../../../ui/v2/row.js';
import { SectionHead } from '../../../ui/v2/section-head.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { WhyToggle } from '../../../ui/v2/why-toggle.js';
import { EntityShell } from '../entity/EntityShell.js';
import type { CostliestModel, DashboardModel, NeedsModel, WarningModel } from './model.js';

/** What needs a person now: the table of tickets, or the plain line that nothing does, or that it could not be read. */
function Needs({ needs }: { needs: NeedsModel }) {
  if (needs.state === 'unavailable')
    return (
      <Panel title={needs.title}>
        <p role="status">{needs.text}</p>
      </Panel>
    );
  if (needs.table) return <EngineTable table={needs.table} />;
  return (
    <Panel title={needs.title} sub={needs.counts}>
      <p>{needs.empty}</p>
    </Panel>
  );
}

function Costliest({ costliest }: { costliest: CostliestModel }) {
  const aside = costliest.drill ? <DrillButton drill={costliest.drill} /> : undefined;
  if (costliest.table) return <EngineTable table={costliest.table} aside={aside} />;
  return (
    <Panel title={costliest.title} sub={costliest.sub} aside={aside}>
      <p>{costliest.empty}</p>
    </Panel>
  );
}

function Warning({ warning }: { warning: WarningModel }) {
  return (
    <Panel title={warning.title} sub={warning.sub}>
      <p className="v2-lede">
        <Segs point={warning.headline} />
      </p>
      <WhyToggle label={warning.whyLabel} points={warning.why} />
    </Panel>
  );
}

/** The Action Center's counts and the way in; nothing when no nudge is open. */
export function ActionCenter({ note }: { note: DashboardModel['actionCenter'] }) {
  if (!note) return null;
  return (
    <Panel title={note.title} aside={<LinkButton href={note.href}>{note.open}</LinkButton>}>
      <p>{note.text}</p>
    </Panel>
  );
}

/** The page under the header, top to bottom: the answer, what needs you, the figures, the problems, the pictures. */
function Body({ model }: { model: DashboardModel }) {
  return (
    <>
      <Verdict verdict={model.verdict} whyLabel={model.words.why} />
      <Needs needs={model.needs} />
      <ActionCenter note={model.actionCenter} />
      {model.sections.map((section) => (
        <section key={section.id} className="v2-stack v2-gap-12" aria-label={section.title}>
          <SectionHead title={section.title} sub={section.sub} />
          <Row cols={section.id === 'fleet' ? 3 : 4}>
            {section.kpis.map((kpi) => (
              <KpiCard key={kpi.id} kpi={kpi} />
            ))}
          </Row>
        </section>
      ))}
      {model.costliest ? <Costliest costliest={model.costliest} /> : null}
      {model.warning ? <Warning warning={model.warning} /> : null}
      {model.charts.map((chart) =>
        'spec' in chart ? (
          <ChartCard
            key={chart.id}
            spec={chart.spec}
            sub={chart.sub}
            aria={chart.aria}
            drill={chart.drill}
          />
        ) : (
          <Panel key={chart.id} title={chart.title}>
            <p role="status">{chart.note}</p>
          </Panel>
        ),
      )}
      {model.machines ? <EngineTable table={model.machines} /> : null}
      <SourceLine text={model.source} />
    </>
  );
}

/**
 * The Dashboard: the answer first, what needs a person now with the ticket behind each item, every figure v1 printed
 * with what it covers, its change against 30 days earlier and the rows behind it, the problems that cost the most, the
 * machines the engine says are failing faster, and the two pictures with the machines they are drawn from. A machine,
 * a cell or a person opens in the drawer, which lives in the URL.
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
  return (
    <EntityShell nav={nav} title={title}>
      <Body model={model} />
    </EntityShell>
  );
}
