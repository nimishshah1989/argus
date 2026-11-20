/* eslint-disable i18next/no-literal-string -- icon names and typed unions only; every visible word comes in as a prop or t() */
import type { MouseEvent } from 'react';
import { EntityChip, type EntityChipProps } from '../entity-chip.js';
import { Icon } from '../icons.js';
import { KeyPill } from '../key-pill.js';
import { Segs, type Point } from '../points.js';
import { useWhy, WhyButton, WhyPanel } from '../why-toggle.js';

/** Domain kit: one data check that is not passing. Checks that pass are one line each, in `Points`. */
export type CheckStatus = 'gap' | 'check';

export type CheckData = {
  id: string;
  /** A gap changes a figure now; a check is worth a look and changes nothing yet. */
  status: CheckStatus;
  /** The word on the status pill, in the reader's language. */
  statusLabel: string;
  title: string;
  /** What is wrong, as a sentence: a machine in it is a chip. */
  state: Point;
  /** The figure it changes, said on a pill ("Changes MTTR"). */
  impact: string;
  /** How many records need fixing, as printed ("12"), and what they are called ("records to fix"). */
  records: string;
  recordsNote: string;
  /** Who fixes it: a person chip. */
  owner: EntityChipProps;
  /** Short explanation in plain words, opened in place. */
  why: Point[];
  /** The one action ("Add the dates"), and its words once taken. */
  fix: string;
  doneText: string;
  done: boolean;
};

export type CheckWords = { why: string; owner: string };
export type CheckCallbacks = { onFix: (id: string) => void; onUndo: (id: string) => void };

/** A click on the row opens its Why, except on its own buttons and chips, inside the open Why, or to select text. */
const onRow = (toggle: () => void) => (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest('button, a, .v2-open')) return;
  if (window.getSelection()?.toString()) return;
  toggle();
};

/**
 * One check that needs someone: what is wrong, which figure it changes, how many records, who owns the fix and the
 * one action that sends it to them. The row (or its Why button) opens the plain-words explanation in place.
 */
export function CheckRow({
  c,
  words,
  onFix,
  onUndo,
}: { c: CheckData; words: CheckWords } & CheckCallbacks) {
  const why = useWhy();
  return (
    <article className="v2-decision" onClick={onRow(why.toggle)}>
      <div className="v2-decision-grid">
        <div className="v2-stack v2-gap-8">
          <div className="v2-row v2-gap-8">
            <KeyPill
              text={c.statusLabel}
              tone={c.status === 'gap' ? 'loss' : 'risk'}
              icon="alert"
            />
          </div>
          <h3 className="v2-h3">{c.title}</h3>
          <p className="v2-sub">
            <Segs point={c.state} />
          </p>
          <div className="v2-row v2-gap-6">
            <KeyPill text={c.impact} tone="neutral" />
            <WhyButton why={why} label={words.why} />
          </div>
        </div>
        <div>
          <span className="v2-num">{c.records}</span>{' '}
          <span className="v2-sub">{c.recordsNote}</span>
        </div>
        <div className="v2-stack v2-gap-6 v2-act">
          <button
            type="button"
            className={c.done ? 'v2-btn v2-btn-done' : 'v2-btn v2-btn-primary'}
            aria-pressed={c.done}
            onClick={() => (c.done ? onUndo(c.id) : onFix(c.id))}
          >
            {c.done ? <Icon name="check" /> : null}
            {c.done ? c.doneText : c.fix}
          </button>
          <span className="v2-sub v2-center">
            {words.owner} <EntityChip {...c.owner} />
          </span>
        </div>
      </div>
      <WhyPanel why={why} points={c.why} well />
    </article>
  );
}
