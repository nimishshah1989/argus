/* eslint-disable i18next/no-literal-string -- typed keys and entity kinds only; every visible word comes from the model */
import { useContext } from 'react';
import { DataTable, type Column, type FilterChip } from '../../../ui/v2/data-table.js';
import { CheckRow } from '../../../ui/v2/domain/check-row.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { DrillAction } from '../../../ui/v2/drill-action.js';
import { EntityChip, EntityOpenContext } from '../../../ui/v2/entity-chip.js';
import { KpiCard } from '../../../ui/v2/kpi-card.js';
import { Panel } from '../../../ui/v2/panel.js';
import { Points } from '../../../ui/v2/points.js';
import { Row } from '../../../ui/v2/row.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { EntityShell } from '../entity/EntityShell.js';
import type {
  CheckGroup,
  DataChecklistActions,
  DataChecklistModel,
  DataChecklistWords,
  RecordRow,
} from './model.js';

const ignore = () => {};
type Acts = Required<DataChecklistActions>;

/** One part of the data with something to fix: its checks, worst first, and the person who owns the fixes. */
function GroupCard({
  group,
  words,
  act,
}: {
  group: CheckGroup;
  words: DataChecklistWords;
  act: Acts;
}) {
  return (
    <Panel
      title={group.name}
      sub={group.summary}
      flush
      aside={
        <span className="v2-sub">
          {words.ownerIs} <EntityChip {...group.owner} />
        </span>
      }
    >
      {group.checks.map((c) => (
        <CheckRow key={c.id} c={c} words={words.check} onFix={act.onFix} onUndo={act.onUndo} />
      ))}
    </Panel>
  );
}

const recordFilters = (
  records: RecordRow[],
  words: DataChecklistWords['records'],
): FilterChip<RecordRow>[] => [
  { key: 'all', label: words.all },
  ...[...new Map(records.map((r) => [r.area.key, r.area.label]))].map(([key, label]) => ({
    key,
    label,
    test: (r: RecordRow) => r.area.key === key,
  })),
];

/** The table's four columns: the machine and what is wrong, its part of the data, its owner, how long it has waited. */
function recordColumns(words: DataChecklistWords['records']): Column<RecordRow>[] {
  return [
    {
      key: 'record',
      label: words.columns.record,
      sortBy: (r) => r.entity.id,
      cell: (r) => (
        <div className="v2-who">
          {r.entity.kind === 'decision' ? r.entity.label : <EntityChip {...r.entity} />}
          <div className="v2-who-name">{r.what}</div>
        </div>
      ),
    },
    {
      key: 'area',
      label: words.columns.area,
      sortBy: (r) => r.area.label,
      cell: (r) => r.area.label,
    },
    {
      key: 'owner',
      label: words.columns.owner,
      sortBy: (r) => r.owner.label,
      cell: (r) => <EntityChip {...r.owner} />,
    },
    {
      key: 'open',
      label: words.columns.open,
      numeric: true,
      sortBy: (r) => r.open.value,
      cell: (r) => r.open.shown,
    },
  ];
}

/** The page under the header, top to bottom; a machine or a person opens in the drawer. */
function Body({ model, act }: { model: DataChecklistModel; act: Acts }) {
  const { words } = model;
  const open = useContext(EntityOpenContext);
  return (
    <>
      <Verdict verdict={model.verdict} whyLabel={words.why} />
      {model.drill ? <DrillAction drill={model.drill} /> : null}
      <Row cols={4}>
        {model.kpis.map((k) => (
          <KpiCard key={k.id} kpi={k} />
        ))}
      </Row>
      {model.groups.length === 0 ? (
        <Panel title={words.passingTitle}>
          <p className="v2-sub">{words.allClear}</p>
        </Panel>
      ) : (
        model.groups.map((g) => <GroupCard key={g.id} group={g} words={words} act={act} />)
      )}
      <DataTable
        rows={model.records}
        rowKey={(r) => r.id}
        columns={recordColumns(words.records)}
        filters={recordFilters(model.records, words.records)}
        text={(r) => `${r.entity.label} ${r.what} ${r.area.label} ${r.owner.label}`}
        words={words.records}
        initialSort={{ key: 'open', dir: 'desc' }}
        onOpen={(r) => {
          if (r.entity.kind !== 'decision') open({ kind: r.entity.kind, id: r.entity.id });
        }}
      />
      <Panel title={words.passingTitle} sub={words.passingSub}>
        <Points points={model.passing} />
      </Panel>
      <SourceLine text={model.source} />
    </>
  );
}

/**
 * The decision-first Data Checklist: whether the figures can be trusted, the gaps that change a figure and who fixes
 * each, every record behind them in one table, and the checks that already pass. A machine or a person opens in the
 * drawer, which lives in the URL.
 */
export function DataChecklistView({
  model,
  nav,
  title,
  onFix = ignore,
  onUndo = ignore,
}: { model: DataChecklistModel; nav: NavItem[]; title: string } & DataChecklistActions) {
  return (
    <EntityShell nav={nav} title={title}>
      <Body model={model} act={{ onFix, onUndo }} />
    </EntityShell>
  );
}
