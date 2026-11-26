import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { annualReport, canAnalytics, monthlyReport, type FigureValue } from '@uptimo/domain';
import { apiError, calendarDay } from '@uptimo/shared';
import { withTenant } from '@uptimo/db';
import { nameCodes, personNames, requireAuth, tenantInfo } from '../identity/index.js';
import { actorOf, forbidden, plantToday } from '../plant/index.js';
import { loadEngineData, readProfile } from '../analytics/index.js';
import { esc } from './html.js';
import { renderPdf } from './pdf.js';
import { renderOrBusy, sendBytes, type PdfDeps } from './pdf-send.js';
import { chartSvg, type ReportChart } from './report-chart.js';

/**
 * The monthly and annual reports as A4 PDFs (ticket 45, packet 45d). The template is a pure function of the
 * figure the engine produced: every cell is printed as the figure holds it, so nothing is re-rounded, re-sorted
 * or read from the clock. The two charts are inline SVG from the figure's own datasets.
 */

export interface ReportTable {
  title: string;
  header: readonly string[];
  rows: readonly (readonly string[])[];
  rowCount: number;
}

export interface ReportPage {
  page: string;
  title: string;
  kpis: readonly unknown[];
  tables: readonly ReportTable[];
  charts: readonly ReportChart[];
}

type Screen = 'monthly' | 'annual';

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
];

/** The report's own period: the month before `asOf`'s for the monthly report, the year to `asOf` for the annual. */
export function reportPeriod(screen: Screen, asOf: string): string {
  const year = Number(asOf.slice(0, 4));
  const month = Number(asOf.slice(5, 7));
  if (screen === 'annual') return `${year} to ${Number(asOf.slice(8, 10))} ${MONTHS[month - 1]}`;
  return month === 1 ? `December ${year - 1}` : `${MONTHS[month - 2]} ${year}`;
}

/** The report's printed title: what it is and the period it covers. */
export function reportTitle(screen: Screen, asOf: string): string {
  const year = asOf.slice(0, 4);
  return screen === 'annual'
    ? `Annual Maintenance Report — ${year}`
    : `Monthly Maintenance Report — ${reportPeriod(screen, asOf)}`;
}

/** The first page of a report figure, or null when the figure is empty or not computed. */
export function reportPageOf(value: FigureValue | null): ReportPage | null {
  if (value === null || typeof value !== 'object' || !('pages' in value)) return null;
  const pages = (value as unknown as { pages?: readonly ReportPage[] }).pages;
  return pages?.[0] ?? null;
}

const NUMERIC = /^-?[\d,]+(\.\d+)?%?$|^—$|^[▲▼] /;

const COMMENTARY = 'Management commentary and actions';

const CHART_TITLES: Readonly<Record<string, string>> = {
  'ch-rp-daily': 'Daily breakdowns and hours',
  'ch-rp-12m': 'Breakdowns and hours, last twelve months',
  'ch-ry-month': 'Breakdowns and hours by month',
  'ch-ry-pareto': 'Downtime hours and cumulative share',
};

function cellsHtml(cells: readonly string[], cell: 'td' | 'th'): string {
  return cells
    .map((value) => {
      const numeric = cell === 'td' && NUMERIC.test(value) ? ' class="num"' : '';
      return `<${cell}${numeric}>${esc(value)}</${cell}>`;
    })
    .join('');
}

function tableHtml(table: ReportTable): string {
  const caption = table.title === '' ? COMMENTARY : table.title;
  const rows = table.rows.map((row) => `<tr>${cellsHtml(row, 'td')}</tr>`).join('');
  return `<section class="table-block"><h2>${esc(caption)}</h2><table><thead><tr>${cellsHtml(
    table.header,
    'th',
  )}</tr></thead><tbody>${rows}</tbody></table></section>`;
}

function chartHtml(chart: ReportChart): string {
  const title = CHART_TITLES[chart.id] ?? chart.id;
  return `<section class="chart-block"><h2>${esc(title)}</h2>${chartSvg(chart)}</section>`;
}

function pageHtml(page: ReportPage): string {
  return [
    '<h2 class="page-title">' + esc(page.title) + '</h2>',
    ...page.tables.map(tableHtml),
    ...page.charts.map(chartHtml),
  ].join('');
}

/** The printed report: the tenant, the title, the period line, the figure's tables in order and its charts. */
export function renderReportHtml(input: {
  tenant: { name: string; language: string };
  screen: Screen;
  asOf: string;
  value: FigureValue | null;
}): string {
  const page = reportPageOf(input.value);
  const body =
    page === null ? '<p class="empty">No breakdowns in this period.</p>' : pageHtml(page);
  return `<!doctype html>
<html lang="${esc(input.tenant.language)}">
<head>
  <meta charset="utf-8" />
  <title>${esc(reportTitle(input.screen, input.asOf))}</title>
  <style>${STYLES}</style>
</head>
<body>
<header>
  <div class="company">${esc(input.tenant.name)}</div>
  <h1>${esc(reportTitle(input.screen, input.asOf))}</h1>
  <div class="period">${esc(reportPeriod(input.screen, input.asOf))}</div>
</header>
${body}
</body>
</html>`;
}

