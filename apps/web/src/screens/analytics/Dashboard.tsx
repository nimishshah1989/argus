import { useId } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { useAnalyticsFigures } from '../../api.js';
import { useOnline } from '../../data/index.js';
import { StateNotice } from '../../patterns/frame.js';
import { viewState, type ViewState } from '../../patterns/view-state.js';
import { Stack } from '../../ui/layout.js';
import { DrillTable } from './DrillTable.js';
import { FigureTile } from './FigureTile.js';
import { GroupPage } from './GroupPage.js';
import { TeamFocusPage } from './TeamFocusPage.js';
import { contentKind } from './figure-content.js';
import { NeedsNow } from './NeedsNow.js';
import { CHECKLIST_PATH, SCREEN_LABELS, parseDrill, type AnalyticsGroup } from './groups.js';

type Figure = FiguresReply['figures'][number];

/** Neutral screen constants, so CI's secret scanner never reads a figure lookup as an API key. */
const SCREEN_TODAY = 'dashboard';
const SCREEN_ACTION = 'action-center';
const SCREEN_TEAM = 'team-focus';

/** The Today group's own screens; the data checklist keeps its separate route. */
const TODAY_SCREENS = [SCREEN_TODAY, SCREEN_ACTION, SCREEN_TEAM] as const;

type TodayScreen = (typeof TODAY_SCREENS)[number];

function screenOf(raw: string | null): TodayScreen {
  return TODAY_SCREENS.find((screen) => screen === raw) ?? SCREEN_TODAY;
}

/** The Today group's screen menu, so Team Focus and Action Center are reachable from the head's home. */
function TodayNav({ current }: { current: TodayScreen }) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('analytics.today.nav')}>
      <ul className="flex flex-wrap gap-1 rounded-xl bg-neutral-200 p-1">
        {TODAY_SCREENS.map((screen) => (
          <li key={screen}>
            <Link
              to={`/analytics/today?screen=${screen}`}
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

/** The Dashboard tiles: every figure the engine registered for the home screen, plus the checklist's link. */
function DashboardSection({ figures, group }: { figures: Figure[]; group: AnalyticsGroup }) {
  const { t } = useTranslation();
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={headingId} className="text-title3 font-semibold">
          {t('analytics.screen.dashboard')}
        </h2>
        <Link
          to={CHECKLIST_PATH}
          className="inline-flex min-h-target-min items-center text-footnote font-semibold text-accent-text"
        >
          {t('analytics.screen.data-checklist')}
        </Link>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {figures.map((figure) => {
          const kind = contentKind(figure);
          return (
            <li
              key={figure.key}
              className={
                kind !== null && kind !== 'text' ? 'sm:col-span-2 lg:col-span-3' : undefined
              }
            >
              <FigureTile figure={figure} group={group} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * The Today group (packet 38.3, extended by 43e): the Dashboard as the home, with its own screen menu for
 * Team Focus and Action Center. The strip above the tiles is built from the desk's existing /state. No money
 * appears on Today.
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
  if (state !== 'ready' || !figures.data)
    return (
      <StateNotice
        state={state as Exclude<ViewState, 'ready'>}
        empty={t('analytics.empty')}
        onRetry={() => void figures.refetch()}
      />
    );
  const loaded = figures.data;
  const drill = parseDrill(params.get('drill'));
  const figureOf = (key: string) => loaded.figures.find((figure) => figure.key === key);
  return (
    <Stack gap={6}>
      <TodayNav current={screen} />
      {screen === SCREEN_ACTION ? (
        <GroupPage group={group} only={SCREEN_ACTION} />
      ) : (
        <>
          <p className="text-footnote text-neutral-600">
            {t('analytics.asOf', { date: loaded.asOf })}
          </p>
          {screen === SCREEN_TEAM ? null : <NeedsNow />}
          {drill === null ? null : <DrillTable group={group} drill={drill} />}
          {screen === SCREEN_TEAM ? (
            <TeamFocusPage figure={figureOf(SCREEN_TEAM)} group={group} />
          ) : (
            <DashboardSection
              figures={loaded.figures.filter((figure) => figure.screen === SCREEN_TODAY)}
              group={group}
            />
          )}
        </>
      )}
    </Stack>
  );
}
