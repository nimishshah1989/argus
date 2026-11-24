/* eslint-disable i18next/no-literal-string -- icon names and typed unions only; every visible word comes in as a prop */
import { useId, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './icons.js';
import { KeyPill, type PillTone } from './key-pill.js';

/** How loud a takeaway is: a loss, a risk, a gain, or only a fact (UX rule 60). */
export type TakeawayTone = Extract<PillTone, 'loss' | 'risk' | 'gain' | 'neutral'>;

/** One line a section opens with: what to notice, computed from the section's data. `tag` is the tone in words. */
export type TakeawayData = {
  text: string;
  tone: TakeawayTone;
  tag: string;
  /** The key of the row or cell the line names, so the screen marks that one with the tone tag (rule 61). */
  outlier?: string;
};

/**
 * What a table's measure means, declared by the screen (ADR 0026 §4): which way is worse, and optionally a target in the
 * measure's unit, a change against an earlier period, and whether the values add up to a total (hours, counts: yes;
 * averages and percents: no). The takeaway rule and the table's ranking, bars and fold all read from this.
 */
export type Meaning = {
  worse: 'high' | 'low';
  /** `shown` is the target as the screen prints it ("98.0%"). A value equal to the target meets it. */
  target?: { value: number; shown: string };
  /** The section's total now and in `period` (the yardstick named in the line, e.g. "September"). */
  change?: { now: number; before: number; period: string };
  /** The values add up to a meaningful total: only then can a few rows "make up half". */
  additive?: boolean;
};

/** The takeaways of one screen, by section id; `null` is a section with nothing worth saying (a quiet line shows). */
export type Takeaways = Record<string, TakeawayData | null>;

const ICON: Record<TakeawayTone, IconName> = {
  loss: 'down',
  risk: 'alert',
  gain: 'up',
  neutral: 'check',
};

/** The one-line insight at the top of a table, chart or section: a tone pill (icon and word) then the sentence. */
export function Takeaway({ data }: { data: TakeawayData }) {
  return (
    <p className="v2-takeaway" data-tone={data.tone}>
      <KeyPill text={data.tag} tone={data.tone} icon={ICON[data.tone]} />
      <span>{data.text}</span>
    </p>
  );
}

/** A row that opens in place for its breakdown: a button that says whether it is open, and the detail it controls. */
export function ExpandRow({
  head,
  label,
  children,
  defaultOpen = false,
}: {
  /** What the row shows closed: identity, status tag, key number and its yardstick. */
  head: ReactNode;
  /** The button's accessible name, e.g. "Machine 12: show detail". */
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="v2-expand">
      <button
        type="button"
        className="v2-expand-head"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="v2-expand-main">{head}</span>
        <span className="v2-chev">
          <Icon name="chevronDown" size={14} />
        </span>
      </button>
      <div id={id} hidden={!open} className="v2-expand-body v2-open">
        {children}
      </div>
    </div>
  );
}
