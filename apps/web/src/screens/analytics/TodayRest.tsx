/* eslint-disable i18next/no-literal-string -- the template's kind and state are prop values, not copy */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useActionCenterBoard, useAnalyticsFigures } from '../../api.js';
import { useOnline } from '../../data/index.js';
import { viewState } from '../../patterns/view-state.js';
import { InsightBanner } from '../../ui/elements/index.js';
import { Stack } from '../../ui/layout.js';
import { Template } from './shell/patterns/template.js';
import { TeamFocusPage } from './TeamFocusPage.js';
import { bannerOf, dmy } from './action-center.js';
import { ACTION_CENTER_PATH, type AnalyticsGroup } from './groups.js';

/** The Today screen still on its v1 page: Team Focus. */
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
 * What is left of the v1 Today page once the Dashboard is v2 and live: Team Focus (`?screen=team-focus`), which goes
 * when that screen is rebuilt. An old `?drill=` link opens its rows in the Dashboard's drawer.
 */
export function TodayRest({ group }: { group: AnalyticsGroup }) {
  const { t } = useTranslation();
  const figures = useAnalyticsFigures();
  const online = useOnline();
  const state = viewState({
    online,
    hasData: figures.data !== undefined,
    isEmpty: false,
    error: figures.error,
  });
  const title = t('analytics.screen.team-focus');
  if (state !== 'ready' || !figures.data)
    return (
      <Stack gap={4}>
        <ActionCenterBanner />
        {state === 'error' ? (
          <Template
            title={title}
            kind="overview"
            state="error"
            onRetry={() => void figures.refetch()}
            main={null}
          />
        ) : (
          <Template
            title={title}
            kind="overview"
            state={state === 'offline' ? 'offline' : 'loading'}
            main={null}
          />
        )}
      </Stack>
    );
  return (
    <Stack gap={4}>
      <ActionCenterBanner />
      <TeamFocusPage
        figure={figures.data.figures.find((figure) => figure.key === SCREEN_TEAM)}
        group={group}
        title={title}
        lede={t('analytics.asOf', { date: dmy(figures.data.asOf) })}
        drill={null}
      />
    </Stack>
  );
}
