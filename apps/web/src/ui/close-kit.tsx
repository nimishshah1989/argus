/* eslint-disable i18next/no-literal-string -- prop values only; every visible string goes through t() */
import type { ReactNode } from 'react';
import { Button } from './button.js';
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
  canLater: boolean;
  onEarlier: () => void;
  onNow: () => void;
  onLater: () => void;
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
        <Button variant="secondary" disabled={!p.canEarlier} onClick={p.onEarlier}>
          {p.earlier}
        </Button>
        <Button variant="secondary" disabled={!p.canNow} onClick={p.onNow}>
          {p.now}
        </Button>
        <Button variant="secondary" disabled={!p.canLater} onClick={p.onLater}>
          {p.later}
        </Button>
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
