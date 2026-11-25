/* eslint-disable @typescript-eslint/no-unused-vars -- skeleton: the builder fills the body and deletes this line */
import type { ReactNode } from 'react';

/** How many issues a page ranks at each severity (ADR 0036 R3). Whole numbers; 0 is a real count. */
export type SeverityCounts = { high: number; medium: number; low: number; good: number };

/**
 * One row of four counts on a page that ranks issues (ADR 0036 R3, #692). Wrapper `<div class="v2-severity-row">`;
 * inside, always exactly four items, always in the order high, medium, low, good (never the key order of `counts`),
 * each `<div data-severity="<key>"><strong>{n}</strong> {t('insight.severity.<key>')}</div>`. A count of 0 is still
 * shown as `<strong>0</strong>`; no item is ever hidden. Words via `useTranslation()` as in `table-parts.tsx`.
 * Colours in `severity-row.css` (auto-loaded by `sheets.ts`), keyed on `[data-severity]`, status tokens only:
 * high → `--color-v2-bad-*`, medium → `-watch-*`, low → `-neutral-*`, good → `-good-*` (written by Plan).
 */
export function SeverityRow({ counts }: { counts: SeverityCounts }): ReactNode {
  throw new Error('not implemented');
}
