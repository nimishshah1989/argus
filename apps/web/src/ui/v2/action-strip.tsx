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

const RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/**
 * The strips a page shows (ADR 0036 R2): drop every strip with `count <= 0`, order high → medium → low keeping the
 * input order within a severity (stable), keep the first 3.
 */
export function topStrips(strips: Strip[]): Strip[] {
  return strips
    .filter((s) => s.count > 0)
    .sort((a, b) => RANK[a.severity] - RANK[b.severity])
    .slice(0, 3);
}

/**
 * Up to 3 strips at the page top (ADR 0036 R2), from `topStrips(strips)`: inside `<div class="v2-strips">`, each an
 * `<a class="v2-strip" data-severity={severity} href={href}>` holding `<strong>{count}</strong> {what}` then
 * `<span class="v2-strip-link">{link}</span>` (pattern: `Banner` in `banner.tsx`). Edge colour from `[data-severity]` in `action-strip.css` (status tokens only).
 * Nothing left → `null`.
 */
export function ActionStrips({ strips }: { strips: Strip[] }): ReactElement | null {
  const kept = topStrips(strips);
  if (kept.length === 0) return null;
  return (
    <div className="v2-strips">
      {kept.map((s) => (
        <a key={s.key} className="v2-strip" data-severity={s.severity} href={s.href}>
          <strong>{s.count}</strong> {s.what}
          <span className="v2-strip-link">{s.link}</span>
        </a>
      ))}
    </div>
  );
}
