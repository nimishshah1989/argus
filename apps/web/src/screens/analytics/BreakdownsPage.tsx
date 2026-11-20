import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAnalyticsFigures } from '../../api.js';
import { StateNotice } from '../../patterns/frame.js';
import type { ViewState } from '../../patterns/view-state.js';
import { useFiguresState } from './screen-state.js';
import { BreakdownLog } from './BreakdownLog.js';
import { ScreenMenu } from './screen-menu.js';
import { DrillTable } from './DrillTable.js';
import { SCREEN_LABELS, parseDrill, type AnalyticsGroup } from './groups.js';

const LOG = 'breakdown-log';
const MENU = [
  LOG,
  'a1-bd-pm',
  'a2-category-cell',
  'a3-mttr-mtbf',
  'a4-manpower',
  'a6-why-why',
  'a10-problems',
  'fix-finder',
  'shift-kpis',
] as const;

function ScreenNav() {
  const { t } = useTranslation();
  return (
    <ScreenMenu
      label={t('analytics.breakdowns.nav')}
      current={LOG}
      items={MENU.map((screen) => ({
        id: screen,
        to: `/analytics/breakdowns?screen=${screen}`,
        label: t(SCREEN_LABELS[screen] ?? 'analytics.screen.unknown'),
      }))}
    />
  );
}

/**
 * The Breakdowns group (packets 40e-1, 40e-2, 41e-1 and 41e-2): its own screen menu, opening on the Breakdown Log.
 * Every other screen of the menu (BD % and PM split, Category and Cell, MTTR and MTBF, Manpower, Why-Why, Problem
 * Analysis, Fix Finder, the shift-calendar KPIs) is v2 and lives in `screens/v2/live.tsx`. The drill a link names
 * renders above the log, in the face's one drill table.
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
  const drill = parseDrill(params.get('drill'));
  return (
    <BreakdownLog
      figure={figures.data.figures.find((figure) => figure.screen === LOG)}
      menu={<ScreenNav />}
      asOf={figures.data.asOf}
      drill={drill ? <DrillTable bare group={group} drill={drill} /> : null}
    />
  );
}
