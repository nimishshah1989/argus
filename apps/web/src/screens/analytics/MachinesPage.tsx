import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAnalyticsFigures } from '../../api.js';
import { useOnline } from '../../data/index.js';
import { StateNotice } from '../../patterns/frame.js';
import { viewState, type ViewState } from '../../patterns/view-state.js';
import { Stack } from '../../ui/layout.js';
import { CellChangeLog } from './CellChangeLog.js';
import { EnergyPage } from './EnergyPage.js';
import { GroupPage } from './GroupPage.js';
import { Registers } from './Registers.js';
import { SCREEN_LABELS, type AnalyticsGroup } from './groups.js';

const REGISTERS = 'registers';
const CELL_LOG = 'cell-change-log';
const ENERGY = 'a5-energy';

/** The Machines group's own pages (the machine page itself is a route per machine, reached from a row). */
function screensOf(group: AnalyticsGroup): string[] {
  return group.screens.filter((screen) => screen !== 'machine-page');
}

function screenOf(raw: string | null, group: AnalyticsGroup): string {
  const screens = screensOf(group);
  return raw !== null && screens.includes(raw) ? raw : REGISTERS;
}

function ScreenNav({ group, current }: { group: AnalyticsGroup; current: string }) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('analytics.machines.nav')}>
      <ul className="flex flex-wrap gap-1 rounded-xl bg-neutral-200 p-1">
        {screensOf(group).map((screen) => (
          <li key={screen}>
            <Link
              to={`/analytics/machines?screen=${screen}`}
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
 * The Machines group (39b): Registers opens its own page per register, Cell change log its own table and export,
 * and the rest of the group keeps the generic screen sections. The machine page has its own route below.
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
  return (
    <Stack gap={6}>
      <ScreenNav group={group} current={screen} />
      <p className="text-footnote text-neutral-600">
        {t('analytics.asOf', { date: figures.data.asOf })}
      </p>
      {screen === REGISTERS ? (
        <Registers group={group} figure={figureOf(REGISTERS)} />
      ) : screen === CELL_LOG ? (
        <CellChangeLog figure={figureOf(CELL_LOG)} />
      ) : screen === ENERGY ? (
        <EnergyPage figure={figureOf(ENERGY)} group={group} />
      ) : (
        <GroupPage group={group} only={screen} />
      )}
    </Stack>
  );
}
