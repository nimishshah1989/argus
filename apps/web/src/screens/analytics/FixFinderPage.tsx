import type { FiguresReply } from '@uptimo/shared/analytics';
import { KeyPage } from './KeyPage.js';
import type { AnalyticsGroup } from './groups.js';

type Figure = FiguresReply['figures'][number];

/**
 * Fix Finder (43e): the key page through the same seam — its four KPIs and the 15 similar breakdowns, in the
 * engine's similarity order — and its ticket drill. The table sorts in the face's one sortable table.
 */
export function FixFinderPage({
  figure,
  group,
}: {
  figure: Figure | undefined;
  group: AnalyticsGroup;
}) {
  return <KeyPage figure={figure} group={group} />;
}
