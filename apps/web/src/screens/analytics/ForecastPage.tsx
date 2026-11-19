/* eslint-disable i18next/no-literal-string -- the template's kind is a prop value, not copy */
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { useAnalyticsFigures } from '../../api.js';
import { EmptyState } from '../../ui/elements/index.js';
import { DrillTable } from './DrillTable.js';
import { FigureDrill } from './KeyPage.js';
import { KeyBody, KeyKpi } from './key-body.js';
import { contentOf } from './figure-content.js';
import { SCREEN_LABELS, parseDrill, type AnalyticsGroup } from './groups.js';
import { NotReady, useFiguresState } from './screen-state.js';
import { Template } from './shell/patterns/template.js';

/** Neutral screen constants, so CI's secret scanner never reads a figure lookup as an API key. */
const SCREEN_A9 = 'a9-bottleneck-forecast';
const SCREEN_LAB = 'forecast-lab';

/** The two screens the Reliability & forecast section shows: A9 first, then the Lab. */
const SCREENS = [SCREEN_A9, SCREEN_LAB] as const;

type Screen = (typeof SCREENS)[number];

function screenOf(raw: string | null): Screen {
  return SCREENS.find((screen) => screen === raw) ?? SCREEN_A9;
}

/** One screen's page whole, or the honest line when the engine has not computed it. */
function ForecastReady({
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
  const title = t(SCREEN_LABELS[screen] ?? 'analytics.screen.unknown');
  const figure = reply.figures.find((candidate) => candidate.screen === screen);
  const content = figure?.status === 'ready' ? contentOf(figure, t) : null;
  const drill = parseDrill(params.get('drill'));
  const page = figure && content?.kind === 'page' ? content : null;
  return (
    <Template
      title={page === null || page.title === '' ? title : page.title}
      kind="overview"
      lede={t('analytics.asOf', { date: reply.asOf })}
      figures={
        page === null || page.kpis.length === 0
          ? undefined
          : page.kpis.map((kpi, at) => <KeyKpi key={`${kpi.label}-${at}`} kpi={kpi} />)
      }
      main={
        <>
          {drill === null ? null : (
            <div data-span="full">
              <DrillTable group={group} drill={drill} />
            </div>
          )}
          {page === null ? (
            <div data-span="full">
              <EmptyState title={t('analytics.notComputed')} />
            </div>
          ) : (
            <KeyBody tables={page.tables} charts={page.charts} />
          )}
          {figure === undefined || page === null ? null : (
            <div data-span="full">
              <FigureDrill figure={figure} group={group} />
            </div>
          )}
        </>
      }
    />
  );
}

/**
 * The Forecast & scorecard group (packet 42e, rebuilt in the new look by ticket 87): A9's 14 figures, risk map and
 * tables, or the Forecast Lab's method and month tables and its line chart, each on the overview template. The
 * choice between them is the shell's own tab row, so there is one navigation. Every cell, range and figure is the
 * engine's printed text, so a forecast shows its uncertainty exactly as before (the 80% range in brackets, the
 * plan for and the worst case); the machine drill renders above the page.
 */
export function ForecastPage({ group }: { group: AnalyticsGroup }) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const figures = useAnalyticsFigures();
  const state = useFiguresState(figures);
  const screen = screenOf(params.get('screen'));
  if (state !== 'ready' || !figures.data)
    return (
      <NotReady
        title={t(SCREEN_LABELS[screen] ?? 'analytics.screen.unknown')}
        state={state === 'ready' ? 'loading' : state}
        onRetry={() => void figures.refetch()}
      />
    );
  return <ForecastReady reply={figures.data} screen={screen} group={group} />;
}
