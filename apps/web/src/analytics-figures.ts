import { useQuery } from '@tanstack/react-query';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { defineResource } from './data/index.js';

const analyticsFigures = defineResource<FiguresReply>({
  key: 'analytics-figures',
  path: '/api/v1/analytics/figures',
});

/**
 * `GET /analytics/figures`: every figure the menu shows, as of the plant's today (or an earlier date, for a change).
 * The query is shared so code outside a component (the v2 screens' live source) fills and reads the same cache.
 */
export const analyticsFiguresQuery = {
  queryKey: ['analytics-figures', 'one', null],
  queryFn: () => analyticsFigures.one(),
} as const;
export const useAnalyticsFigures = () => useQuery(analyticsFiguresQuery);
export const useAnalyticsFiguresAt = (asOf: string) =>
  useQuery({
    queryKey: ['analytics-figures', 'at', asOf],
    queryFn: () => analyticsFigures.list({ asOf }) as unknown as Promise<FiguresReply>,
  });
