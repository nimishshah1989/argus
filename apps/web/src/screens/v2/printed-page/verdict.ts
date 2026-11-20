import type { VerdictData } from '../../../ui/v2/verdict.js';
import type { Point } from '../../../ui/v2/points.js';
import type { PageKpi } from '../../analytics/page-content.js';
import type { Page } from './printed.js';

/** The figure the engine labelled so; undefined when this plant's page has none. */
export const kpiOf = (page: Page, label: string): PageKpi | undefined =>
  page.kpis.find((kpi) => kpi.label === label);

/** The answer first: a sentence, the lines behind it, and where the numbers come from. A line that could not be said is left out. */
export function verdictOf(headline: Point, why: (Point | null)[], context: string): VerdictData {
  return { headline, why: why.filter((point): point is Point => point !== null), context };
}
