import { useTranslation } from 'react-i18next';
import { Check, LayoutGrid } from './icon.js';
import {
  TONE_FILL,
  TONE_TEXT,
  segmentIcon,
  statusMeaning,
  type ChipTone,
  type StatusRef,
} from './meaning.js';

/** What a chip filters by: a status (its tone and word), a segment (shape only, muted) or everything. */
export type ChipFilter =
  { status: StatusRef } | { segment: { code: string; name: string } } | { all: string };

function useLook(filter: ChipFilter) {
  const { t } = useTranslation();
  if ('status' in filter) {
    const { tone, icon, label } = statusMeaning(filter.status);
    return { tone, icon, label: t(label) };
  }
  if ('segment' in filter)
    return {
      tone: 'muted' as const,
      icon: segmentIcon(filter.segment.code),
      label: filter.segment.name,
    };
  return { tone: 'accent' as const, icon: LayoutGrid, label: filter.all };
}

/**
 * A tappable filter: icon, word and count, 44 px tall. Pressed shows a tint, a 2 px ring and a tick, so
 * the state reads without colour.
 */
export function FilterChip({
  filter,
  count,
  pressed,
  onClick,
}: {
  filter: ChipFilter;
  count: number;
  pressed: boolean;
  onClick: () => void;
}) {
  const { tone, icon: Icon, label } = useLook(filter);
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex min-h-target-min items-center gap-1.5 whitespace-nowrap rounded-full text-footnote font-semibold ${chipClass(tone, pressed)}`}
    >
      <Icon aria-hidden size={18} className={pressed ? undefined : TONE_TEXT[tone]} />
      {label}
      <span className="font-extrabold">{count}</span>
      {pressed ? <Check aria-hidden size={16} strokeWidth={3} /> : null}
    </button>
  );
}

function chipClass(tone: ChipTone, pressed: boolean): string {
  if (!pressed) return 'border border-control bg-surface px-3.5 text-neutral-900';
  const fill = tone === 'muted' ? 'bg-muted-tint text-neutral-900' : TONE_FILL[tone];
  return `border-2 border-current px-[13px] ${fill}`;
}
