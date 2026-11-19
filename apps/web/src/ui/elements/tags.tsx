import { Clock } from '../icon.js';
import { TONE_ICON, type Tone4 } from '../meaning/index.js';
import { StatusChip } from './status-chip.js';
import { TONE_INK } from './tone.js';

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
    <span className="mt-2 flex flex-wrap gap-2">
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
