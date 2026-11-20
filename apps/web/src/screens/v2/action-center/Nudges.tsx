/* eslint-disable i18next/no-literal-string -- typed keys and icon names only; every visible word comes from the model */
import { useMemo, useState } from 'react';
import { NUDGE_SEVERITIES, type NudgeStatus } from '@uptimo/shared';
import { DataTable, type Column, type FilterChip } from '../../../ui/v2/data-table.js';
import { KeyPill, type PillTone } from '../../../ui/v2/key-pill.js';
import { Segs } from '../../../ui/v2/points.js';
import { Segmented } from '../../../ui/v2/segmented.js';
import { SelectField } from '../../../ui/v2/select-field.js';
import type { ActionCenterModel, NudgeRow } from './model.js';

const PILL = { high: 'loss', med: 'risk', low: 'neutral', info: 'gain' } as const;
const STATUS_PILL: Record<NudgeStatus, { tone: PillTone; icon: 'bell' | 'check' | 'pause' }> = {
  open: { tone: 'risk', icon: 'bell' },
  ack: { tone: 'neutral', icon: 'check' },
  snoozed: { tone: 'neutral', icon: 'pause' },
  resolved: { tone: 'gain', icon: 'check' },
};

/** The status, and for a stored nudge who owns it, when it is due and the note, as the card said it in v1. */
function StatusCell({ row, owner }: { row: NudgeRow; owner: string }) {
  const { ack } = row;
  const shown = STATUS_PILL[row.status];
  return (
    <div className="v2-stack v2-gap-6">
      <div>
        <KeyPill text={row.statusLabel} tone={shown.tone} icon={shown.icon} />
      </div>
      {row.status !== 'open' && ack !== null ? (
        <div className="v2-sub">
          {ack.owner.length > 0 ? (
            <>
              {owner} <Segs point={ack.owner} />{' '}
            </>
          ) : null}
          {[ack.due, ack.note].filter((text) => text !== '').join(' · ')}
        </div>
      ) : null}
    </div>
  );
}

function columns(model: ActionCenterModel): Column<NudgeRow>[] {
  const { words } = model;
  return [
    {
      key: 'priority',
      label: words.columns.priority,
      sortBy: (r) => r.weight,
      cell: (r) => <KeyPill text={r.severityLabel} tone={PILL[r.severity]} />,
    },
    {
      key: 'nudge',
      label: words.columns.nudge,
      sortBy: (r) => r.titleText,
      cell: (r) => (
        <div className="v2-stack v2-gap-6">
          <div>
            <Segs point={r.title} />
          </div>
          {r.reopened || r.excluded ? (
            <div className="v2-row v2-gap-6">
              {r.reopened ? <KeyPill text={words.reopened} tone="risk" icon="alert" /> : null}
              {r.excluded ? <KeyPill text={words.excluded} tone="neutral" icon="pause" /> : null}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'type',
      label: words.columns.type,
      sortBy: (r) => r.ruleLabel,
      cell: (r) => r.ruleLabel,
    },
    {
      key: 'entries',
      label: words.columns.entries,
      numeric: true,
      sortBy: (r) => r.count,
      cell: (r) => r.count,
    },
    {
      key: 'latest',
      label: words.columns.latest,
      sortBy: (r) => r.latest.value,
      cell: (r) => r.latest.shown,
    },
    {
      key: 'status',
      label: words.columns.status,
      sortBy: (r) => r.statusLabel,
      cell: (r) => <StatusCell row={r} owner={words.owner} />,
    },
  ];
}

const priorityChips = (words: ActionCenterModel['words']): FilterChip<NudgeRow>[] => [
  { key: 'all', label: words.priorityAll },
  ...NUDGE_SEVERITIES.map((severity) => ({
    key: severity,
    label: words.priorities[severity],
    test: (r: NudgeRow) => r.severity === severity,
  })),
];

/**
 * The nudges: the four status tabs with their counts, the type, then the table's own priority chips and search. The
 * engine's order stands until a column is sorted. A row opens the nudge in the drawer, where it is acted on.
 */
export function NudgeTable({
  model,
  selected,
  onOpen,
}: {
  model: ActionCenterModel;
  selected?: string;
  onOpen: (row: NudgeRow) => void;
}) {
  const { words } = model;
  const [status, setStatus] = useState<NudgeStatus>('open');
  const [type, setType] = useState('');
  const rows = useMemo(
    () => model.nudges.filter((n) => n.status === status && (type === '' || n.rule === type)),
    [model.nudges, status, type],
  );
  const chips = priorityChips(words);
  return (
    <>
      <div className="v2-row v2-gap-12">
        <Segmented
          label={words.tabsLabel}
          value={status}
          onChange={setStatus}
          options={model.tabs.map((tab) => ({
            key: tab.key,
            label: `${tab.label} ${tab.count}`,
          }))}
        />
        <SelectField
          label={words.typeLabel}
          all={words.typeAll}
          value={type}
          options={model.types}
          onChange={setType}
        />
      </div>
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        rowLabel={(r) => r.titleText}
        columns={columns(model)}
        filters={chips}
        text={(r) => r.text}
        words={{
          ...words.table,
          noResults: status === 'open' ? words.emptyOpen : words.emptyOther,
        }}
        selected={selected}
        onOpen={onOpen}
      />
    </>
  );
}
