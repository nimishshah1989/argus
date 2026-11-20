import { useState } from 'react';
import { BulletBar, BulletLegend } from '../../../ui/v2/bullet-bar.js';
import { Button } from '../../../ui/v2/button.js';
import { DecisionList } from '../../../ui/v2/domain/decision-list.js';
import { MachineTable } from '../../../ui/v2/domain/machine-table.js';
import { PlantMap } from '../../../ui/v2/domain/plant-map.js';
import { KpiCard } from '../../../ui/v2/kpi-card.js';
import { Panel } from '../../../ui/v2/panel.js';
import { Pareto } from '../../../ui/v2/pareto.js';
import { Row } from '../../../ui/v2/row.js';
import { Shell, type NavItem } from '../../../ui/v2/shell.js';
import { TrendChart } from '../../../ui/v2/trend-chart.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { drawerFor, type Acts, type Kind, type Selection } from './drawer.js';
import type { DashboardActions, DashboardModel } from './model.js';

const ignore = () => {};
/** What a part of the page needs to open its item in the drawer, and to show which item is open. */
type Opener = { selected?: string; onOpen: (id: string) => void };

/** Where the hours go, ending in its two next steps. */
function ParetoCard({ model, act }: { model: DashboardModel; act: Acts }) {
  const { words } = model;
  return (
    <Panel title={words.paretoTitle}>
      <Pareto
        data={model.pareto}
        whyLabel={words.whyThese}
        actions={
          <>
            <Button primary onClick={act.onAddFocus}>
              {words.addFocus}
            </Button>
            <Button onClick={act.onSeeFixes}>{words.seeFixes}</Button>
          </>
        }
      />
    </Panel>
  );
}

/** The page under the header, top to bottom; `decision` and `machine` open their items in the drawer. */
function Body({
  model,
  act,
  decision,
  machine,
}: {
  model: DashboardModel;
  act: Acts;
  decision: Opener;
  machine: Opener;
}) {
  const { words } = model;
  return (
    <>
      <Verdict verdict={model.verdict} whyLabel={words.why} />
      <Row cols={4}>
        {model.kpis.map((k) => (
          <KpiCard key={k.id} kpi={k} />
        ))}
      </Row>
      <DecisionList
        decisions={model.decisions}
        words={words.decisions}
        {...decision}
        onDecide={act.onDecide}
        onUndo={act.onUndo}
      />
      <Row wide>
        <TrendChart data={model.trend} />
        <Panel title={words.targetTitle}>
          {model.bullets.map((b) => (
            <BulletBar key={b.id} b={b} />
          ))}
          <BulletLegend words={words.legend} />
        </Panel>
      </Row>
      <Row wide>
        <ParetoCard model={model} act={act} />
        <PlantMap cells={model.cells} words={words.plant} {...machine} />
      </Row>
      <MachineTable
        machines={model.cells.flatMap((c) => c.machines)}
        words={words.machines}
        {...machine}
      />
    </>
  );
}

/**
 * The decision-first Dashboard: the verdict, four key figures, the decisions, the trend beside the targets, where the
 * hours go beside the plant, and every machine. A decision, a square or a row opens its detail in the drawer; the
 * same item again, ✕ or Esc closes it.
 */
export function DashboardView({
  model,
  nav,
  title,
  onDecide = ignore,
  onUndo = ignore,
  onAddFocus = ignore,
  onSeeFixes = ignore,
}: { model: DashboardModel; nav: NavItem[]; title: string } & DashboardActions) {
  const [open, setOpen] = useState<Selection>(null);
  const act: Acts = { onDecide, onUndo, onAddFocus, onSeeFixes };
  const opener = (kind: Kind): Opener => ({
    selected: open?.kind === kind ? open.id : undefined,
    onOpen: (id) => setOpen((was) => (was?.kind === kind && was.id === id ? null : { kind, id })),
  });
  const decision = opener('decision');
  const machine = opener('machine');
  const drawer = drawerFor(model, open, () => setOpen(null), act);
  return (
    <Shell nav={nav} title={title} drawer={drawer}>
      <Body model={model} act={act} decision={decision} machine={machine} />
    </Shell>
  );
}
