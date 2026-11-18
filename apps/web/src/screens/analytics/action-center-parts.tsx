import { useId, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { NudgeAckBody, NudgeRule, NudgeSeverity } from '@uptimo/shared';
import { Button } from '../../ui/button.js';
import { Input, Label, Select } from '../../ui/input.js';
import {
  SEVERITY_LABELS,
  type ActionCenterView,
  type CardAction,
  type CardFilters,
  type CardMachine,
  type NudgeCard,
} from './action-center.js';

/** The Action Center's presentational pieces (packet 44d): the tiles, the filter bar and one card with its form. */

export interface Person {
  id: string;
  name: string;
}

const SECONDARY = 'secondary';
const ACK: CardAction = 'ack';
const REOPEN: CardAction = 'reopen';
const SNOOZE: CardAction = 'snooze';
const RESOLVE: CardAction = 'resolved';
/** The form fields' names, read back with FormData on submit; never copy, so they stay out of the catalogue. */
const FIELD = { owner: 'owner', due: 'due', note: 'note' } as const;

export function Tiles({ view }: { view: ActionCenterView }) {
  const { t } = useTranslation();
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {view.tiles.map((tile) => (
        <li
          key={tile.severity}
          data-tile={tile.severity}
          className="flex flex-col gap-1 rounded-2xl bg-surface p-4 shadow-card"
        >
          <span className="text-title2 font-semibold tabular-nums">{tile.count}</span>
          <span className="text-footnote text-neutral-600">{t(tile.label)}</span>
        </li>
      ))}
    </ul>
  );
}

function StatusTabs({
  view,
  filters,
  onChange,
}: {
  view: ActionCenterView;
  filters: CardFilters;
  onChange: (next: Partial<CardFilters>) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="tablist"
      aria-label={t('analytics.actionCenter.tabs')}
      className="flex flex-wrap gap-1 rounded-xl bg-neutral-200 p-1"
    >
      {view.tabs.map((tab) => (
        <button
          key={tab.status}
          type="button"
          role="tab"
          aria-selected={filters.status === tab.status}
          onClick={() => onChange({ status: tab.status })}
          className="flex min-h-target-min items-center gap-1 rounded-lg px-3 text-footnote font-semibold text-neutral-700 aria-selected:bg-surface aria-selected:text-neutral-900 aria-selected:shadow-card"
        >
          {t(tab.label)}
          <span className="tabular-nums">{tab.count}</span>
        </button>
      ))}
    </div>
  );
}

