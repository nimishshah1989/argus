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
/** The same figures as they stood on an earlier plant day, for a change against it. */
export const analyticsFiguresAtQuery = (asOf: string) => ({
  queryKey: ['analytics-figures', 'at', asOf],
  queryFn: () => analyticsFigures.list({ asOf }) as unknown as Promise<FiguresReply>,
});
