import type { TFunction } from 'i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import type { MessageKey } from '@uptimo/shared/i18n';
import { pageContent, type PageContent } from './page-content.js';

/**
 * The two reports' screen mapping (packet 45e): the engine's figure page as the face prints it, with its tables in
 * the key's order and its two charts, the period line above them and the honest state when there is nothing to
 * draw. Pure: the same figure, kind, run date and catalogue always give the same view, and nothing here invents a
 * number or a row. The four chart specs come through the one page mapper, whose chrome lives in `page-content.ts`.
 */

type Figure = FiguresReply['figures'][number];
type ObjectValue = Record<string, unknown>;

export type ReportKind = 'monthly' | 'annual';

/** A ready report, a report with nothing to print (`value: null`), or one the engine has not computed yet. */
export type ReportView =
  | { state: 'ready'; period: string; content: PageContent }
  | { state: 'empty'; period: string }
  | { state: 'notComputed'; period: string };

const COMMENTARY = 'analytics.report.commentary' satisfies MessageKey;
const PERIOD_MONTHLY = 'analytics.report.periodMonthly' satisfies MessageKey;
const PERIOD_ANNUAL = 'analytics.report.periodAnnual' satisfies MessageKey;

/** The engine's month names, the labels its report titles and period line already print. */
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const PLANT_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isObject(value: unknown): value is ObjectValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The figure's own `asOf` when it carries one (the period it was computed for), else the reply's. */
function asOfOf(value: unknown, fallback: string): string {
  if (!isObject(value) || typeof value.asOf !== 'string' || !PLANT_DATE.test(value.asOf))
    return fallback;
  return value.asOf;
}

/** The month before the run month, by the same calendar arithmetic `monthlyPeriod` uses in the engine. */
function previousMonth(asOf: string): { year: number; month: number } {
  const [year = 0, month = 1] = asOf.split('-').map(Number);
  const index = year * 12 + month - 2;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/**
 * The period line above the report, from the same rule the figure used to pick its window: the complete month
 * before the run month ("October 2026") or the year to the run date ("2026 to 11 November").
 */
export function reportPeriodLine(kind: ReportKind, asOf: string, t: TFunction): string {
  const [year = 0, month = 1, day = 1] = asOf.split('-').map(Number);
  if (kind === 'annual')
    return t(PERIOD_ANNUAL, { year, date: `${day} ${MONTHS[month - 1] ?? ''}` });
  const previous = previousMonth(asOf);
  return t(PERIOD_MONTHLY, { month: MONTHS[previous.month - 1] ?? '', year: previous.year });
}

/** The page whole, with its one untitled table captioned; the figure's own title stays `""`. */
function withCaption(content: PageContent, t: TFunction): PageContent {
  return {
    ...content,
    tables: content.tables.map((table) =>
      table.title === '' ? { ...table, title: t(COMMENTARY) } : table,
    ),
  };
}

/** The chosen report as the face prints it; a figure the face cannot draw keeps the honest not-computed line. */
export function reportView(
  figure: Figure | undefined,
  kind: ReportKind,
  asOf: string,
  t: TFunction,
): ReportView {
  const value = figure?.status === 'ready' ? figure.value : undefined;
  const period = reportPeriodLine(kind, asOfOf(value, asOf), t);
  if (figure === undefined || figure.status !== 'ready') return { state: 'notComputed', period };
  if (figure.value === null) return { state: 'empty', period };
  const content = isObject(figure.value) ? pageContent(figure.value, t) : null;
  return content === null
    ? { state: 'notComputed', period }
    : { state: 'ready', period, content: withCaption(content, t) };
}
