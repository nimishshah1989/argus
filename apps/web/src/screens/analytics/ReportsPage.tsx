import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAnalyticsFigures } from '../../api.js';
import { useOnline } from '../../data/index.js';
import { StateNotice } from '../../patterns/frame.js';
import { viewState, type ViewState } from '../../patterns/view-state.js';
import { Stack } from '../../ui/layout.js';
import { DrillTable } from './DrillTable.js';
import { FigureDrill } from './KeyPage.js';
import { PageFigure } from './PageFigure.js';
import { SCREEN_LABELS, parseDrill, type AnalyticsGroup } from './groups.js';
import { reportView, type ReportKind } from './report-view.js';

/**
 * The Reports group's own page (packet 45e): the Monthly | Annual switch, the chosen report whole through the page
 * renderer (its tables in the key's order and its two charts), with the period line and the two downloads above
 * them. No KPI tiles, no insight lists and no commentary inputs: none is in the key. The report tables are not
 * sortable (the platform excludes the reports; Guide §26); the untitled commentary table keeps the catalogue
 * caption. A `null` figure is the empty report; a figure the face cannot draw keeps the not-computed line.
 */

/** Neutral screen constants, so CI's secret scanner never reads a figure lookup as an API key. */
const SCREEN_MONTHLY = 'monthly-report';
const SCREEN_ANNUAL = 'annual-report';

const SCREENS = [SCREEN_MONTHLY, SCREEN_ANNUAL] as const;
type Screen = (typeof SCREENS)[number];

const KIND: Record<Screen, ReportKind> = {
  [SCREEN_MONTHLY]: 'monthly',
  [SCREEN_ANNUAL]: 'annual',
};

/** The two PDF routes 45d serves, one per report; the workbook is the one export of the whole data set. */
const PDF: Record<ReportKind, string> = {
  monthly: '/api/v1/reports/monthly.pdf',
  annual: '/api/v1/reports/annual.pdf',
};
const WORKBOOK = '/api/v1/reports/workbook.xlsx';

function screenOf(raw: string | null): Screen {
  return SCREENS.find((screen) => screen === raw) ?? SCREEN_MONTHLY;
}

function ScreenNav({ current }: { current: Screen }) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('analytics.report.nav')}>
      <ul className="flex flex-wrap gap-1 rounded-xl bg-neutral-200 p-1">
        {SCREENS.map((screen) => (
          <li key={screen}>
            <Link
              to={`/analytics/reports?screen=${screen}`}
              // eslint-disable-next-line i18next/no-literal-string -- ARIA value, not copy
              aria-current={screen === current ? 'page' : undefined}
              className="flex min-h-target-min items-center rounded-lg px-3 text-footnote font-semibold text-neutral-700 aria-[current=page]:bg-surface aria-[current=page]:text-neutral-900 aria-[current=page]:shadow-card"
            >
              {t(SCREEN_LABELS[screen] ?? 'analytics.screen.unknown')}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The report's two downloads: its PDF and the workbook the whole data set exports. */
function Downloads({ kind }: { kind: ReportKind }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-4">
      <a
        href={PDF[kind]}
        className="inline-flex min-h-target-min items-center text-footnote font-semibold text-accent-text"
      >
        {t('analytics.report.downloadPdf')}
      </a>
      <a
        href={WORKBOOK}
        className="inline-flex min-h-target-min items-center text-footnote font-semibold text-accent-text"
      >
        {t('analytics.report.downloadWorkbook')}
      </a>
    </div>
  );
}

/** The honest state when there is no page to print: nothing recorded, or not computed yet. */
function ReportNote({ state }: { state: 'empty' | 'notComputed' }) {
  const { t } = useTranslation();
  return (
    <div
      data-page={state === 'empty' ? 'empty-report' : 'not-computed'}
      className="rounded-2xl bg-surface p-4 shadow-card"
    >
      <p className="text-body font-medium text-neutral-600">
        {t(state === 'empty' ? 'analytics.report.empty' : 'analytics.notComputed')}
      </p>
    </div>
  );
}

export function ReportsPage({ group }: { group: AnalyticsGroup }) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const figures = useAnalyticsFigures();
  const online = useOnline();
  const state = viewState({
    online,
    hasData: figures.data !== undefined,
    isEmpty: false,
    error: figures.error,
  });
  if (state !== 'ready' || !figures.data)
    return (
      <StateNotice
        state={state as Exclude<ViewState, 'ready'>}
        empty={t('analytics.empty')}
        onRetry={() => void figures.refetch()}
      />
    );
  const screen = screenOf(params.get('screen'));
  const kind = KIND[screen];
  const figure = figures.data.figures.find((candidate) => candidate.screen === screen);
  const view = reportView(figure, kind, figures.data.asOf, t);
  const drill = parseDrill(params.get('drill'));
  return (
    <Stack gap={6}>
      <ScreenNav current={screen} />
      {drill === null ? null : <DrillTable group={group} drill={drill} />}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-body font-medium">{view.period}</p>
        <Downloads kind={kind} />
      </div>
      {view.state === 'ready' ? (
        <>
          <PageFigure content={view.content} />
          {figure === undefined ? null : <FigureDrill figure={figure} group={group} />}
        </>
      ) : (
        <ReportNote state={view.state} />
      )}
    </Stack>
  );
}
