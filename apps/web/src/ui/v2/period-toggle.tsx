import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Segmented } from './segmented.js';
import { SelectField } from './select-field.js';

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

/**
 * The years a page reads (ADR 0063): the default first (the empty key: this year, with trends over every year), then
 * each year that has records, then every year (`all`). The page keeps the choice in the URL (`?years=2024`).
 */
export function YearPicker({
  years,
  value,
  onChange,
}: {
  /** The calendar years the plant has records in, oldest first. */
  years: readonly number[];
  /** `''` for the default, a year such as `2024`, or `all`. */
  value: string;
  onChange: (years: string) => void;
}): ReactNode {
  const { t } = useTranslation();
  const options = [...years].reverse().map((year) => ({ key: String(year), label: String(year) }));
  // A year the address names that the plant has no record in (a pasted range) still shows as chosen.
  if (value !== '' && value !== 'all' && !options.some((o) => o.key === value))
    options.unshift({ key: value, label: value });
  return (
    <SelectField
      label={t('insight.years.label')}
      all={t('insight.years.default')}
      value={value}
      // eslint-disable-next-line i18next/no-literal-string -- the URL's value for every year, not copy
      options={[...options, { key: 'all', label: t('insight.years.all') }]}
      onChange={onChange}
    />
  );
}
