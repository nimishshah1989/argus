import type { IconComponent } from './icon.js';
import type { Tone } from './status/index.js';
import { TONE_TEXT } from './meaning.js';

export interface CountItem {
  id: string;
  label: string;
  value: number;
  tone: Tone;
  icon: IconComponent;
}

/** A row of counts, each a toggle that filters the list under it (tap again to show all). */
export function CountsStrip({
  label,
  items,
  selected,
  onSelect,
}: {
  label: string;
  items: CountItem[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-4 gap-2">
      {items.map(({ id, label: itemLabel, value, tone, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={id === selected}
          onClick={() => onSelect(id === selected ? '' : id)}
          className="flex min-h-21 flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-surface px-1 py-2 text-center aria-pressed:ring-2 aria-pressed:ring-accent-strong"
        >
          <Icon aria-hidden size={16} className={TONE_TEXT[tone]} />
          <span className={`text-title2 font-bold leading-tight ${TONE_TEXT[tone]}`}>{value}</span>
          <span className="text-caption leading-tight text-neutral-600">{itemLabel}</span>
        </button>
      ))}
    </div>
  );
}
