import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAnalyticsFigures } from '../../api.js';
import { useOnline } from '../../data/index.js';
import { StateNotice } from '../../patterns/frame.js';
import { viewState, type ViewState } from '../../patterns/view-state.js';
import { Stack } from '../../ui/layout.js';
import { DrillTable } from './DrillTable.js';
import { EnergyPage } from './EnergyPage.js';
import { GroupPage } from './GroupPage.js';
import { KeyScreen } from './key-screen.js';
import { ScreenMenu } from './screen-menu.js';
import { SCREEN_LABELS, parseDrill, type AnalyticsGroup } from './groups.js';

const ENERGY = 'a5-energy';
const COMPARE = 'compare';

/** The Machines group's own pages (the machine page itself is a route per machine, reached from a row). */
function screensOf(group: AnalyticsGroup): string[] {
  return group.screens.filter((screen) => screen !== 'machine-page');
}

function screenOf(raw: string | null, group: AnalyticsGroup): string {
  const screens = screensOf(group);
  return raw !== null && screens.includes(raw) ? raw : (screens[0] ?? ENERGY);
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
 * live in `screens/v2/live.tsx`): Compare, Energy and the generic screen sections. The machine page has its own route below.
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
  const screen = screenOf(params.get('screen'), group);
  const figureOf = (key: string) => figures.data?.figures.find((figure) => figure.screen === key);
  const menu = <ScreenNav group={group} current={screen} />;
  const asOf = figures.data.asOf;
  if (screen === COMPARE) {
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
  return (
    <Stack gap={6}>
      {menu}
      <p className="text-footnote text-neutral-600">{t('analytics.asOf', { date: asOf })}</p>
      {screen === ENERGY ? (
        <EnergyPage figure={figureOf(ENERGY)} group={group} />
      ) : (
        <GroupPage group={group} only={screen} />
      )}
    </Stack>
  );
}
