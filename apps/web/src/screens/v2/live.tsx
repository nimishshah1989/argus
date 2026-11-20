/* eslint-disable i18next/no-literal-string -- screen ids and routes only; every visible word goes through t() */
import type { MessageKey } from '@uptimo/shared/i18n';
import { useRef, type ReactElement, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { correctMove, getMe } from '../../api.js';
import { ApiError, isOffline } from '../../data/index.js';
import { Segmented } from '../../ui/v2/segmented.js';
import { ScreenStates } from '../../ui/v2/screen-states.js';
import { correctionError } from '../analytics/machine-values.js';
import { SCREEN_LABELS, groupFor, type GroupId } from '../analytics/groups.js';
import { AgeView } from './age/View.js';
import { CellLogView } from './cell-change-log/View.js';
import { BottleneckView } from './bottleneck/View.js';
import { EnergyView } from './energy/View.js';
import { FixFinderView } from './fix-finder/View.js';
import { ForecastLabView } from './forecast-lab/View.js';
import { FootprintView } from './footprint/View.js';
import { RegistersView } from './machines-register/View.js';
import { ProblemAnalysisView } from './problem-analysis/View.js';
import { ShiftKpisView } from './shift-kpis/View.js';
import type { CellLogModel } from './cell-change-log/model.js';
import { useScreenModel, type ScreenModel, type ScreenParams } from './data.js';
import { ChromeContext, EntityShell } from './entity/EntityShell.js';
import { useLegacyDrill } from './legacy-drill.js';
import { useNav } from './nav.js';
import { useRefreshOnFigures } from './refresh.js';
import type { NavItem } from '../../ui/v2/shell.js';
import type { SectionId } from '../analytics/shell/shell-data.js';

/**
 * The v2 screens that are live: each renders at the URL its v1 page had, inside the v2 shell, with the data and the role
 * rules v1 used. `AnalyticsFace` asks here first and falls back to v1's page for any screen not listed.
 */
type Live = { group: GroupId; section: SectionId; screen: string; page: () => ReactElement };

const NAV_LABEL: Partial<Record<GroupId, MessageKey>> = {
  machines: 'analytics.machines.nav',
  breakdowns: 'analytics.breakdowns.nav',
};

/** The Reliability and forecast section names its screens as the shell's own tab row did: "Screens in {section}". */
const FORECAST: GroupId = 'forecast-scorecard';

/** The other screens of the group, as one row above the page, so the section stays reachable from a v2 screen. */
function ScreenTabs({ group, current }: { group: GroupId; current: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const screens = (groupFor(group)?.screens ?? []).filter((screen) => screen !== 'machine-page');
  const named = NAV_LABEL[group];
  const label =
    group === FORECAST
      ? t('ashell.tabs', { section: t('ashell.section.reliability') })
      : t(named ?? 'analytics.menu');
  return (
    <Segmented
      label={label}
      options={screens.map((screen) => ({
        key: screen,
        label: t(SCREEN_LABELS[screen] ?? 'analytics.screen.unknown'),
      }))}
      value={current}
      onChange={(screen) => navigate(`/analytics/${group}?screen=${screen}`)}
    />
  );
}

/** A screen's frame: the rail by the login's role, the section's screens above, and the figures' states in place of the page. */
function LiveFrame({
  entry,
  children,
}: {
  entry: Pick<Live, 'group' | 'section' | 'screen'>;
  children: (nav: ReturnType<typeof useNav>) => ReactNode;
}) {
  const role = useQuery({ queryKey: ['me'], queryFn: getMe }).data?.user.role;
  const nav = useNav(entry.section, role);
  useLegacyDrill(entry.screen);
  return (
    <ChromeContext.Provider value={<ScreenTabs group={entry.group} current={entry.screen} />}>
      {children(nav)}
    </ChromeContext.Provider>
  );
}

/** One head's or admin's correction of a move's date: the server's words on a refusal; never offline. */
function useCorrect(afterwards: () => void) {
  const { t } = useTranslation();
  const client = useQueryClient();
  return async (move: { id: string; machineId: string }, day: string): Promise<void> => {
    if (isOffline()) throw new Error(t('kit.form.needsConnection'));
    try {
      await correctMove(move.machineId, move.id, day);
    } catch (caught) {
      const named = caught instanceof ApiError ? correctionError(caught).date : undefined;
      throw new Error(named ?? t('analytics.cellLog.refused'), { cause: caught });
    }
    await client.invalidateQueries({ queryKey: ['analytics-figures'] });
    afterwards();
  };
}

function CellChangeLogPage() {
  const { t } = useTranslation();
  const loaded = useScreenModel('cell-change-log', {});
  const correct = useCorrect(() => loaded.retry());
  const last = useRef<CellLogModel>(undefined);
  if (loaded.state === 'ready' && loaded.model) last.current = loaded.model;
  const model = loaded.model ?? (loaded.state === 'loading' ? last.current : undefined);
  const title = t('v2m.title.log');
  return (
    <LiveFrame entry={{ group: 'machines', section: 'machines', screen: 'cell-change-log' }}>
      {(nav) =>
        model ? (
          <CellLogView model={model} nav={nav} title={title} onCorrect={correct} />
        ) : (
          <EntityShell nav={nav} title={title}>
            <ScreenStates loaded={loaded}>{() => null}</ScreenStates>
          </EntityShell>
        )
      }
    </LiveFrame>
  );
}

/** A screen that only draws its model: the model through the shared seam, the states in the shell until it is ready. */
function ModelPage<
  K extends
    | 'machines-register'
    | 'age'
    | 'footprint'
    | 'fix-finder'
    | 'problem-analysis'
    | 'energy'
    | 'bottleneck'
    | 'forecast-lab'
    | 'shift-kpis',
>({
  entry,
  screen,
  title,
  empty,
  draw,
}: {
  entry: Pick<Live, 'group' | 'section' | 'screen'>;
  screen: K;
  title: MessageKey;
  /** What the screen says when the model is null: a figure the engine has not computed says so, not "nothing to show". */
  empty?: MessageKey;
  draw: (model: ScreenModel<K>, shell: { nav: NavItem[]; title: string }) => ReactElement;
}) {
  const { t } = useTranslation();
  const loaded = useScreenModel(screen, {} as ScreenParams<K>);
  useRefreshOnFigures(loaded.retry);
  /** While a refresh loads, the screen stays as it was: the figures refresh every 30 seconds, as they did in v1. */
  const last = useRef<ScreenModel<K>>(undefined);
  if (loaded.state === 'ready' && loaded.model) last.current = loaded.model;
  const model = loaded.model ?? (loaded.state === 'loading' ? last.current : undefined);
  const heading = t(title);
  return (
    <LiveFrame entry={entry}>
      {(nav) =>
        model ? (
          draw(model, { nav, title: heading })
        ) : (
          <EntityShell nav={nav} title={heading}>
            <ScreenStates loaded={loaded} emptyText={empty ? t(empty) : undefined}>
              {() => null}
            </ScreenStates>
          </EntityShell>
        )
      }
    </LiveFrame>
  );
}

const screenOf = (group: GroupId, section: SectionId, screen: string) => ({
  group,
  section,
  screen,
});

const LIVE: readonly Live[] = [
  {
    group: 'machines',
    section: 'machines',
    screen: 'cell-change-log',
    page: () => <CellChangeLogPage />,
  },
  {
    group: 'machines',
    section: 'machines',
    screen: 'registers',
    page: () => (
      <ModelPage
        entry={screenOf('machines', 'machines', 'registers')}
        screen="machines-register"
        title="v2m.title.register"
        draw={(model, shell) => <RegistersView model={model} {...shell} />}
      />
    ),
  },
  {
    group: 'machines',
    section: 'machines',
    screen: 'a8-age',
    page: () => (
      <ModelPage
        entry={screenOf('machines', 'machines', 'a8-age')}
        screen="age"
        title="v2m.title.age"
        draw={(model, shell) => <AgeView model={model} {...shell} />}
      />
    ),
  },
  {
    group: 'machines',
    section: 'machines',
    screen: 'a7-footprint',
    page: () => (
      <ModelPage
        entry={screenOf('machines', 'machines', 'a7-footprint')}
        screen="footprint"
        title="v2m.title.footprint"
        draw={(model, shell) => <FootprintView model={model} {...shell} />}
      />
    ),
  },
  {
    group: 'breakdowns',
    section: 'problems',
    screen: 'fix-finder',
    page: () => (
      <ModelPage
        entry={screenOf('breakdowns', 'problems', 'fix-finder')}
        screen="fix-finder"
        title="analytics.screen.fix-finder"
        draw={(model, shell) => <FixFinderView model={model} {...shell} />}
      />
    ),
  },
  {
    group: 'breakdowns',
    section: 'problems',
    screen: 'a10-problems',
    page: () => (
      <ModelPage
        entry={screenOf('breakdowns', 'problems', 'a10-problems')}
        screen="problem-analysis"
        title="v2p.pa.title"
        draw={(model, shell) => <ProblemAnalysisView model={model} {...shell} />}
      />
    ),
  },
  {
    group: 'machines',
    section: 'machines',
    screen: 'a5-energy',
    page: () => (
      <ModelPage
        entry={screenOf('machines', 'machines', 'a5-energy')}
        screen="energy"
        empty="analytics.notComputed"
        title="v2e.title"
        draw={(model, shell) => <EnergyView model={model} {...shell} />}
      />
    ),
  },
  {
    group: 'breakdowns',
    section: 'problems',
    screen: 'shift-kpis',
    page: () => (
      <ModelPage
        entry={screenOf('breakdowns', 'problems', 'shift-kpis')}
        screen="shift-kpis"
        empty="analytics.notComputed"
        title="analytics.screen.shift-kpis"
        draw={(model, shell) => <ShiftKpisView model={model} {...shell} />}
      />
    ),
  },
  {
    group: FORECAST,
    section: 'reliability',
    screen: 'a9-bottleneck-forecast',
    page: () => (
      <ModelPage
        entry={screenOf(FORECAST, 'reliability', 'a9-bottleneck-forecast')}
        screen="bottleneck"
        empty="analytics.notComputed"
        title="v2b.title"
        draw={(model, shell) => <BottleneckView model={model} {...shell} />}
      />
    ),
  },
  {
    group: FORECAST,
    section: 'reliability',
    screen: 'forecast-lab',
    page: () => (
      <ModelPage
        entry={screenOf(FORECAST, 'reliability', 'forecast-lab')}
        screen="forecast-lab"
        empty="analytics.notComputed"
        title="analytics.screen.forecast-lab"
        draw={(model, shell) => <ForecastLabView model={model} {...shell} />}
      />
    ),
  },
];

/** The screen a group opens on when `?screen=` is missing or is not one of the group's own: always a v2 screen. */
const FIRST: Partial<Record<string, string>> = {
  machines: 'registers',
  [FORECAST]: 'a9-bottleneck-forecast',
};

/**
 * The live v2 page for a group's screen (`?screen=`, or the group's first), or null when that screen is still v1's. A
 * group whose first screen is v2 opens on it for an unknown `?screen=`, so an old bookmark never lands on a v1 page.
 */
export function liveScreen(group: string | undefined, screen: string | null): ReactElement | null {
  const own = groupFor(group)?.screens ?? [];
  const known = screen !== null && screen !== 'machine-page' && own.includes(screen);
  const named = known ? screen : (FIRST[group ?? ''] ?? null);
  return LIVE.find((entry) => entry.group === group && entry.screen === named)?.page() ?? null;
}
