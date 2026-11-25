import type { TFunction } from 'i18next';
import type { FiguresPart } from '../printed-page/printed.js';
import type { AnnualReportModel } from './model.js';

/** The engine's figure this screen is built from. */
export const FIGURE = 'annual-report';

/**
 * The Annual Report from the engine's `annual-report` figure, whole (2 charts, 12 tables), with the period line, the
 * two downloads and one takeaway per table section (#765). Null when the engine has no page.
 */
export function annualReportModel(_reply: FiguresPart, _t: TFunction): AnnualReportModel | null {
  throw new Error('not built: #765');
}
