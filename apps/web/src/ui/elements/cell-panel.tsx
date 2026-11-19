import type { Tone4 } from '../meaning/index.js';
import { Sparkline } from './sparkline.js';
import { Tag, type TagSpec } from './tags.js';
import { TONE_EDGE, WRAP } from './tone.js';

/** What a figure with no value prints: a dash, never 0. */
const NONE = '—';

export interface CellItem {
  id: string;
  name: string;
  /** The value already printed without its unit; `null` (no records) prints a dash and the `empty` words. */
  value: string | null;
  unit?: string;
  /** How the cell did against the whole, by the direction of good. Said in words by `tag`. */
  tone: Tone4;
  tag?: TagSpec;
  /** Its months, a null for a month with no records. */
  series: readonly (number | null)[];
  /** The line to read the series against (the plant's own), dotted. */
  seriesLabel: string;
}

/**
 * Small multiples: one tile per cell (or line, or plant) with its figure, a tag that says in words whether it did
 * better or worse than the whole, and its months as a line against the whole's. `active` is the month pointed at in
 * another chart on the page; the line marks it. The tile's edge repeats the tone, never alone: the tag has the word.
 */
export function CellPanel({
  title,
  summary,
  note,
  cells,
  reference,
  active,
  partial = false,
  empty,
}: {
  title: string;
  summary?: string;
  note?: string;
  cells: CellItem[];
  reference?: readonly (number | null)[];
  active?: number | null;
  partial?: boolean;
  /** The words for a cell with no records. */
  empty: string;
}) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h3 className="text-body font-semibold">{title}</h3>
        {summary ? <p className="text-footnote text-neutral-600">{summary}</p> : null}
        {note ? <p className="text-footnote text-neutral-600">{note}</p> : null}
      </header>
      <ul data-testid="cell-panel" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cells.map((cell) => (
          <CellTile
            key={cell.id}
            cell={cell}
            reference={reference}
            active={active}
            partial={partial}
            empty={empty}
          />
        ))}
      </ul>
    </section>
  );
}

function CellTile({
  cell,
  reference,
  active,
  partial,
  empty,
}: {
  cell: CellItem;
  reference?: readonly (number | null)[];
  active?: number | null;
  partial: boolean;
  empty: string;
}) {
  // A colour is only used where the tag says it in words.
  const tone = cell.tag ? cell.tone : 'neutral';
  return (
    <li
      data-tone={tone}
      className={`flex min-w-0 flex-col gap-2 rounded-tile border-l-4 bg-surface p-3 shadow-card ${TONE_EDGE[tone]}`}
    >
      <span className={`text-footnote font-semibold ${WRAP}`}>{cell.name}</span>
      <span className="text-title3 font-bold tabular-nums">
        {cell.value ?? NONE}
        {cell.value !== null && cell.unit ? (
          <span className="text-footnote font-normal text-neutral-600"> {cell.unit}</span>
        ) : null}
      </span>
      <span>
        {cell.value === null ? (
          <span className="text-footnote text-neutral-600">{empty}</span>
        ) : cell.tag ? (
          <Tag tag={cell.tag} />
        ) : null}
      </span>
      <Sparkline
        wide
        values={cell.series}
        reference={reference}
        active={active}
        partial={partial}
        tone={tone}
        label={cell.seriesLabel}
      />
    </li>
  );
}
