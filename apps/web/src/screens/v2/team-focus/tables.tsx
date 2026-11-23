/* eslint-disable i18next/no-literal-string -- icon names and typed unions only; every visible word comes from the model */
import { DataTable, type Column, type FilterChip } from '../../../ui/v2/data-table.js';
import { KIND_TONE } from '../../../ui/v2/domain/decision-row.js';
import { EntityChip } from '../../../ui/v2/entity-chip.js';
import type { IconName } from '../../../ui/v2/icons.js';
import { KeyPill, type PillTone } from '../../../ui/v2/key-pill.js';
import type { ActionRow, ActionStatus, Load, PersonLoad, TeamFocusWords } from './model.js';

type Opener = { selected?: string; onOpen: (id: string) => void };

const LOAD: Record<Load, { tone: PillTone; icon?: IconName }> = {
  over: { tone: 'loss', icon: 'alert' },
  ok: { tone: 'neutral' },
  room: { tone: 'gain', icon: 'check' },
};
const STATUS: Record<ActionStatus, { tone: PillTone; icon: IconName }> = {
  todo: { tone: 'neutral', icon: 'pause' },
  doing: { tone: 'plan', icon: 'clock' },
  done: { tone: 'gain', icon: 'check' },
  skip: { tone: 'neutral', icon: 'close' },
};

/** Each person and what they carry, the most loaded first; a row opens the person. */
export function PeopleTable({
  people,
  words,
  selected,
  onOpen,
}: { people: PersonLoad[]; words: TeamFocusWords['people'] } & Opener) {
  const filters: FilterChip<PersonLoad>[] = [
    { key: 'all', label: words.filters.all },
    { key: 'over', label: words.filters.over, test: (p) => p.load === 'over' },
    { key: 'room', label: words.filters.room, test: (p) => p.load === 'room' },
  ];
  return (
    <DataTable
      rows={people}
      rowKey={(p) => p.chip.id}
      columns={peopleColumns(words)}
      filters={filters}
      text={(p) => `${p.chip.label} ${p.role}`}
      words={words}
      initialSort={{ key: 'open', dir: 'desc' }}
      selected={selected}
      onOpen={(p) => onOpen(p.chip.id)}
    />
  );
}

function peopleColumns(words: TeamFocusWords['people']): Column<PersonLoad>[] {
  return [
    {
      key: 'person',
      label: words.columns.person,
      sortBy: (p) => p.chip.label,
      cell: (p) => (
        <div className="v2-who">
          <EntityChip {...p.chip} />
          <span className="v2-sub">{p.role}</span>
        </div>
      ),
    },
    {
      key: 'open',
      label: words.columns.open,
      numeric: true,
      sortBy: (p) => p.open,
      cell: (p) => p.open,
    },
    {
      key: 'hours',
      label: words.columns.hours,
      numeric: true,
      sortBy: (p) => p.hours.value,
      cell: (p) => p.hours.shown,
    },
    {
      key: 'done',
      label: words.columns.done,
      numeric: true,
      sortBy: (p) => p.done,
      cell: (p) => p.done,
    },
    {
      key: 'load',
      label: words.columns.load,
      cell: (p) => (p.load === null ? null : <KeyPill text={p.loadLabel} {...LOAD[p.load]} />),
    },
  ];
}

const OPEN: ActionStatus[] = ['todo', 'doing'];

/** Every action of the month, the most valuable first; a row opens the first machine it names. */
export function ActionTable({
  actions,
  words,
  selected,
  onOpen,
}: { actions: ActionRow[]; words: TeamFocusWords['actions'] } & Opener) {
  const filters: FilterChip<ActionRow>[] = [
    { key: 'all', label: words.filters.all },
    {
      key: 'noOwner',
      label: words.filters.noOwner,
      test: (a) => a.owner === null && OPEN.includes(a.status),
    },
    { key: 'doing', label: words.filters.doing, test: (a) => a.status === 'doing' },
    {
      key: 'done',
      label: words.filters.done,
      test: (a) => a.status === 'done' || a.status === 'skip',
    },
  ];
  return (
    <DataTable
      rows={actions}
      rowKey={(a) => a.id}
      columns={actionColumns(words)}
      filters={filters}
      text={(a) =>
        `${a.title} ${a.kindLabel} ${a.chips.map((c) => c.label).join(' ')} ${a.owner?.label ?? ''}`
      }
      words={words}
      initialSort={{ key: 'hours', dir: 'desc' }}
      selected={selected}
      onOpen={(a) => a.chips[0] && onOpen(a.chips[0].id)}
    />
  );
}

function actionColumns(words: TeamFocusWords['actions']): Column<ActionRow>[] {
  return [
    {
      key: 'action',
      label: words.columns.action,
      sortBy: (a) => a.title,
      cell: (a) => (
        <div className="v2-stack v2-gap-6">
          <div className="v2-row v2-gap-6">
            <KeyPill text={a.kindLabel} tone={KIND_TONE[a.kind]} />
            {a.chips.map((c) => (
              <EntityChip key={c.id} {...c} />
            ))}
          </div>
          <span>{a.title}</span>
        </div>
      ),
    },
    {
      key: 'owner',
      label: words.columns.owner,
      sortBy: (a) => a.owner?.label ?? '',
      cell: (a) =>
        a.owner ? (
          <EntityChip {...a.owner} />
        ) : (
          <KeyPill text={words.noOwner} tone="risk" icon="alert" />
        ),
    },
    {
      key: 'status',
      label: words.columns.status,
      cell: (a) => <KeyPill text={a.statusLabel} {...STATUS[a.status]} />,
    },
    {
      key: 'hours',
      label: words.columns.hours,
      numeric: true,
      sortBy: (a) => a.hours.value,
      cell: (a) => a.hours.shown,
    },
  ];
}
