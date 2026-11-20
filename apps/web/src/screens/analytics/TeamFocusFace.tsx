import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useActionCenterBoard, useAnalyticsFigures } from '../../api.js';
import { useOnline } from '../../data/index.js';
import { viewState } from '../../patterns/view-state.js';
import { InsightBanner } from '../../ui/elements/index.js';
import { Stack } from '../../ui/layout.js';
import { NotReady } from './screen-states.js';
import { DrillTable } from './DrillTable.js';
import { TeamFocusPage } from './TeamFocusPage.js';
import { bannerOf, dmy } from './action-center.js';
import { ACTION_CENTER_PATH, parseDrill, type AnalyticsGroup } from './groups.js';

const SCREEN_TEAM = 'team-focus';

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
 * Team Focus at `/analytics/today?screen=team-focus`: the one Today screen that is still v1's. The Dashboard has its
 * own v2 screen at `/analytics/today`, so any other `?screen=` goes there.
 */
export function TeamFocusFace({ group }: { group: AnalyticsGroup }) {
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
  if (params.get('screen') !== SCREEN_TEAM) return <Navigate to="/analytics/today" replace />;
  const title = t('analytics.screen.team-focus');
  if (state !== 'ready' || !figures.data)
    return (
      <Stack gap={4}>
        <ActionCenterBanner />
        <NotReady title={title} state={state} emptyText="" onRetry={() => void figures.refetch()} />
      </Stack>
    );
  const drill = parseDrill(params.get('drill'));
  return (
    <Stack gap={4}>
      <ActionCenterBanner />
      <TeamFocusPage
        figure={figures.data.figures.find((figure) => figure.key === SCREEN_TEAM)}
        group={group}
        title={title}
        lede={t('analytics.asOf', { date: dmy(figures.data.asOf) })}
        drill={drill === null ? null : <DrillTable group={group} drill={drill} />}
      />
    </Stack>
  );
}
