/* eslint-disable i18next/no-literal-string -- typed keys and entity kinds only; every visible word comes from the model */
import { useContext, useState } from 'react';
import { DataTable, type Column } from '../../../ui/v2/data-table.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { FilterSelect, SearchField } from '../../../ui/v2/domain/nudge-controls.js';
import { EntityChip, EntityOpenContext } from '../../../ui/v2/entity-chip.js';
import { KpiCard } from '../../../ui/v2/kpi-card.js';
import { Panel } from '../../../ui/v2/panel.js';
import { Row } from '../../../ui/v2/row.js';
import { Segmented } from '../../../ui/v2/segmented.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { Nudge } from './Nudge.js';
import { EntityShell } from '../entity/EntityShell.js';
import { useEntityParam } from '../entity/url.js';
import type { NudgeSeverity, NudgeRule } from '@uptimo/shared';
import { keep, type Filters } from './filter.js';
import type {
  ActionCenterActions,
  ActionCenterModel,
  ActionCenterWords,
  NudgeCard as NudgeCardModel,
  RiskRow,
} from './model.js';

/** The machines that need attention: the machine and its model, the engine's score and the rules that fired. */
function riskColumns(words: ActionCenterWords['risk']): Column<RiskRow>[] {
  return [
    {
      key: 'machine',
      label: words.columns.machine,
      sortBy: (r) => r.machine.label,
      cell: (r) => (
        <div className="v2-who">
          <EntityChip {...r.machine} />
          <span className="v2-sub">{r.model}</span>
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
    { key: 'why', label: words.columns.why, sortBy: (r) => r.why, cell: (r) => r.why },
  ];
}

/** The priority, the type and the search: the three filters over the nudges. */
function Controls({
  model,
  filters,
  change,
}: {
  model: ActionCenterModel;
  filters: Filters;
  change: (next: Partial<Filters>) => void;
}) {
  const { words } = model;
  return (
    <div className="v2-controls">
      <FilterSelect
        label={words.priorityLabel}
        all={words.allPriorities}
        value={filters.severity}
        options={model.priorities}
        onChange={(severity) => change({ severity: severity as NudgeSeverity | '' })}
      />
      <FilterSelect
        label={words.typeLabel}
        all={words.allTypes}
        value={filters.rule}
        options={model.types}
        onChange={(rule) => change({ rule: rule as NudgeRule | '' })}
      />
      <SearchField
        label={words.search}
        value={filters.query}
        onChange={(query) => change({ query })}
      />
    </div>
  );
}

/** One group per priority, high first, each with its count; the one empty line when the tab and filters leave none. */
function Groups({
  model,
  groups,
  empty,
  formKey,
  onForm,
  act,
}: {
  model: ActionCenterModel;
  groups: { key: NudgeSeverity; cards: NudgeCardModel[] }[];
  empty: string;
  formKey: string | null;
  onForm: (key: string | null) => void;
  act: ActionCenterActions;
}) {
  if (groups.length === 0) return <p className="v2-sub">{empty}</p>;
  return groups.map((group) => (
    <section key={group.key} aria-label={model.severityLabels[group.key]}>
      <h3 className="v2-group-head v2-h3">
        {model.severityLabels[group.key]}
        <span className="v2-sub v2-num">{group.cards.length}</span>
      </h3>
      {group.cards.map((card) => (
        <Nudge
          key={card.key}
          card={card}
          model={model}
          formOpen={formKey === card.key}
          act={act}
          onForm={onForm}
        />
      ))}
    </section>
  ));
}

/** The nudges: status tabs with their counts, the three filters, and one group per priority, high first. */
function Nudges({
  model,
  act,
  failed,
}: {
  model: ActionCenterModel;
  act: ActionCenterActions;
  failed: boolean;
}) {
  const { words } = model;
  const [filters, setFilters] = useState<Filters>({
    status: 'open',
    severity: '',
    rule: '',
    query: '',
  });
  const [formKey, setFormKey] = useState<string | null>(null);
  const shown = keep(model, filters);
  const groups = model.priorities
    .map(({ key }) => ({ key, cards: shown.filter((card) => card.severity === key) }))
    .filter((group) => group.cards.length > 0);
  const change = (next: Partial<Filters>) => setFilters({ ...filters, ...next });
  const tabs = model.tabs.map((tab) => ({ key: tab.status, label: `${tab.label} ${tab.count}` }));
  return (
    <Panel
      title={words.nudgesTitle}
      aside={
        <Segmented
          label={words.tabsLabel}
          value={filters.status}
          onChange={(status) => change({ status })}
          options={tabs}
        />
      }
    >
      <Controls model={model} filters={filters} change={change} />
      {failed ? (
        <p role="alert" className="v2-sub v2-seg-loss">
          {words.saveFailed}
        </p>
      ) : null}
      <Groups
        model={model}
        groups={groups}
        empty={filters.status === 'open' ? words.emptyOpen : words.empty}
        formKey={formKey}
        onForm={setFormKey}
        act={act}
      />
    </Panel>
  );
}

/** The page under the header, top to bottom. */
function Body({
  model,
  act,
  failed,
}: {
  model: ActionCenterModel;
  act: ActionCenterActions;
  failed: boolean;
}) {
  const { words } = model;
  const open = useContext(EntityOpenContext);
  const { current } = useEntityParam();
  return (
    <>
      <Verdict verdict={model.verdict} whyLabel={words.why} />
      <Row cols={4}>
        {model.tiles.map((k) => (
          <KpiCard key={k.id} kpi={k} />
        ))}
      </Row>
      <DataTable
        rows={model.risk}
        rowKey={(r) => r.machine.id}
        columns={riskColumns(words.risk)}
        filters={[{ key: 'all', label: words.risk.all }]}
        text={(r) => `${r.machine.label} ${r.model} ${r.why}`}
        words={words.risk}
        initialSort={{ key: 'score', dir: 'desc' }}
        selected={current?.kind === 'machine' ? current.id : undefined}
        onOpen={(r) => open({ kind: 'machine', id: r.machine.id })}
      />
      <Nudges model={model} act={act} failed={failed} />
      <SourceLine text={model.source} />
    </>
  );
}

/**
 * The Action Center on the plant's real nudges: the four priority counts, the machines that need attention, and every
 * nudge under its priority with its status tab, filters and the acknowledge, snooze, resolve and reopen writes. A
 * machine chip or row opens that machine in the drawer, which lives in the URL.
 */
export function ActionCenterView({
  model,
  nav,
  title,
  failed = false,
  ...act
}: {
  model: ActionCenterModel;
  nav: NavItem[];
  title: string;
  failed?: boolean;
} & ActionCenterActions) {
  return (
    <EntityShell nav={nav} title={title}>
      <Body model={model} act={act} failed={failed} />
    </EntityShell>
  );
}
