import type { TFunction } from 'i18next';
import type { CompareReply } from '@uptimo/shared/compare-pair';
import type { CompareModel, CompareParams } from './model.js';

/**
 * Compare's live read (ticket 587, ADR 0020): `GET /api/v1/analytics/compare` for the asked pair, parsed with
 * `compareReplySchema` at this boundary. An empty `a` or `b` asks for the engine's own pair (no query string at all);
 * otherwise `?a=<code>&b=<code>`, each `encodeURIComponent`-ed. Query key: `['analytics-compare', a, b]`.
 */
export function compareQuery(pair: CompareParams): {
  queryKey: readonly ['analytics-compare', string, string];
  queryFn: () => Promise<CompareReply>;
} {
  void pair;
  throw new Error('not built');
}

/**
 * The Compare model from the reply: `NotComputed` when the plant has no comparison (`figure.value` null, `years` null
 * or the figure's page unreadable through `pageOf`), else `compareModel(reply, page, t)`.
 */
export function liveCompare(reply: CompareReply, t: TFunction): CompareModel {
  void reply;
  void t;
  throw new Error('not built');
}
