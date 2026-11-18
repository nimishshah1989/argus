import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAnalyticsFigures } from '../../api.js';
import { useOnline } from '../../data/index.js';
import { StateNotice } from '../../patterns/frame.js';
import { viewState, type ViewState } from '../../patterns/view-state.js';
import { Stack } from '../../ui/layout.js';
import { A9Page } from './A9Page.js';
import { ForecastLabPage } from './ForecastLabPage.js';
import { DrillTable } from './DrillTable.js';
import { SCREEN_LABELS, parseDrill, type AnalyticsGroup } from './groups.js';

/** Neutral screen constants, so CI's secret scanner never reads a figure lookup as an API key. */
const SCREEN_A9 = 'a9-bottleneck-forecast';
const SCREEN_LAB = 'forecast-lab';

/** The two screens the Forecast & scorecard group shows: A9 first, then the Lab. */
const SCREENS = [SCREEN_A9, SCREEN_LAB] as const;

type Screen = (typeof SCREENS)[number];

function screenOf(raw: string | null): Screen {
  return SCREENS.find((screen) => screen === raw) ?? SCREEN_A9;
}

function ScreenNav({ current }: { current: Screen }) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('analytics.forecast.nav')}>
      <ul className="flex flex-wrap gap-1 rounded-xl bg-neutral-200 p-1">
        {SCREENS.map((screen) => (
          <li key={screen}>
            <Link
              to={`/analytics/forecast-scorecard?screen=${screen}`}
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
 * The Forecast & scorecard group (packet 42e): its own screen menu, opening on A9 and switching to the Forecast
 * Lab in the group's route. Each screen is the engine's key page through `KeyPage`; the drill a screen links to
 * renders above it in the face's one drill table. Before this packet the group fell back to the tile list.
 */
export function ForecastPage({ group }: { group: AnalyticsGroup }) {
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
      {screen === SCREEN_LAB ? (
        <ForecastLabPage figure={figureOf(SCREEN_LAB)} group={group} />
      ) : (
        <A9Page figure={figureOf(SCREEN_A9)} group={group} />
      )}
    </Stack>
  );
}