function FilterFields({
  view,
  filters,
  onChange,
}: {
  view: ActionCenterView;
  filters: CardFilters;
  onChange: (next: Partial<CardFilters>) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="action-center-priority">{t('analytics.actionCenter.priorityLabel')}</Label>
        <Select
          id="action-center-priority"
          value={filters.severity}
          onChange={(event) => onChange({ severity: event.target.value as NudgeSeverity | '' })}
        >
          <option value="">{t('analytics.actionCenter.priority')}</option>
          {view.tiles.map((tile) => (
            <option key={tile.severity} value={tile.severity}>
              {t(tile.label)}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="action-center-type">{t('analytics.actionCenter.typeLabel')}</Label>
        <Select
          id="action-center-type"
          value={filters.rule}
          onChange={(event) => onChange({ rule: event.target.value as NudgeRule | '' })}
        >
          <option value="">{t('analytics.actionCenter.type')}</option>
          {view.types.map((option) => (
            <option key={option.rule} value={option.rule}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex min-w-48 flex-1 flex-col gap-1">
        <Label htmlFor="action-center-search">{t('analytics.actionCenter.search')}</Label>
        <Input
          id="action-center-search"
          type="search"
          value={filters.query}
          onChange={(event) => onChange({ query: event.target.value })}
        />
      </div>
    </div>
  );
}

export function FilterBar({
  view,
  filters,
  onChange,
}: {
  view: ActionCenterView;
  filters: CardFilters;
  onChange: (next: Partial<CardFilters>) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <StatusTabs view={view} filters={filters} onChange={onChange} />
      <FilterFields view={view} filters={filters} onChange={onChange} />
    </div>
  );
}

function AckForm({
  people,
  saving,
  onSave,
  onCancel,
}: {
  people: readonly Person[];
  saving: boolean;
  onSave: (body: NudgeAckBody) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSave({
      status: 'ack',
      owner: String(data.get(FIELD.owner) ?? ''),
      due: String(data.get(FIELD.due) ?? ''),
      note: String(data.get(FIELD.note) ?? ''),
    });
  };
  return (
    <form
      aria-label={t('analytics.actionCenter.form')}
      onSubmit={submit}
      className="flex flex-col gap-2 rounded-xl bg-neutral-100 p-3"
    >
      <Label htmlFor={`${id}-owner`}>{t('analytics.actionCenter.ownerLabel')}</Label>
      <Select id={`${id}-owner`} name={FIELD.owner} defaultValue="">
        <option value="">{t('analytics.actionCenter.ownerNone')}</option>
        {people.map((person) => (
          <option key={person.id} value={person.name}>
            {person.name}
          </option>
        ))}
      </Select>
      <Label htmlFor={`${id}-due`}>{t('analytics.actionCenter.dueLabel')}</Label>
      <Input id={`${id}-due`} name={FIELD.due} type="date" />
      <Label htmlFor={`${id}-note`}>{t('analytics.actionCenter.noteLabel')}</Label>
      <Input id={`${id}-note`} name={FIELD.note} type="text" maxLength={500} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          {t('analytics.actionCenter.save')}
        </Button>
        <Button variant={SECONDARY} onClick={onCancel}>
          {t('analytics.actionCenter.cancel')}
        </Button>
      </div>
    </form>
  );
}

function StatusLine({ card }: { card: NudgeCard }) {
  const { t } = useTranslation();
  const ack = card.ack;
  if (card.status === 'open' || ack === null) return null;
  const word =
    card.status === 'ack'
      ? t('analytics.actionCenter.status.ack')
      : card.status === 'snoozed'
        ? t('analytics.actionCenter.status.snoozed', { date: ack.until })
        : t('analytics.actionCenter.status.resolved');
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-1 text-footnote text-neutral-600">
      <span className="font-semibold text-neutral-900">{word}</span>
      {ack.owner === '' ? null : (
        <span>{t('analytics.actionCenter.owner', { owner: ack.owner })}</span>
      )}
      {ack.due === '' ? null : <span>{t('analytics.actionCenter.due', { date: ack.due })}</span>}
      {ack.note === '' ? null : <span>{t('analytics.actionCenter.note', { note: ack.note })}</span>}
    </p>
  );
}

function CardTop({ card }: { card: NudgeCard }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption font-bold">
      <span data-severity={card.severity} className="rounded-full bg-neutral-200 px-2.5 py-1">
        {t(SEVERITY_LABELS[card.severity])}
      </span>
      <span className="text-neutral-600">{card.type}</span>
      {card.reopened ? (
        <span className="rounded-full bg-warning-tint px-2.5 py-1 text-warning-ink">
          {t('analytics.actionCenter.reopened')}
        </span>
      ) : null}
      {card.excluded ? (
        <span className="rounded-full bg-muted-tint px-2.5 py-1 text-muted-ink">
          {t('analytics.actionCenter.excluded')}
        </span>
      ) : null}
      {card.evidence === '' ? null : (
        <span className="text-neutral-600">
          {t('analytics.actionCenter.latestEntry', { date: card.evidence })}
        </span>
      )}
    </div>
  );
}

function MachineChips({ machines }: { machines: readonly CardMachine[] }) {
  if (machines.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1">
      {machines.map((machine) => (
        <li key={machine.id}>
          <Link
            to={machine.href}
            className="inline-flex min-h-target-min items-center rounded-full border border-control px-3 text-footnote font-semibold text-accent-text"
          >
            {machine.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function CardButtons({
  card,
  snoozeDays,
  onAction,
  onOpenForm,
}: {
  card: NudgeCard;
  snoozeDays: number;
  onAction: (action: CardAction) => void;
  onOpenForm: () => void;
}) {
  const { t } = useTranslation();
  if (card.actions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {card.actions.includes(REOPEN) ? (
        <Button variant={SECONDARY} onClick={() => onAction(REOPEN)}>
          {t('analytics.actionCenter.reopen')}
        </Button>
      ) : null}
      {card.actions.includes(ACK) ? (
        <Button onClick={onOpenForm}>{t('analytics.actionCenter.acknowledge')}</Button>
      ) : null}
      {card.actions.includes(SNOOZE) ? (
        <Button variant={SECONDARY} onClick={() => onAction(SNOOZE)}>
          {t('analytics.actionCenter.snooze', { days: snoozeDays })}
        </Button>
      ) : null}
      {card.actions.includes(RESOLVE) ? (
        <Button variant={SECONDARY} onClick={() => onAction(RESOLVE)}>
          {t('analytics.actionCenter.resolve')}
        </Button>
      ) : null}
    </div>
  );
}

export function Card({
  card,
  snoozeDays,
  people,
  formOpen,
  saving,
  onAction,
  onOpenForm,
  onCancel,
  onSave,
}: {
  card: NudgeCard;
  snoozeDays: number;
  people: readonly Person[];
  formOpen: boolean;
  saving: boolean;
  onAction: (action: CardAction) => void;
  onOpenForm: () => void;
  onCancel: () => void;
  onSave: (body: NudgeAckBody) => void;
}) {
  const { t } = useTranslation();
  return (
    <article
      data-nudge={card.key}
      className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-card"
    >
      <CardTop card={card} />
      <h3 className="text-body font-semibold text-neutral-900">{card.title}</h3>
      <MachineChips machines={card.machines} />
      <p className="text-footnote text-neutral-600">
        {t('analytics.actionCenter.entries', { count: card.entries })}
      </p>
      <StatusLine card={card} />
      <CardButtons
        card={card}
        snoozeDays={snoozeDays}
        onAction={onAction}
        onOpenForm={onOpenForm}
      />
      {formOpen && card.actions.includes(ACK) ? (
        <AckForm people={people} saving={saving} onSave={onSave} onCancel={onCancel} />
      ) : null}
    </article>
  );
}
