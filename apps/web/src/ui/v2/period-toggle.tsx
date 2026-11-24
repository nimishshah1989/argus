/* eslint-disable @typescript-eslint/no-unused-vars -- skeleton: the builder fills the bodies and deletes this line */
import type { ReactNode } from 'react';

/** The page's one period (ADR 0036 R4): days so far this year, or the full year. Only the divisor changes. */
export type Period = 'sofar' | 'full';

/**
 * Reads the period from a URL search string such as `location.search` (with or without the leading `?`).
 * `new URLSearchParams(search).get('period') === 'full'` → `'full'`; anything else (no `period`, an empty one,
 * an unknown value, a different case such as `FULL`) → `'sofar'`. Every other param is ignored.
 */
export function periodFrom(search: string): Period {
  throw new Error('not implemented');
}

/**
 * The period choice as one kit toggle (ADR 0036 R4, #693): returns
 * `<Segmented label={t('insight.period.label')} options={[{ key: 'sofar', label: t('insight.period.sofar') },
 * { key: 'full', label: t('insight.period.full') }]} value={value} onChange={onChange} />`, in that option order.
 * Words via `useTranslation()` as in `table-parts.tsx`. No CSS of its own (`Segmented` brings `.v2-segmented`).
 * The page keeps the choice in the URL (`?period=full`) and reads it back with `periodFrom`.
 */
export function PeriodToggle({
  value,
  onChange,
}: {
  value: Period;
  onChange: (period: Period) => void;
}): ReactNode {
  throw new Error('not implemented');
}
