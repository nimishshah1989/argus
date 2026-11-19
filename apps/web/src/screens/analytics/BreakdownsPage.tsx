import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAnalyticsFigures } from '../../api.js';
import { useOnline } from '../../data/index.js';
import { StateNotice } from '../../patterns/frame.js';
import { viewState, type ViewState } from '../../patterns/view-state.js';
import { Stack } from '../../ui/layout.js';
import { BreakdownLog } from './BreakdownLog.js';
import { ScreenMenu } from './screen-menu.js';
import { KeyPage } from './KeyPage.js';
import { ManpowerPage } from './ManpowerPage.js';
import { ShiftKpisPage } from './ShiftKpisPage.js';
import { ProblemsPage } from './ProblemsPage.js';
import { WhyWhyPage } from './WhyWhyPage.js';
import { DrillTable } from './DrillTable.js';
import { FixFinderPage } from './FixFinderPage.js';
import { SCREEN_LABELS, parseDrill, type AnalyticsGroup } from './groups.js';

const LOG = 'breakdown-log';
const A1 = 'a1-bd-pm';
const A2 = 'a2-category-cell';
const A3 = 'a3-mttr-mtbf';
const A4 = 'a4-manpower';
const A6 = 'a6-why-why';
const A10 = 'a10-problems';
const FIX = 'fix-finder';
const SHIFT = 'shift-kpis';

/**
 * The screens the group shows: the log, then A1, A2, A3, A4, A6, A10, Fix Finder's key-shaped pages and ticket 48's
 * shift-calendar family.
 */
const SCREENS = [LOG, A1, A2, A3, A4, A6, A10, FIX, SHIFT] as const;

type Screen = (typeof SCREENS)[number];

function screenOf(raw: string | null): Screen {
  return SCREENS.find((screen) => screen === raw) ?? LOG;
}

function ScreenNav({ current }: { current: Screen }) {
  const { t } = useTranslation();
  return (
    <ScreenMenu
      label={t('analytics.breakdowns.nav')}
      current={current}
      items={SCREENS.map((screen) => ({
        id: screen,
        to: `/analytics/breakdowns?screen=${screen}`,
        label: t(SCREEN_LABELS[screen] ?? 'analytics.screen.unknown'),
      }))}
    />
  );
}

/**
 * The Breakdowns group (packets 40e-1, 40e-2, 41e-1 and 41e-2): its own screen menu, opening on the Breakdown
 * Log and switching to A1, A2, A3, A4, A6 or A10 in the group's route. The drill a screen links to renders
 * above it, in the face's one drill table.
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
  const drillTable = drill ? <DrillTable group={group} drill={drill} /> : null;
  if (screen === LOG)
    return (
      <BreakdownLog
        figure={figureOf(LOG)}
        menu={<ScreenNav current={screen} />}
        asOf={figures.data.asOf}
        drill={drillTable}
      />
    );
  return (
    <Stack gap={6}>
      <ScreenNav current={screen} />
      <p className="text-footnote text-neutral-600">
        {t('analytics.asOf', { date: figures.data.asOf })}
      </p>
      {drillTable}
      {screen === A6 ? (
        <WhyWhyPage figure={figureOf(A6)} group={group} />
      ) : screen === A10 ? (
        <ProblemsPage figure={figureOf(A10)} group={group} />
      ) : screen === A4 ? (
        <ManpowerPage figure={figureOf(A4)} group={group} />
      ) : screen === FIX ? (
        <FixFinderPage figure={figureOf(FIX)} group={group} />
      ) : screen === SHIFT ? (
        <ShiftKpisPage
          figures={figures.data.figures.filter((figure) => figure.screen === SHIFT)}
          group={group}
        />
      ) : (
        <KeyPage figure={figureOf(screen)} group={group} />
      )}
    </Stack>
  );
}
