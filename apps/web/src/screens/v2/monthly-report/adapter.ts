import type { TFunction } from 'i18next';
import type { FiguresPart } from '../printed-page/printed.js';
import type { MonthlyReportModel } from './model.js';

/** The engine's figure this screen is built from. */
export const FIGURE = 'monthly-report';

/**
 * The Monthly Report from the engine's `monthly-report` figure, whole (2 charts, 8 tables), with the period line, the
 * two downloads and one takeaway per section (#763). Null when the engine has no page.
 */
export function monthlyReportModel(_reply: FiguresPart, _t: TFunction): MonthlyReportModel | null {
  throw new Error('not built: #763');
}
