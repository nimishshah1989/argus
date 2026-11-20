import { Check } from '../../icon.js';
import { EventStrip } from '../event-strip.js';
import { KeyPill, type PillTone } from '../key-pill.js';
import type { Point } from '../points.js';
import { useWhy, WhyButton, WhyPanel } from '../why-toggle.js';

/** Domain kit: one maintenance decision. Generic pieces live one folder up. */
export type DecisionKind = 'decide' | 'fix' | 'inspect' | 'plan';

const KIND_TONE: Record<DecisionKind, PillTone> = {
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
  codes: string[];
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
  owner: string;
  /** Whether the owner has taken the action; the model says so, the row only shows it. */
  decided: boolean;
};

export type DecisionWords = { why: string; perMonth: string; stripCaption: string };

/** One decision: what it is, why, what it is worth, its last 90 days, and the one action that settles it. */
export function DecisionRow({
  d,
  words,
  onDecide,
  onUndo,
}: {
  d: DecisionData;
  words: DecisionWords;
  onDecide: (id: string) => void;
  onUndo: (id: string) => void;
}) {
  const why = useWhy();
  return (
    <article className="v2-decision">
      <div className="v2-decision-grid">
        <div className="v2-stack v2-gap-8">
          <div className="v2-row v2-gap-8">
            <KeyPill text={d.kindLabel} tone={KIND_TONE[d.kind]} />
            {d.codes.map((c) => (
              <span key={c} className="v2-code">
                {c}
              </span>
            ))}
          </div>
          <h3 className="v2-h3">{d.title}</h3>
          <div className="v2-row v2-gap-6">
            {d.keys.map((k) => (
              <KeyPill key={k.text} text={k.text} tone={k.tone} />
            ))}
            <WhyButton why={why} label={words.why} />
          </div>
        </div>
        <div className="v2-stack v2-gap-6">
          <div className="v2-num">
            <b>{d.hours}</b>{' '}
            <span className="v2-note">
              {words.perMonth} · {d.money}
            </span>
          </div>
          <EventStrip days={d.days} label={d.stripLabel} caption={words.stripCaption} />
        </div>
        <div className="v2-stack v2-gap-6 v2-act">
          <button
            type="button"
            className={d.decided ? 'v2-btn v2-btn-done' : 'v2-btn v2-btn-primary'}
            aria-pressed={d.decided}
            onClick={() => (d.decided ? onUndo(d.id) : onDecide(d.id))}
          >
            {d.decided ? <Check size={16} strokeWidth={2.5} aria-hidden="true" /> : null}
            {d.decided ? d.doneText : d.action}
          </button>
          <span className="v2-note v2-center">{d.owner}</span>
        </div>
      </div>
      <WhyPanel why={why} points={d.why} well />
    </article>
  );
}
