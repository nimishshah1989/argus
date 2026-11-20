import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { useAnalyticsFigures } from '../../api.js';
import { StateNotice } from '../../patterns/frame.js';
import type { ViewState } from '../../patterns/view-state.js';
import { useFiguresState } from './screen-state.js';
import { Stack } from '../../ui/layout.js';
import { BreakdownLog } from './BreakdownLog.js';
import { ScreenMenu } from './screen-menu.js';
import { KeyScreen } from './key-screen.js';
import { manpowerTable } from './ManpowerPage.js';
import { WhyWhyPage } from './WhyWhyPage.js';
import { DrillTable } from './DrillTable.js';
import { SCREEN_LABELS, parseDrill, type AnalyticsGroup } from './groups.js';

const LOG = 'breakdown-log';
const A1 = 'a1-bd-pm';
const A2 = 'a2-category-cell';
const A3 = 'a3-mttr-mtbf';
const A4 = 'a4-manpower';
const A6 = 'a6-why-why';
const A10 = 'a10-problems';
const FIX = 'fix-finder';

/** The screens the group shows: the log, then A1, A2, A3, A4, A6, A10 and Fix Finder's key-shaped pages (the shift-calendar KPIs are v2). */
const SCREENS = [LOG, A1, A2, A3, A4, A6, A10, FIX] as const;

type Screen = (typeof SCREENS)[number];

function screenOf(raw: string | null): Screen {
  return SCREENS.find((screen) => screen === raw) ?? LOG;
}

/** Every screen here is the one figure the engine sent for it. */
function screenFigures(all: FiguresReply['figures'], screen: Screen): FiguresReply['figures'] {
  return all.filter((figure) => figure.screen === screen).slice(0, 1);
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
 * Log and switching to A1, A2, A3, A4, A6, A10, Fix Finder or the shift-calendar KPIs in the group's route. The
 * drill a screen links to renders above its page, in the face's one drill table. A6 is still on the old frame.
 */
export function BreakdownsPage({ group }: { group: AnalyticsGroup }) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const figures = useAnalyticsFigures();
  const state = useFiguresState(figures);
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
  const drillTable = drill ? (
    <DrillTable
      bare={screen === LOG}
      group={group}
      drill={drill}
      headingLevel={screen === LOG || screen === A6 ? undefined : 3}
    />
  ) : null;
  if (screen === LOG)
    return (
      <BreakdownLog
        figure={figureOf(LOG)}
        menu={<ScreenNav current={screen} />}
        asOf={figures.data.asOf}
        drill={drillTable}
      />
    );
  if (screen !== A6)
    return (
      <KeyScreen
        screen={screen}
        figures={screenFigures(figures.data.figures, screen)}
        group={group}
        menu={<ScreenNav current={screen} />}
        asOf={figures.data.asOf}
        drill={drillTable}
        renderTable={screen === A4 ? manpowerTable : undefined}
      />
    );
  return (
    <Stack gap={6}>
      <ScreenNav current={screen} />
      <p className="text-footnote text-neutral-600">
        {t('analytics.asOf', { date: figures.data.asOf })}
      </p>
      {drillTable}
      <WhyWhyPage figure={figureOf(A6)} group={group} />
    </Stack>
  );
}
