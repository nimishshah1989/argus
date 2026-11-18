import type { FiguresReply } from '@uptimo/shared/analytics';
import { KeyPage } from './KeyPage.js';
import type { AnalyticsGroup } from './groups.js';

type Figure = FiguresReply['figures'][number];

/**
 * A9 Bottleneck Analysis (packet 42e): the key page rendered through the existing KeyPage seam, so its 14 KPIs,
 * nine tables, risk map and planning-forecast chart all come from the engine, and its machine drill is the
 * engine's production fleet. The mapper marks the risk, forecast, trend and repeat tables sortable; PageFigure
 * draws them in the face's one sortable table. Nothing here paints a cell the engine did not send.
 */
export function A9Page({ figure, group }: { figure: Figure | undefined; group: AnalyticsGroup }) {
  return <KeyPage figure={figure} group={group} />;
}