const STYLES = `
@page { size: A4; margin: 12mm; }
* { box-sizing: border-box; }
body { margin: 0; color: #16181d; font-family: 'Noto Sans Gujarati', 'Kohinoor Gujarati',
  'Gujarati Sangam MN', 'Gujarati MT', 'Helvetica Neue', Arial, sans-serif; font-size: 9.5pt; line-height: 1.4; }
header { border-bottom: 1px solid #d8dbe0; padding-bottom: 3mm; margin-bottom: 5mm; }
.company { font-size: 8pt; letter-spacing: 0.12em; text-transform: uppercase; color: #6b7280; }
h1 { font-size: 17pt; margin: 1mm 0; }
.period { font-size: 10pt; color: #4b5563; }
h2 { font-size: 8.5pt; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280; margin: 0 0 1.5mm;
  border-bottom: 1px solid #e5e7eb; padding-bottom: 1mm; }
.page-title { display: none; }
.table-block, .chart-block { margin-top: 5mm; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-size: 7pt; letter-spacing: 0.06em; text-transform: uppercase; color: #6b7280;
  border-bottom: 1px solid #e5e7eb; padding: 1mm 1.2mm 1mm 0; }
td { vertical-align: top; padding: 1mm 1.2mm 1mm 0; border-bottom: 1px solid #f1f2f4; }
td.num { text-align: right; white-space: nowrap; }
tr { break-inside: avoid; }
.empty { color: #8b909a; font-style: italic; }
svg.chart { width: 100%; height: auto; margin-top: 1mm; }
.chart .grid { stroke: #e5e7eb; stroke-width: 1; }
.chart .tick { font-size: 7px; fill: #6b7280; }
.chart .xlabel { font-size: 7px; fill: #4b5563; }
.chart .legend { font-size: 8px; fill: #374151; font-weight: 600; }
.chart .bar-a { fill: #2f4a6d; }
.chart .bar-b { fill: #9fb0c6; }
.chart .line { fill: none; stroke: #b45309; stroke-width: 1.8; }
`;

const DATE_PROBLEM = (): ReturnType<typeof apiError> =>
  apiError('validation', 'Use a date like 2026-11-14', 'asOf');

type Asked = { ok: true; asOf?: string } | { ok: false; problem: ReturnType<typeof apiError> };

/** `asOf` is optional; when given it must be a real plant date. */
function askedDate(query: unknown): Asked {
  const asOf = (query as { asOf?: unknown } | undefined)?.asOf;
  if (asOf === undefined) return { ok: true };
  if (typeof asOf === 'string' && calendarDay.safeParse(asOf).success) return { ok: true, asOf };
  return { ok: false, problem: DATE_PROBLEM() };
}

const FILE_NAMES: Readonly<Record<Screen, string>> = {
  monthly: 'Monthly_report',
  annual: 'Annual_report',
};

type Loaded = {
  asOf: string;
  tenant: { name: string; language: string; time_zone: string };
  value: FigureValue | null;
};

async function loadReport(
  deps: PdfDeps,
  tenantId: string,
  asked: string | undefined,
  screen: Screen,
): Promise<Loaded> {
  return withTenant(deps.pool, tenantId, async (tx) => {
    const asOf = asked ?? (await plantToday(tx, tenantId));
    const data = await loadEngineData(tx, tenantId);
    const profile = await readProfile(tx, tenantId);
    const tenant = await tenantInfo(tx, tenantId);
    const figure =
      screen === 'monthly' ? monthlyReport(data, profile, asOf) : annualReport(data, profile, asOf);
    return { asOf, tenant, value: nameCodes(figure.value, await personNames(tx, tenantId)) };
  });
}

/** `GET /api/v1/reports/monthly.pdf` and `annual.pdf`: the figure rendered and sent inline, never stored. */
async function sendReportPdf(
  deps: PdfDeps,
  screen: Screen,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const ctx = await requireAuth(deps.pool, request, reply);
  if (!ctx) return;
  if (!canAnalytics(actorOf(ctx))) return forbidden(reply);
  const asked = askedDate(request.query);
  if (!asked.ok) {
    reply.code(422).send(asked.problem);
    return;
  }
  const loaded = await loadReport(deps, ctx.tenantId, asked.asOf, screen);
  const html = renderReportHtml({
    tenant: { name: loaded.tenant.name, language: loaded.tenant.language },
    screen,
    asOf: loaded.asOf,
    value: loaded.value,
  });
  const bytes = await renderOrBusy(reply, () => renderPdf(html, deps.chromiumPath));
  if (bytes) sendBytes(reply, bytes, `${FILE_NAMES[screen]}_${loaded.asOf}.pdf`);
}

export function registerReportPdfs(app: FastifyInstance, deps: PdfDeps): void {
  app.get('/api/v1/reports/monthly.pdf', (request, reply) =>
    sendReportPdf(deps, 'monthly', request, reply),
  );
  app.get('/api/v1/reports/annual.pdf', (request, reply) =>
    sendReportPdf(deps, 'annual', request, reply),
  );
}
