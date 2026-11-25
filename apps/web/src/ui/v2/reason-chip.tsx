import type { ReactElement } from 'react';

/** One reason in a table cell, already worded by the screen (e.g. "Repeat"); `n` is how many times it happened. */
export type Reason = { text: string; n?: number };

/**
 * A table cell's reasons as grey chips, the way Bhavin's "Why" column reads (ADR 0036 R17). Copy `KeyPill` in
 * `key-pill.tsx` for the shape. Exactly:
 * - `reasons` is empty → return `null` (nothing rendered).
 * - Otherwise one wrapper `<span className="v2-reasons">` holding, for each reason in the order given, one
 *   `<span className="v2-reason" key={i}>` whose only child is ONE string: `` `${text} ×${n}` `` when `n` is a number
 *   greater than 1 (e.g. "Repeat ×3"; the × is U+00D7 with one plain space before it), else just `text` (n absent, 0
 *   or 1 → "Repeat"). Build the string first, so the chip has a single text child.
 * - No words of its own (the screen passes them in), no icon, no tone prop.
 * - Styles go in `reason-chip.css` beside this file (loaded by `sheets.ts` automatically, no import needed): neutral
 *   tokens only, as `.v2-pill-neutral` in `v2.css` (`background: var(--color-v2-track); color: var(--color-v2-ink-2)`),
 *   never a status colour (no good/watch/bad/loss/risk tokens); a gap between chips via `.v2-reasons`.
 */
export function ReasonChips({ reasons }: { reasons: readonly Reason[] }): ReactElement | null {
  if (reasons.length === 0) return null;
  return (
    <span className="v2-reasons">
      {reasons.map(({ text, n }, i) => (
        <span className="v2-reason" key={i}>
          {n !== undefined && n > 1 ? `${text} ×${n}` : text}
        </span>
      ))}
    </span>
  );
}
