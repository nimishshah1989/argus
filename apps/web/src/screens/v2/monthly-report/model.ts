import type { Takeaways } from '../../../ui/v2/takeaway.js';
import type { PrintedPageModel } from '../printed-page/page-model.js';

/** ADR 0035: one computed takeaway per section of the monthly report; the blank commentary form has none. */
export const SECTIONS = [
  'daily',
  'months',
  'machine',
  'cell',
  'category',
  'code',
  'longest',
  'team',
  'added',
] as const;

/** A download the report offers (v1 `ReportsPage.tsx`): where it goes and what the link says. */
export type ReportLink = { href: string; label: string };

/** The Monthly Report (S23): the engine's printed page whole, its period line, its two downloads and its takeaways. */
export type MonthlyReportModel = PrintedPageModel & {
  /** "October 2026": the calendar month before the plant date (v1 `reportPeriodLine('monthly', …)`). */
  period: string;
  /** The PDF, then the whole data set as Excel. */
  links: ReportLink[];
  takeaways: Takeaways;
};
