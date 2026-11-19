import { Clock } from '../icon.js';
import { TONE_ICON, type Tone4 } from '../meaning/index.js';
import { StatusChip } from './status-chip.js';
import { TONE_BOX, TONE_INK } from './tone.js';

/** A tag is a tone, a word and an icon (the tone's own, or a clock for a month still running); colour is never alone. */
export interface TagSpec {
  tone: Tone4;
  word: string;
  /** A different icon from the tone's own: `clock` marks something still running. */
  icon?: 'clock';
  /** Hidden extra for a screen reader, such as the month a tag is about. */
  more?: string;
}

/** One status pill: a soft tint, an icon and a word. */
export function Tag({ tag }: { tag: TagSpec }) {
  return (
    <span data-testid="tag" data-tone={tag.tone} className="contents">
      <StatusChip tone={tag.tone} icon={tag.icon === 'clock' ? Clock : undefined}>
        {tag.word}
        {tag.more ? <span className="sr-only"> {tag.more}</span> : null}
      </StatusChip>
    </span>
  );
}

/** A row of tags; none draws nothing. */
export function Tags({ list }: { list: TagSpec[] }) {
  if (list.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-2">
      {list.map((tag) => (
        <Tag key={tag.word} tag={tag} />
      ))}
    </span>
  );
}

/** The icon of a tag on its own, for a row header: the word stays in the page for a screen reader. */
export function TagGlyph({ tag }: { tag: TagSpec }) {
  const Icon = tag.icon === 'clock' ? Clock : TONE_ICON[tag.tone];
  return (
    <>
      <Icon
        aria-hidden
        size={14}
        data-tone={tag.tone}
        className={`inline shrink-0 ${TONE_INK[tag.tone]}`}
      />
      <span className="sr-only"> {tag.word}</span>
    </>
  );
}

const PATH: Record<Tone4 | 'clock', string> = {
  good: 'M2.5 6.5 5 9l4.5-5.5',
  watch: 'M6 2 10.5 10h-9ZM6 5.2v2.3M6 8.7h.01',
  bad: 'M3 3l6 6M9 3 3 9',
  neutral: 'M3 6h6',
  clock: 'M6 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM6 4v2.2l1.4.9',
};

const esc = (text: string): string => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** The tag as markup for an ECharts tooltip, which cannot hold a component; it wears the same classes as `Tag`. */
export function tagHtml(tag: TagSpec): string {
  const more = tag.more ? `<span class="sr-only"> ${esc(tag.more)}</span>` : '';
  const path = PATH[tag.icon ?? tag.tone];
  return `<span data-tone="${tag.tone}" class="inline-flex min-h-chip max-w-full items-center gap-2 rounded-chip px-3 text-caption font-bold ${TONE_BOX[tag.tone]}"><svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>${esc(tag.word)}${more}</span>`;
}
