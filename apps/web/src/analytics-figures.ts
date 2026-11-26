import { useQuery } from '@tanstack/react-query';
import { yearsChoice, type FiguresReply } from '@uptimo/shared/analytics';
import { defineResource } from './data/index.js';

const analyticsFigures = defineResource<FiguresReply>({
  key: 'analytics-figures',
  path: '/api/v1/analytics/figures',
});

/**
 * The years the page's address asks for (`?years=2024`, `2022-2026` or `all`, ADR 0063), or null for the default read.
 * A value the server would refuse is read as the default, so a mistyped link still opens the page.
 */
export function yearsFrom(search: string): string | null {
  const asked = new URLSearchParams(search).get('years');
  return asked !== null && yearsChoice(asked) !== null ? asked : null;
}

/** The address bar's years, read when a query is made: the one place every figures read learns the reader's choice. */
const yearsNow = (): string | null => yearsFrom(globalThis.location?.search ?? '');

/** The figures for one year choice; null is the default read. */
const figuresFor = (years: string | null) => ({
  queryKey: ['analytics-figures', 'one', years] as const,
  queryFn: () =>
    years === null
      ? analyticsFigures.one()
      : (analyticsFigures.list({ years }) as unknown as Promise<FiguresReply>),
});

/**
 * `GET /analytics/figures`: every figure the menu shows, as of the plant's today (or an earlier date, for a change),
 * over the years the page's address asks for. The query is shared so code outside a component (the v2 screens' live
 * source) fills and reads the same cache; its key is read afresh each time, so each year choice has its own copy.
 */
export const analyticsFiguresQuery = {
  get queryKey() {
    return figuresFor(yearsNow()).queryKey;
  },
  queryFn: ({ queryKey }: { queryKey: readonly unknown[] }) =>
    figuresFor((queryKey[2] as string | null | undefined) ?? null).queryFn(),
};
export const useAnalyticsFigures = () =>
  useQuery({ queryKey: analyticsFiguresQuery.queryKey, queryFn: analyticsFiguresQuery.queryFn });
/** The same figures as they stood on an earlier plant day (a figure's change is against that day), over the same years. */
export const analyticsFiguresAtQuery = (asOf: string) => {
  const years = yearsNow();
  return {
    queryKey: ['analytics-figures', 'at', asOf, years],
    queryFn: () =>
      analyticsFigures.list({
        asOf,
        ...(years !== null && { years }),
      }) as unknown as Promise<FiguresReply>,
  };
};
