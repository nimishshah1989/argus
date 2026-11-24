/* eslint-disable @typescript-eslint/no-unused-vars -- skeleton: the builder fills the bodies and deletes this line */
import type { ReactElement } from 'react';

/** How urgent a strip is (ADR 0036 R2): high wears the bad status, medium watch, low neutral. */
export type Severity = 'high' | 'medium' | 'low';

/** One action strip: a count, what it counts, and the way in. Every word comes in as a prop. */
export type Strip = {
  key: string;
  count: number;
  /** What is counted ("high-priority nudges need attention"). */
  what: string;
  href: string;
  /** The link's own words ("Open Action Center"). */
  link: string;
  severity: Severity;
};

/**
 * The strips a page shows (ADR 0036 R2): drop every strip with `count <= 0`, order high → medium → low keeping the
 * input order within a severity (stable), keep the first 3.
 */
export function topStrips(strips: Strip[]): Strip[] {
  throw new Error('not implemented');
}

/**
 * Up to 3 strips at the page top (ADR 0036 R2), from `topStrips(strips)`: inside `<div class="v2-strips">`, each an
 * `<a class="v2-strip" data-severity={severity} href={href}>` holding `<strong>{count}</strong> {what}` then `{link}`
 * (pattern: `Banner` in `banner.tsx`). Edge colour from `[data-severity]` in `action-strip.css` (status tokens only).
 * Nothing left → `null`.
 */
export function ActionStrips({ strips }: { strips: Strip[] }): ReactElement | null {
  throw new Error('not implemented');
}
