import type { Tone4 } from '../meaning/index.js';
import { StatusChip } from './status-chip.js';
import { TONE_BAR, WRAP } from './tone.js';

export interface RankedItem {
  id: string;
  label: string;
  value: number;
  /** The value printed with its unit. */
  display: string;
  tone?: Tone4;
  /** What the tone means in words ("Over target"); a tone with no word is not drawn, so colour is never alone. */
  word?: string;
}

/** A bar's share of the longest bar, as a whole percentage; a negative or empty total is 0. */
export function barShare(value: number, max: number): number {
  return max <= 0 || value <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
}

/**
 * Items in falling order of value (the list sorts them), each with its rank, label, printed value and a bar. The
 * bar repeats the number; it never carries it.
 */
export function RankedList({ items, anchor }: { items: RankedItem[]; anchor?: boolean }) {
  if (items.length === 0) return null;
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const max = sorted[0]!.value;
  return (
    <ol className="flex flex-col gap-3">
      {sorted.map((item, at) => (
        <li key={item.id} className="flex min-w-0 items-start gap-3">
          <span className="w-6 shrink-0 text-right text-footnote font-semibold tabular-nums text-neutral-600">
            {at + 1}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className={`text-body ${WRAP}`}>{item.label}</span>
              <span className={`text-right text-body font-semibold tabular-nums ${WRAP}`}>
                {item.display}
              </span>
            </div>
            <span aria-hidden className="block h-2 rounded-full bg-neutral-200">
              <span
                data-bar
                style={{ width: `${barShare(item.value, max)}%` }}
                className={`block h-2 rounded-full ${anchor && at === 0 && !item.word ? 'bg-accent-strong' : TONE_BAR[item.word ? (item.tone ?? 'neutral') : 'neutral']}`}
              />
            </span>
            {item.word ? <StatusChip tone={item.tone ?? 'neutral'}>{item.word}</StatusChip> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
