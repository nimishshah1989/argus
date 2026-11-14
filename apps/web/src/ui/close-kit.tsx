import type { ReactNode } from 'react';
import { Label } from './input.js';

/** The pieces of the close screens (design lock slice 2, S3): the finish-time card and the pinned footer. */

export interface FinishTimeProps {
  title: string;
  /** Names the time for assistive tech, e.g. "Finish time". */
  label: string;
  time: string;
  /** Right of the time: "Now" or how long ago. */
  status: string;
  hint: string;
  earlier: string;
  now: string;
  later: string;
  canEarlier: boolean;
  canNow: boolean;
  /** The finish is the moment the screen opened: the Now step shows as selected. */
  isNow: boolean;
  canLater: boolean;
  onEarlier: () => void;
  onNow: () => void;
  onLater: () => void;
}

/** A step of the finish time: smaller than a Button so "5 min earlier" fits a third of a phone. */
function StepButton({
  label,
  enabled,
  pressed,
  onClick,
}: {
  label: string;
  enabled: boolean;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!enabled}
      aria-pressed={pressed}
      onClick={onClick}
      className="min-h-target-min rounded-xl border border-control bg-surface px-1 text-footnote font-semibold text-neutral-900 disabled:text-neutral-600 aria-pressed:border-accent-strong aria-pressed:text-accent-text"
    >
      {label}
    </button>
  );
}

/** "When did you finish?": the time large, then three buttons that move it in steps. */
export function FinishTime(p: FinishTimeProps) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-control bg-surface p-4">
      <h2 className="text-body font-bold">{p.title}</h2>
      <div className="flex items-baseline justify-between gap-3">
        <output aria-label={p.label} className="text-title1 font-extrabold leading-tight">
          {p.time}
        </output>
        <span className="text-footnote text-neutral-600">{p.status}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <StepButton
          label={p.earlier}
          enabled={p.canEarlier}
          pressed={false}
          onClick={p.onEarlier}
        />
        <StepButton label={p.now} enabled={p.canNow} pressed={p.isNow} onClick={p.onNow} />
        <StepButton label={p.later} enabled={p.canLater} pressed={false} onClick={p.onLater} />
      </div>
      <p className="text-footnote text-neutral-600">{p.hint}</p>
    </section>
  );
}

/** A hint line over the screen's one primary button, pinned to the bottom. */
export function ScreenFooter({ hint, children }: { hint: string; children: ReactNode }) {
  return (
    <footer className="sticky bottom-0 flex flex-col gap-3 border-t border-neutral-200 bg-surface p-4">
      <p className="text-center text-footnote text-neutral-600">{hint}</p>
      {children}
    </footer>
  );
}

/** A label over one control; `id` is the control's id. */
export function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
