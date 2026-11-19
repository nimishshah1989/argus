import { useId, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { NudgeAckBody } from '@uptimo/shared';
import { Button } from '../../ui/button.js';
import { Card } from '../../ui/card.js';
import { Input, Label, Select } from '../../ui/input.js';
import { StatusChip } from '../../ui/elements/index.js';
import { NUDGE_STATUS } from '../../ui/meaning/index.js';
import type { CardAction, CardMachine, NudgeCard } from './action-center.js';

/** The Action Center's nudge card with its acknowledgement form (packet 44d, rebuilt by ticket 87). */

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
      className="flex flex-col gap-2 rounded-control bg-neutral-100 p-3"
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

/** What was done to a stored nudge: its status as a chip (icon and word), then owner, due date and note as text. */
function StatusLine({ card }: { card: NudgeCard }) {
  const { t } = useTranslation();
  const ack = card.ack;
  if (card.status === 'open' || ack === null) return null;
  const meaning = NUDGE_STATUS[card.status];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-footnote text-neutral-600">
      <StatusChip tone={meaning.tone} icon={meaning.icon}>
        {card.status === 'snoozed'
          ? t('analytics.actionCenter.status.snoozed', { date: ack.until })
          : card.status === 'resolved'
            ? t('analytics.actionCenter.status.resolved')
            : t('analytics.actionCenter.status.ack')}
      </StatusChip>
      {ack.owner === '' ? null : (
        <span>{t('analytics.actionCenter.owner', { owner: ack.owner })}</span>
      )}
      {ack.due === '' ? null : <span>{t('analytics.actionCenter.due', { date: ack.due })}</span>}
      {ack.note === '' ? null : <span>{t('analytics.actionCenter.note', { note: ack.note })}</span>}
    </div>
  );
}

/** The type, the latest entry's day and the two flags a card can carry, each a chip with its icon and word. */
function CardTop({ card }: { card: NudgeCard }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-footnote text-neutral-600">
      <span className="font-semibold">{card.type}</span>
      {card.evidence === '' ? null : (
        <span>{t('analytics.actionCenter.latestEntry', { date: card.evidence })}</span>
      )}
      {card.reopened ? (
        <StatusChip tone="watch">{t('analytics.actionCenter.reopened')}</StatusChip>
      ) : null}
      {card.excluded ? (
        <StatusChip tone="neutral">{t('analytics.actionCenter.excluded')}</StatusChip>
      ) : null}
    </div>
  );
}

function MachineLinks({ machines }: { machines: readonly CardMachine[] }) {
  if (machines.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {machines.map((machine) => (
        <li key={machine.id}>
          <Link
            to={machine.href}
            className="inline-flex min-h-target-min items-center rounded-chip border border-control px-3 text-footnote font-semibold text-accent-text"
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

/** One nudge: its sentence as the card's title, the machines it names, the evidence count, and what a person can do. */
export function NudgeCardView({
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
    <li data-nudge={card.key}>
      <Card title={card.title}>
        <CardTop card={card} />
        <MachineLinks machines={card.machines} />
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
      </Card>
    </li>
  );
}
