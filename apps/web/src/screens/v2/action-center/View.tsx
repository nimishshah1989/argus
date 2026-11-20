/* eslint-disable i18next/no-literal-string -- typed keys and entity kinds only; every visible word comes from the model */
import { useContext, useState } from 'react';
import { fill } from '../../../i18n/fill.js';
import { Button } from '../../../ui/v2/button.js';
import { DataTable, type Column, type FilterChip } from '../../../ui/v2/data-table.js';
import { DecisionList } from '../../../ui/v2/domain/decision-list.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { cellChip, machineChip } from '../../../ui/v2/domain/plant.js';
import { EntityChip, EntityOpenContext } from '../../../ui/v2/entity-chip.js';
import { KeyPill } from '../../../ui/v2/key-pill.js';
import { KpiCard } from '../../../ui/v2/kpi-card.js';
import { Panel } from '../../../ui/v2/panel.js';
import { Points } from '../../../ui/v2/points.js';
import { Row } from '../../../ui/v2/row.js';
import { Segmented } from '../../../ui/v2/segmented.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { EntityShell } from '../entity/EntityShell.js';
import { useEntityParam } from '../entity/url.js';
import { localDecision, type Acts } from './local.js';
import type {
  ActionCenterActions,
  ActionCenterModel,
  ActionCenterWords,
  WatchRow,
} from './model.js';

const ignore = () => {};
type Tab = 'parked' | 'settled';

/** Who owns what, ending in the one action that gives every unowned decision a person. */
function OwnersCard({ model, onAssign }: { model: ActionCenterModel; onAssign: () => void }) {
  return (
    <Panel title={model.words.ownersTitle}>
      <Points points={model.owners} />
      <div>
        <Button primary onClick={onAssign}>
          {model.words.assign}
        </Button>
      </div>
    </Panel>
  );
}

/** The decisions that are not waiting, parked or settled; each names itself, when and who, and opens in the drawer. */
function SettledCard({ model }: { model: ActionCenterModel }) {
  const { words } = model;
  const [tab, setTab] = useState<Tab>('parked');
  const count = (s: Tab) => model.settled.filter((x) => x.status === s).length;
  const shown = model.settled.filter((x) => x.status === tab);
  return (
    <Panel
      title={words.settledTitle}
      aside={
        <Segmented
          label={words.settledLabel}
          value={tab}
          onChange={setTab}
          options={(['parked', 'settled'] as const).map((key) => ({
            key,
            label: fill(words.tabs[key], { n: count(key) }),
          }))}
        />
      }
    >
      {shown.length === 0 ? (
        <p className="v2-sub">{words.settledEmpty}</p>
      ) : (
        <Points points={shown.map((x) => x.line)} />
      )}
    </Panel>
  );
}

const watchFilters = (words: ActionCenterWords['watch']): FilterChip<WatchRow>[] => [
  { key: 'all', label: words.filters.all },
  { key: 'high', label: words.filters.high, test: (r) => r.high > 0 },
  { key: 'medium', label: words.filters.medium, test: (r) => r.medium > 0 },
];

/** The table's four columns: the machine, its score, its open nudges by priority, and the next step. */
function watchColumns(words: ActionCenterWords['watch']): Column<WatchRow>[] {
  const pill = (n: number, text: string, tone: 'loss' | 'risk' | 'neutral') =>
    n > 0 ? <KeyPill key={tone} text={fill(text, { n })} tone={tone} /> : null;
  return [
    {
      key: 'machine',
      label: words.columns.machine,
      sortBy: (r) => r.machine.code,
      cell: (r) => (
        <div className="v2-who">
          <EntityChip {...machineChip(r.machine)} />
          <div>
            <div className="v2-who-name">{r.machine.name}</div>
            <div className="v2-sub">
              {r.machine.typeLabel} · <EntityChip {...cellChip(r.machine.cell)} />
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'score',
      label: words.columns.score,
      numeric: true,
      sortBy: (r) => r.score.value,
      cell: (r) => r.score.shown,
    },
    {
      key: 'nudges',
      label: words.columns.nudges,
      cell: (r) => (
        <div className="v2-row v2-gap-6">
          {pill(r.high, words.priority.high, 'loss')}
          {pill(r.medium, words.priority.medium, 'risk')}
          {pill(r.low, words.priority.low, 'neutral')}
        </div>
      ),
    },
    { key: 'next', label: words.columns.next, cell: (r) => r.next },
  ];
}

/** The page under the header, top to bottom; a decision, a machine or a person opens in the drawer. */
function Body({ model, act }: { model: ActionCenterModel; act: Acts }) {
  const { words } = model;
  const open = useContext(EntityOpenContext);
  const { current } = useEntityParam();
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
        selected={current?.kind === 'decision' ? current.id : undefined}
        onOpen={(id) => open({ kind: 'decision', id })}
        onDecide={act.onDecide}
        onUndo={act.onUndo}
      />
      <Row>
        <OwnersCard model={model} onAssign={act.onAssign} />
        <SettledCard model={model} />
      </Row>
      <DataTable
        rows={model.watch}
        rowKey={(r) => r.machine.code}
        columns={watchColumns(words.watch)}
        filters={watchFilters(words.watch)}
        text={(r) => `${r.machine.code} ${r.machine.name} ${r.machine.cell} ${r.next}`}
        words={words.watch}
        initialSort={{ key: 'score', dir: 'desc' }}
        selected={current?.kind === 'machine' ? current.id : undefined}
        onOpen={(r) => open({ kind: 'machine', id: r.machine.code })}
      />
      <SourceLine text={model.source} />
    </>
  );
}

/**
 * The decision-first Action Center: the verdict, four key figures, the decisions to take today with their owners,
 * who owns what beside what is parked or settled, and the machines that keep coming up. A decision, a machine, a
 * person or any chip opens its detail in the drawer, which lives in the URL.
 */
export function ActionCenterView({
  model,
  nav,
  title,
  onDecide = ignore,
  onUndo = ignore,
  onAssign = ignore,
}: { model: ActionCenterModel; nav: NavItem[]; title: string } & ActionCenterActions) {
  const act: Acts = { onDecide, onUndo, onAssign };
  return (
    <EntityShell nav={nav} title={title} local={(ref) => localDecision(model, ref, act)}>
      <Body model={model} act={act} />
    </EntityShell>
  );
}
