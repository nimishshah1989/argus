import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAnalyticsFigures } from '../../api.js';
import { useOnline } from '../../data/index.js';
import { StateNotice } from '../../patterns/frame.js';
import { viewState, type ViewState } from '../../patterns/view-state.js';
import { Stack } from '../../ui/layout.js';
import { BreakdownLog } from './BreakdownLog.js';
import { KeyPage } from './KeyPage.js';
import { ManpowerPage } from './ManpowerPage.js';
import { DrillTable } from './DrillTable.js';
import { SCREEN_LABELS, parseDrill, type AnalyticsGroup } from './groups.js';

const LOG = 'breakdown-log';
const A1 = 'a1-bd-pm';
const A2 = 'a2-category-cell';
const A3 = 'a3-mttr-mtbf';
const A4 = 'a4-manpower';

/** The screens the group shows: the log, then A1, A2, A3 and A4's key-shaped pages. */
const SCREENS = [LOG, A1, A2, A3, A4] as const;

type Screen = (typeof SCREENS)[number];

function screenOf(raw: string | null): Screen {
  return SCREENS.find((screen) => screen === raw) ?? LOG;
}

function ScreenNav({ current }: { current: Screen }) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('analytics.breakdowns.nav')}>
      <ul className="flex flex-wrap gap-1 rounded-xl bg-neutral-200 p-1">
        {SCREENS.map((screen) => (
          <li key={screen}>
            <Link
              to={`/analytics/breakdowns?screen=${screen}`}
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

/**
 * The Breakdowns group (packets 40e-1, 40e-2 and 41e-1): its own screen menu, opening on the Breakdown Log and
 * switching to A1, A2, A3 or A4 in the group's route. The drill a screen links to renders above it, in the face's
 * one drill table.
 */
export function BreakdownsPage({ group }: { group: AnalyticsGroup }) {
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
  const figureOf = (key: string) => figures.data?.figures.find((figure) => figure.screen === key);
  const drill = parseDrill(params.get('drill'));
  return (
    <Stack gap={6}>
      <ScreenNav current={screen} />
      <p className="text-footnote text-neutral-600">
        {t('analytics.asOf', { date: figures.data.asOf })}
      </p>
      {drill ? <DrillTable group={group} drill={drill} /> : null}
      {screen === LOG ? (
        <BreakdownLog figure={figureOf(LOG)} />
      ) : screen === A4 ? (
        <ManpowerPage figure={figureOf(A4)} group={group} />
      ) : (
        <KeyPage figure={figureOf(screen)} group={group} />
      )}
    </Stack>
  );
}
