/* eslint-disable i18next/no-literal-string -- the template's kind and state are prop values, not copy */
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { useAnalyticsFigures } from '../../api.js';
import { EmptyState } from '../../ui/elements/index.js';
import { DrillTable } from './DrillTable.js';
import { FigureDrill } from './KeyPage.js';
import { KeyBody } from './key-body.js';
import { SCREEN_LABELS, parseDrill, type AnalyticsGroup } from './groups.js';
import { reportView, type ReportKind } from './report-view.js';
import { NotReady, useFiguresState } from './screen-state.js';
import { Template } from './shell/patterns/template.js';

/**
 * The Reports group's page (packet 45e, rebuilt in the new look by ticket 87): the chosen report whole on the
 * overview template, its two charts then its tables in the key's order, with the period line under the title and
 * the two downloads in the header. The Monthly and Annual choice is the shell's own tab row, so there is one
 * navigation. No KPI tiles, no insight lists and no commentary inputs: none is in the key. The report tables are
 * not sortable (the platform excludes the reports; Guide section 26); the untitled commentary table keeps the
 * catalogue caption. A `null` figure is the empty report; a figure the face cannot draw keeps the not-computed line.
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

const LINK =
  'inline-flex min-h-target-min items-center text-footnote font-semibold text-accent-text';

function screenOf(raw: string | null): Screen {
  return SCREENS.find((screen) => screen === raw) ?? SCREEN_MONTHLY;
}

/** The report's two downloads: its PDF and the workbook the whole data set exports. */
function Downloads({ kind }: { kind: ReportKind }) {
  const { t } = useTranslation();
  return (
    <>
      <a href={PDF[kind]} className={LINK}>
        {t('analytics.report.downloadPdf')}
      </a>
      <a href={WORKBOOK} className={LINK}>
        {t('analytics.report.downloadWorkbook')}
      </a>
    </>
  );
}

/** The chosen report whole, or the honest line when there is nothing to print. */
function ReportReady({
  reply,
  screen,
  group,
}: {
  reply: FiguresReply;
  screen: Screen;
  group: AnalyticsGroup;
}) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const kind = KIND[screen];
  const title = t(SCREEN_LABELS[screen] ?? 'analytics.screen.unknown');
  const figure = reply.figures.find((candidate) => candidate.screen === screen);
  const view = reportView(figure, kind, reply.asOf, t);
  const drill = parseDrill(params.get('drill'));
  const ready = view.state === 'ready';
  return (
    <Template
      title={ready && view.content.title !== '' ? view.content.title : title}
      kind="overview"
      lede={view.period}
      actions={<Downloads kind={kind} />}
      main={
        <>
          {drill === null ? null : (
            <div data-span="full">
              <DrillTable group={group} drill={drill} headingLevel={3} />
            </div>
          )}
          {ready ? (
            <KeyBody tables={view.content.tables} charts={view.content.charts} />
          ) : (
            <div data-span="full">
              <EmptyState
                title={t(
                  view.state === 'empty' ? 'analytics.report.empty' : 'analytics.notComputed',
                )}
              />
            </div>
          )}
          {ready && figure !== undefined ? (
            <div data-span="full">
              <FigureDrill figure={figure} group={group} />
            </div>
          ) : null}
        </>
      }
    />
  );
}

export function ReportsPage({ group }: { group: AnalyticsGroup }) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const figures = useAnalyticsFigures();
  const state = useFiguresState(figures);
  const screen = screenOf(params.get('screen'));
  if (state !== 'ready' || !figures.data)
    return (
      <NotReady
        title={t(SCREEN_LABELS[screen] ?? 'analytics.screen.unknown')}
        state={state}
        onRetry={() => void figures.refetch()}
        empty={t('analytics.empty')}
      />
    );
  return <ReportReady reply={figures.data} screen={screen} group={group} />;
}
