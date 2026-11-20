/* eslint-disable i18next/no-literal-string -- typed keys only; every visible word comes from the model */
import { Button } from '../../../ui/v2/button.js';
import { NudgeForm } from '../../../ui/v2/domain/nudge-controls.js';
import { EntityChip } from '../../../ui/v2/entity-chip.js';
import { KeyPill, type PillTone } from '../../../ui/v2/key-pill.js';
import type { NudgeSeverity } from '@uptimo/shared';
import type {
  ActionCenterActions,
  ActionCenterModel,
  ActionCenterWords,
  NudgeAction,
  NudgeCard,
} from './model.js';

const SEVERITY_TONE: Record<NudgeSeverity, PillTone> = {
  high: 'loss',
  med: 'risk',
  low: 'neutral',
  info: 'gain',
};

/** The type, the latest entry's day and the two flags a card can carry. */
function Head({ card, words }: { card: NudgeCard; words: ActionCenterWords }) {
  return (
    <div className="v2-row v2-gap-8">
      <KeyPill text={card.type} tone={SEVERITY_TONE[card.severity]} />
      {card.evidence ? <span className="v2-sub">{card.evidence}</span> : null}
      {card.reopened ? <KeyPill text={words.reopened} tone="risk" /> : null}
      {card.excluded ? <KeyPill text={words.excluded} tone="neutral" /> : null}
    </div>
  );
}

/** What was done to a stored nudge: its status as a pill, then the owner, the due day and the note. */
function Saved({ phrases }: { phrases: string[] }) {
  if (phrases.length === 0) return null;
  return (
    <div className="v2-row v2-gap-8">
      {phrases.map((phrase, i) =>
        i === 0 ? (
          <KeyPill key={phrase} text={phrase} tone="plan" />
        ) : (
          <span key={phrase} className="v2-sub">
            {phrase}
          </span>
        ),
      )}
    </div>
  );
}

/** The writes a card offers: Reopen on a stored nudge, Acknowledge, Snooze and Resolved on an open one. */
function Buttons({
  card,
  words,
  act,
  onForm,
}: {
  card: NudgeCard;
  words: ActionCenterWords;
  act: ActionCenterActions;
  onForm: (key: string) => void;
}) {
  const has = (action: NudgeAction) => card.actions.includes(action);
  if (card.actions.length === 0) return null;
  return (
    <div className="v2-row v2-gap-8">
      {has('reopen') ? (
        <Button onClick={() => act.onReopen?.(card.key)}>{words.reopen}</Button>
      ) : null}
      {has('ack') ? (
        <Button primary onClick={() => onForm(card.key)}>
          {words.acknowledge}
        </Button>
      ) : null}
      {has('snooze') ? (
        <Button onClick={() => act.onSnooze?.(card.key)}>{words.snooze}</Button>
      ) : null}
      {has('resolved') ? (
        <Button onClick={() => act.onResolve?.(card.key)}>{words.resolve}</Button>
      ) : null}
    </div>
  );
}

/** One nudge: its type, its title, the machines it names, the evidence, what was done to it and what can be done. */
export function Nudge({
  card,
  model,
  formOpen,
  act,
  onForm,
}: {
  card: NudgeCard;
  model: ActionCenterModel;
  formOpen: boolean;
  act: ActionCenterActions;
  onForm: (key: string | null) => void;
}) {
  return (
    <article className="v2-item" data-nudge={card.key}>
      <Head card={card} words={model.words} />
      <h4 className="v2-h3">{card.title}</h4>
      {card.machines.length > 0 ? (
        <div className="v2-row v2-gap-6">
          {card.machines.map((machine) => (
            <EntityChip key={machine.id} {...machine} />
          ))}
        </div>
      ) : null}
      <p className="v2-sub">{card.entries}</p>
      <Saved phrases={card.saved} />
      <Buttons card={card} words={model.words} act={act} onForm={onForm} />
      {formOpen && card.actions.includes('ack') ? (
        <NudgeForm
          words={model.words.form}
          people={model.people}
          onSave={(values) => {
            act.onAcknowledge?.(card.key, values);
            onForm(null);
          }}
          onCancel={() => onForm(null)}
        />
      ) : null}
    </article>
  );
}
