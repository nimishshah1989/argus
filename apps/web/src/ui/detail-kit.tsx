import type { ReactNode } from 'react';
import type { Tone } from './status/index.js';

/** The small pieces of a record screen (design lock B2): section title, fact list, minute tiles, people, history. */

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-caption font-bold uppercase tracking-wide text-neutral-600">{children}</h2>
  );
}

export interface FactRow {
  label: string;
  value: ReactNode;
}

/** Label left, value right, one row per fact inside one card. */
export function FactList({ rows }: { rows: FactRow[] }) {
  return (
    <dl className="divide-y divide-neutral-200 overflow-hidden rounded-2xl bg-surface shadow-card">
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between gap-4 px-4 py-3">
          <dt className="text-body text-neutral-600">{row.label}</dt>
          <dd className="text-right text-body font-bold">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface MinuteTile {
  label: string;
  value: string;
  hint?: string;
}

/** Two figures take the halves the mockup draws; three take thirds. */
export function minuteTileColumns(count: number): 2 | 3 {
  return count === 2 ? 2 : 3;
}

const COLUMNS = { 2: 'grid-cols-2', 3: 'grid-cols-3' } as const;

/** Figures side by side: a small label, the number big, a hint under it. */
export function MinuteTiles({ tiles }: { tiles: MinuteTile[] }) {
  return (
    <dl className={`grid ${COLUMNS[minuteTileColumns(tiles.length)]} gap-2`}>
      {tiles.map((tile) => (
        <div key={tile.label} className="flex flex-col rounded-2xl bg-surface p-3 shadow-card">
          <dt className="text-caption text-neutral-600">{tile.label}</dt>
          <dd className="text-title3 font-extrabold leading-tight">{tile.value}</dd>
          {tile.hint ? <dd className="text-caption text-neutral-600">{tile.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

export interface PersonRow {
  key: string;
  name: string;
  sub: string;
  value?: string;
}

export function PersonRows({ rows }: { rows: PersonRow[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li
          key={row.key}
          className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-4 shadow-card"
        >
          <div className="flex min-w-0 flex-col">
            <span className="text-body font-bold">{row.name}</span>
            <span className="text-caption text-neutral-600">{row.sub}</span>
          </div>
          {row.value ? <span className="shrink-0 text-body font-bold">{row.value}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export interface HistoryItem {
  key: string | number;
  tone: Tone;
  title: string;
  /** ISO time, shown as the machine-readable value of `when`. */
  at: string;
  when: string;
  detail?: string;
  /** An action a record's own state offers, drawn under its line (the page passes the link, the kit does not). */
  action?: ReactNode;
}

const DOT: Record<Tone, string> = {
  danger: 'bg-danger',
  info: 'bg-info',
  warning: 'bg-warning',
  hold: 'bg-hold',
  moved: 'bg-moved',
  ok: 'bg-ok',
  muted: 'bg-muted',
};

/** A vertical timeline: a coloured dot per event on a thin line, the title, then time and who or what. */
export function HistoryList({ items }: { items: HistoryItem[] }) {
  return (
    <ol className="flex flex-col">
      {items.map((item, index) => (
        <li key={item.key} className="flex gap-3">
          <div aria-hidden className="flex w-3 shrink-0 flex-col items-center">
            <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${DOT[item.tone]}`} />
            {index < items.length - 1 ? <span className="w-0.5 flex-1 bg-neutral-300" /> : null}
          </div>
          <div className="flex min-w-0 flex-col pb-4">
            <span className="text-body font-bold">{item.title}</span>
            <span className="text-footnote text-neutral-600">
              <time dateTime={item.at}>{item.when}</time>
              {item.detail ? ` · ${item.detail}` : null}
            </span>
            {item.action ? <div className="mt-2">{item.action}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
