import type { FiguresReply } from '@uptimo/shared/analytics';
import { KeyPage } from './KeyPage.js';
import type { AnalyticsGroup } from './groups.js';

type Figure = FiguresReply['figures'][number];

/**
 * The Forecast Lab (packet 42e): the key page through the same seam — no KPIs, the method and month tables and
 * the month-by-month line chart — and its machine drill. The tables are the engine’s own cells; the mapper
 * marks both sortable and `page-content.ts` gives `ch-fl` the four method lines and the actual.
 */
export function ForecastLabPage({
  figure,
  group,
}: {
  figure: Figure | undefined;
  group: AnalyticsGroup;
}) {
  return <KeyPage figure={figure} group={group} />;
}
