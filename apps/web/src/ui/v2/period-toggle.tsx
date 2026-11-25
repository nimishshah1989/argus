import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Segmented } from './segmented.js';

/** The page's one period (ADR 0036 R4): days so far this year, or the full year. Only the divisor changes. */
export type Period = 'sofar' | 'full';

const PERIODS: readonly Period[] = ['sofar', 'full'];

/**
 * Reads the period from a URL search string such as `location.search` (with or without the leading `?`).
 * `new URLSearchParams(search).get('period') === 'full'` → `'full'`; anything else (no `period`, an empty one,
 * an unknown value, a different case such as `FULL`) → `'sofar'`. Every other param is ignored.
 */
export function periodFrom(search: string): Period {
  return new URLSearchParams(search).get('period') === 'full' ? 'full' : 'sofar';
}

/**
 * The period choice as one kit toggle (ADR 0036 R4): returns
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
  const { t } = useTranslation();
  return (
    <Segmented
      label={t('insight.period.label')}
      options={PERIODS.map((key) => ({ key, label: t(`insight.period.${key}`) }))}
      value={value}
      onChange={onChange}
    />
  );
}
