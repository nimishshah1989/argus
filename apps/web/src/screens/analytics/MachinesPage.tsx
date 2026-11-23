import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAnalyticsFigures } from '../../api.js';
import { useOnline } from '../../data/index.js';
import { StateNotice } from '../../patterns/frame.js';
import { viewState, type ViewState } from '../../patterns/view-state.js';
import { DrillTable } from './DrillTable.js';
import { KeyScreen } from './key-screen.js';
import { ScreenMenu } from './screen-menu.js';
import { SCREEN_LABELS, parseDrill, type AnalyticsGroup } from './groups.js';

const COMPARE = 'compare';

/** The Machines group's own pages (the machine page itself is a route per machine, reached from a row). */
function screensOf(group: AnalyticsGroup): string[] {
  return group.screens.filter((screen) => screen !== 'machine-page');
}

function ScreenNav({ group, current }: { group: AnalyticsGroup; current: string }) {
  const { t } = useTranslation();
  return (
    <ScreenMenu
      label={t('analytics.machines.nav')}
      current={current}
      items={screensOf(group).map((screen) => ({
        id: screen,
        to: `/analytics/machines?screen=${screen}`,
        label: t(SCREEN_LABELS[screen] ?? 'analytics.screen.unknown'),
      }))}
    />
  );
}

/**
 * The Machines group's screens that are still v1's (the registers, the cell change log, age and footprint are v2 and
 * live in `screens/v2/live.tsx`, which also sends an unknown `?screen=` to the first of them, as Energy is): Compare. The
 * machine page has its own route.
 */
export function MachinesPage({ group }: { group: AnalyticsGroup }) {
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
  const figureOf = (key: string) => figures.data?.figures.find((figure) => figure.screen === key);
  const menu = <ScreenNav group={group} current={COMPARE} />;
  const asOf = figures.data.asOf;
  const drill = parseDrill(params.get('drill'));
  const found = figureOf(COMPARE);
  return (
    <KeyScreen
      screen={COMPARE}
      figures={found ? [found] : []}
      group={group}
      menu={menu}
      asOf={asOf}
      drill={drill ? <DrillTable group={group} drill={drill} headingLevel={3} /> : null}
    />
  );
}
