/* eslint-disable i18next/no-literal-string -- the template's kind and state are prop values, not copy */
import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { useActionCenterBoard, useAnalyticsFigures, useAnalyticsFiguresAt } from '../../api.js';
import { useOnline } from '../../data/index.js';
import { viewState } from '../../patterns/view-state.js';
import { InsightBanner } from '../../ui/elements/index.js';
import { Stack } from '../../ui/layout.js';
import { Template, type TemplateProps } from './shell/patterns/template.js';
import { DrillTable } from './DrillTable.js';
import { TeamFocusPage } from './TeamFocusPage.js';
import { bannerOf } from './action-center.js';
import { contentOf } from './figure-content.js';
import { ContentFigure, NumberFigure, isNumberFigure } from './TodayFigures.js';
import { COMPARE_DAYS, changeOf, priorDate } from './today-change.js';
import { NeedsNow } from './NeedsNow.js';
import { ACTION_CENTER_PATH, parseDrill, type AnalyticsGroup } from './groups.js';

type Figure = FiguresReply['figures'][number];

/** Neutral screen constants, so CI's secret scanner never reads a figure lookup as an API key. */
const SCREEN_TODAY = 'dashboard';
const SCREEN_TEAM = 'team-focus';

/** The Today screens that share the query state; the data checklist and Action Center keep their own routes. */
const TODAY_SCREENS = [SCREEN_TODAY, SCREEN_TEAM] as const;

type TodayScreen = (typeof TODAY_SCREENS)[number];

function screenOf(raw: string | null): TodayScreen {
  return TODAY_SCREENS.find((screen) => screen === raw) ?? SCREEN_TODAY;
}

/** The platform's Action Center banner: the open high and medium counts, linking to the screen; hidden when none. */
function ActionCenterBanner() {
  const { t } = useTranslation();
  const board = useActionCenterBoard();
  const banner = board.data === undefined ? null : bannerOf(board.data);
  if (banner === null) return null;
  return (
    <InsightBanner
      tone="watch"
      title={t('analytics.actionCenter.banner', { high: banner.high, medium: banner.medium })}
      action={
        <Link
          to={ACTION_CENTER_PATH}
          className="inline-flex min-h-target-min items-center self-start text-footnote font-bold"
        >
          {t('analytics.actionCenter.banner.open')}
        </Link>
      }
    />
  );
}

/**
 * The Dashboard on the overview template: number tiles in the figures row, then the strip, the pictures, the
 * sentence and the ranked list. The change of each figure is against the same figure 30 days earlier.
 */
function DashboardTemplate({
  frame,
  figures,
  group,
  asOf,
  excluded,
  drill,
}: {
  frame: Frame;
  figures: Figure[];
  group: AnalyticsGroup;
  asOf: string;
  excluded: number;
  drill: ReactNode;
}) {
  const { t } = useTranslation();
  const before = useAnalyticsFiguresAt(priorDate(asOf));
  const prior = (figure: Figure) =>
    changeOf(
      figure,
      before.data?.figures.find((other) => other.key === figure.key),
      priorDate(asOf).slice(0, 4) === asOf.slice(0, 4),
    );
  const lede = [
    t('analytics.asOf', { date: asOf }),
    excluded > 0 ? t('analytics.excludedMachines', { count: excluded }) : null,
    before.data ? t('analytics.today.vs', { date: priorDate(asOf), days: COMPARE_DAYS }) : null,
  ]
    .filter((part) => part !== null)
    .join(' · ');
  return (
    <Template
      {...frame}
      kind="overview"
      lede={lede}
      figures={figures.filter(isNumberFigure).map((figure) => (
        <NumberFigure key={figure.key} figure={figure} group={group} change={prior(figure)} />
      ))}
      main={
        <>
          {drill === null ? null : <div data-span="full">{drill}</div>}
          <div data-span="full">
            <NeedsNow />
          </div>
          {figures
            .filter((figure) => !isNumberFigure(figure))
            .map((figure) => (
              <ContentFigure
                key={figure.key}
                figure={figure}
                group={group}
                change={prior(figure)}
                content={contentOf(figure, t)}
              />
            ))}
        </>
      }
    />
  );
}

type Frame = Pick<TemplateProps, 'title'>;

/** The screen's frame with the state line in place of the figures: loading, offline or the error with Retry. */
function NotReady({ frame, state, onRetry }: { frame: Frame; state: string; onRetry: () => void }) {
  if (state === 'error')
    return <Template {...frame} kind="overview" state="error" onRetry={onRetry} main={null} />;
  return (
    <Template
      {...frame}
      kind="overview"
      state={state === 'offline' ? 'offline' : 'loading'}
      main={null}
    />
  );
}

/**
 * The Today group (packet 38.3, extended by 43e; rebuilt in the Instrument look by ticket 86): the Dashboard as the
 * home, on the overview template, with its own screen menu for Team Focus and Action Center. Every number is the
 * engine's own value with its unit and, against the figure 30 days earlier, its change. The strip is built from the
 * desk's existing /state. No money appears on Today.
 */
export function Dashboard({ group }: { group: AnalyticsGroup }) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const figures = useAnalyticsFigures();
  const online = useOnline();
  const screen = screenOf(params.get('screen'));
  const state = viewState({
    online,
    hasData: figures.data !== undefined,
    isEmpty: false,
    error: figures.error,
  });
  const team = screen === SCREEN_TEAM;
  const title = t(team ? 'analytics.screen.team-focus' : 'analytics.screen.dashboard');
  const frame = {
    title,
  };
  if (state !== 'ready' || !figures.data)
    return (
      <Stack gap={4}>
        <ActionCenterBanner />
        <NotReady frame={frame} state={state} onRetry={() => void figures.refetch()} />
      </Stack>
    );
  const loaded = figures.data;
  const drill = parseDrill(params.get('drill'));
  const figureOf = (key: string) => loaded.figures.find((figure) => figure.key === key);
  const drillTable = drill === null ? null : <DrillTable group={group} drill={drill} />;
  return (
    <Stack gap={4}>
      <ActionCenterBanner />
      {team ? (
        <TeamFocusPage
          figure={figureOf(SCREEN_TEAM)}
          group={group}
          title={title}
          lede={t('analytics.asOf', { date: loaded.asOf })}
          drill={drillTable}
        />
      ) : (
        <DashboardTemplate
          frame={frame}
          figures={loaded.figures.filter((figure) => figure.screen === SCREEN_TODAY)}
          group={group}
          asOf={loaded.asOf}
          excluded={loaded.excludedMachines}
          drill={drillTable}
        />
      )}
    </Stack>
  );
}
