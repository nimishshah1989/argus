import type { TFunction } from 'i18next';
import { compareReplySchema, type CompareReply } from '@uptimo/shared/compare-pair';
import { http } from '../../../data/index.js';
import { NotComputed } from '../figures/live-error.js';
import { pageOf } from '../printed-page/printed.js';
import { compareModel } from './adapter.js';
import type { CompareModel, CompareParams } from './model.js';

/**
 * Compare's live read (ticket 587, ADR 0021): `GET /api/v1/analytics/compare` for the asked pair, parsed with
 * `compareReplySchema` at this boundary. An empty `a` or `b` asks for the engine's own pair (no query string at all);
 * otherwise `?a=<code>&b=<code>`, each `encodeURIComponent`-ed. Query key: `['analytics-compare', a, b]`.
 */
export function compareQuery({ a, b }: CompareParams): {
  queryKey: readonly ['analytics-compare', string, string];
  queryFn: () => Promise<CompareReply>;
} {
  const path = '/api/v1/analytics/compare';
  const url = a && b ? `${path}?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}` : path;
  return {
    queryKey: ['analytics-compare', a, b],
    queryFn: async () => compareReplySchema.parse(await http<unknown>(url)),
  };
}

/**
 * The Compare model from the reply: `NotComputed` when the plant has no comparison (`figure.value` null, `years` null
 * or the figure's page unreadable through `pageOf`), else `compareModel(reply, page, t)`.
 */
export function liveCompare(reply: CompareReply, t: TFunction): CompareModel {
  const page = pageOf(reply.figure, t);
  if (page === null || reply.pair === null || reply.years === null) throw new NotComputed();
  return compareModel({ ...reply, pair: reply.pair, years: reply.years }, page, t);
}
