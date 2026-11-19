import type { ReactNode } from 'react';
import type { IconComponent } from './icon.js';

/** Floor kit pieces (lock: machine row, group tile, choice card, quick-problem chip, machine card). */

const CARD = 'rounded-card bg-surface shadow-card';
const TAP = `${CARD} w-full text-left transition-colors duration-(--motion-fast) active:bg-pressed active:shadow-none`;

/** One machine in a search or group list: code, a detail line, its status pill on the right. */
export function MachineRow(p: {
  code: string;
  detail: string;
  status: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={p.onClick}
      className={`${TAP} flex min-h-16 items-center gap-3 px-4 py-3`}
    >
      <span className="flex flex-1 flex-col">
        <span className="text-title3 font-bold text-neutral-900">{p.code}</span>
        <span className="text-footnote text-neutral-600">{p.detail}</span>
      </span>
      {p.status}
    </button>
  );
}

/** A segment heading with its machine count, then its group tiles two to a row. */
export function GroupSection(p: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="flex justify-between text-footnote font-bold text-neutral-900">
        <span>{p.title}</span>
        <span>{p.count}</span>
      </h4>
      <div className="grid grid-cols-2 gap-2">{p.children}</div>
    </section>
  );
}

/** A group of machines: short code in the accent, its name, how many machines. */
export function GroupTile(p: { code: string; name: string; count: string; onClick: () => void }) {
  return (
    <button type="button" onClick={p.onClick} className={`${TAP} flex min-h-21 flex-col gap-1 p-4`}>
      <span className="text-title2 font-bold text-accent-text">{p.code}</span>
      {p.name !== p.code ? <span className="text-footnote text-neutral-900">{p.name}</span> : null}
      <span className="text-caption text-neutral-600">{p.count}</span>
    </button>
  );
}

const CHOICE_TONE = {
  danger: 'bg-danger-tint text-danger-ink',
  warning: 'bg-warning-tint text-warning-ink',
  neutral: 'bg-neutral-100 text-neutral-900',
};

/** A big one-tap choice: tinted icon, a bold title, one line of what it means. */
export function ChoiceCard(p: {
  icon: IconComponent;
  tone: keyof typeof CHOICE_TONE;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  const Icon = p.icon;
  return (
    <button
      type="button"
      onClick={p.onClick}
      className={`${TAP} flex min-h-21 items-center gap-4 border border-control p-4`}
    >
      <span
        className={`flex size-12 shrink-0 items-center justify-center rounded-control ${CHOICE_TONE[p.tone]}`}
      >
        <Icon aria-hidden size={22} />
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-title3 font-bold text-neutral-900">{p.title}</span>
        <span className="text-footnote text-neutral-600">{p.detail}</span>
      </span>
    </button>
  );
}

/** A round chip: a quick problem, a recent machine, a choice in a short set. */
export function QuickChip(p: { label: string; pressed?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={p.pressed}
      onClick={p.onClick}
      className="min-h-target-min rounded-chip border border-control bg-surface px-4 text-footnote text-neutral-900 aria-pressed:border-accent-strong aria-pressed:bg-accent-tint aria-pressed:text-accent-text"
    >
      {p.label}
    </button>
  );
}

/** The machine a report is about: a small label, the code, its detail, a status pill. */
export function MachineCard(p: {
  code: string;
  label?: string;
  detail?: string;
  status?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className={`${CARD} flex flex-col gap-1 p-4`}>
      {p.label ? <span className="text-footnote font-bold text-neutral-600">{p.label}</span> : null}
      <span className="flex items-center justify-between gap-2">
        <span className={`${p.label ? 'text-title1' : 'text-title2'} font-bold text-neutral-900`}>
          {p.code}
        </span>
        {p.status}
      </span>
      {p.detail ? <span className="text-footnote text-neutral-600">{p.detail}</span> : null}
      {p.children}
    </section>
  );
}
