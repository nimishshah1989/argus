/* eslint-disable i18next/no-literal-string -- icon names and typed unions only; every visible word comes in as a prop or t() */
import type { MouseEvent } from 'react';
import { EntityChip, type EntityChipProps } from '../entity-chip.js';
import { Icon } from '../icons.js';
import { EventStrip } from '../event-strip.js';
import { KeyPill, type PillTone } from '../key-pill.js';
import { Segs, type Point } from '../points.js';
import { useWhy, WhyButton, WhyPanel } from '../why-toggle.js';

/** Domain kit: one maintenance decision. Generic pieces live one folder up. */
export type DecisionKind = 'decide' | 'fix' | 'inspect' | 'plan';

export const KIND_TONE: Record<DecisionKind, PillTone> = {
  decide: 'decide',
  fix: 'loss',
  inspect: 'risk',
  plan: 'plan',
};

export type DecisionData = {
  id: string;
  kind: DecisionKind;
  /** The word on the kind pill, in the reader's language. */
  kindLabel: string;
  /** The machines it is about, each a chip that opens that machine. */
  codes: EntityChipProps[];
  title: string;
  keys: { text: string; tone: PillTone }[];
  why: Point[];
  hours: string;
  money: string;
  /** Breakdown days in the last 90 (0 the oldest) and how the strip reads aloud. */
  days: number[];
  stripLabel: string;
  action: string;
  doneText: string;
  /** Who owns it, or what holds it: a sentence, so a person in it is a chip. */
  owner: Point;
  /** The full story, for the drawer; `why` is the short version that opens in place. */
  detail: Point[];
  /** Whether the owner has taken the action; the model says so, the row only shows it. */
  decided: boolean;
};

export type DecisionWords = { why: string; perMonth: string; stripCaption: string };
export type DecisionCallbacks = {
  onDecide: (id: string) => void;
  onUndo: (id: string) => void;
};

/** The one action that settles a decision; pressed once it is taken, and pressing again takes it back. */
export function DecisionAction({ d, onDecide, onUndo }: { d: DecisionData } & DecisionCallbacks) {
  return (
    <button
      type="button"
      className={d.decided ? 'v2-btn v2-btn-done' : 'v2-btn v2-btn-primary'}
      aria-pressed={d.decided}
      onClick={() => (d.decided ? onUndo(d.id) : onDecide(d.id))}
    >
      {d.decided ? <Icon name="check" /> : null}
      {d.decided ? d.doneText : d.action}
    </button>
  );
}

/** Clicks on the row open the drawer, except on its own buttons, inside its open Why, or to select text. */
const onRow = (open: () => void) => (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest('button, a, .v2-open')) return;
  if (window.getSelection()?.toString()) return;
  open();
};

/**
 * One decision: what it is, its short Why in place, what it is worth, its last 90 days, and the one action that
 * settles it. The row (or its title, from the keyboard) opens the full detail in the drawer.
 */
export function DecisionRow({
  d,
  words,
  selected,
  onOpen,
  ...act
}: {
  d: DecisionData;
  words: DecisionWords;
  selected: boolean;
  onOpen: (id: string) => void;
} & DecisionCallbacks) {
  const why = useWhy();
  return (
    <article className="v2-decision" data-selected={selected} onClick={onRow(() => onOpen(d.id))}>
      <div className="v2-decision-grid">
        <div className="v2-stack v2-gap-8">
          <div className="v2-row v2-gap-8">
            <KeyPill text={d.kindLabel} tone={KIND_TONE[d.kind]} />
            {d.codes.map((c) => (
              <EntityChip key={c.id} {...c} />
            ))}
          </div>
          <h3 className="v2-h3">
            <button
              type="button"
              className="v2-title-btn"
              aria-expanded={selected}
              onClick={() => onOpen(d.id)}
            >
              {d.title}
            </button>
          </h3>
          <div className="v2-row v2-gap-6">
            {d.keys.map((k) => (
              <KeyPill key={k.text} text={k.text} tone={k.tone} />
            ))}
            <WhyButton why={why} label={words.why} />
          </div>
        </div>
        <div className="v2-stack v2-gap-6">
          <div>
            <span className="v2-num">{d.hours}</span>{' '}
            <span className="v2-sub">
              {words.perMonth} · {d.money}
            </span>
          </div>
          <EventStrip days={d.days} label={d.stripLabel} caption={words.stripCaption} />
        </div>
        <div className="v2-stack v2-gap-6 v2-act">
          <DecisionAction d={d} {...act} />
          <span className="v2-sub v2-center">
            <Segs point={d.owner} />
          </span>
        </div>
      </div>
      <WhyPanel why={why} points={d.why} well />
    </article>
  );
}
