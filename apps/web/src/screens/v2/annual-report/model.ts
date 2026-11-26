import type { Takeaways } from '../../../ui/v2/takeaway.js';
import type { PrintedPageModel } from '../printed-page/page-model.js';

/**
 * ADR 0035: one computed takeaway per table of the annual report. The two charts draw the `months` and `machines`
 * numbers, so they take none of their own; the blank commentary form has none.
 */
export const SECTIONS = [
  'months',
  'quarters',
  'machines',
  'cells',
  'causes',
  'categories',
  'age',
  'team',
  'pm',
  'long',
  'added',
] as const;

/** A download the report offers (v1 `ReportsPage.tsx`): where it goes and what the link says. */
export type ReportLink = { href: string; label: string };

/** The Annual Report (S24): the engine's printed page whole, its period line, its two downloads and its takeaways. */
export type AnnualReportModel = PrintedPageModel & {
  /** "2026 to 11 November": the year so far, to the plant date. */
  period: string;
  /** The PDF, then the whole data set as Excel. */
  links: ReportLink[];
  takeaways: Takeaways;
};
