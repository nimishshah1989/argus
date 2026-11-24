/* eslint-disable i18next/no-literal-string -- screen ids and routes only; every visible word goes through t() */
import { Fragment, useEffect, useRef, useState, type ReactElement } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { correctMove } from '../../api.js';
import { ApiError, isOffline } from '../../data/index.js';
import { ScreenStates } from '../../ui/v2/screen-states.js';
import { correctionError } from '../analytics/machine-values.js';
import { groupFor, type GroupId } from '../analytics/groups.js';
import { AgeView } from './age/View.js';
import { BdPmView } from './bd-pm/View.js';
import { CategoryCellView } from './category-cell/View.js';
import { MttrMtbfView } from './mttr-mtbf/View.js';
import { CellLogView } from './cell-change-log/View.js';
import { ComparePage } from './compare/Page.js';
import { DataChecklistLive } from './data-checklist/Page.js';
import { DashboardPage } from './dashboard/Page.js';
import { BottleneckView } from './bottleneck/View.js';
import { BreakdownLogPage } from './breakdown-log/Page.js';
import { EnergyView } from './energy/View.js';
import { FixFinderView } from './fix-finder/View.js';
import { ForecastLabView } from './forecast-lab/View.js';
import { FootprintView } from './footprint/View.js';
import { ManpowerView } from './manpower/View.js';
import { RegistersView } from './machines-register/View.js';
import { PmCalendarPage } from './pm-calendar/Page.js';
import { ProblemAnalysisView } from './problem-analysis/View.js';
import { ShiftKpisView } from './shift-kpis/View.js';
import { TeamFocusLive } from './team-focus/TeamFocusLive.js';
import { WhyWhyLive } from './why-why/WhyWhyLive.js';
import type { CellLogModel } from './cell-change-log/model.js';
import { useScreenModel, type ScreenModel, type ScreenParams } from './data.js';
import { savedFigures } from './figures/live.js';
import { EntityShell } from './entity/EntityShell.js';
import {
  FORECAST,
  LiveFrame,
  ModelFrame,
  type LiveEntry,
  type ModelKey,
  type PageConfig,
} from './live-frame.js';
import { useRefreshOnFigures } from './refresh.js';
import type { SectionId } from '../analytics/shell/shell-data.js';

/**
 * The v2 screens that are live: each renders at the URL its v1 page had, inside the v2 shell, with the data and the role
 * rules v1 used. `AnalyticsFace` asks here first and falls back to v1's page for any screen not listed.
 */
type Live = LiveEntry & { page: () => ReactElement };

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
  const client = useQueryClient();
  const loaded = useScreenModel('cell-change-log', {});
  const [corrected, setCorrected] = useState(false);
  const correct = useCorrect(() => {
    setCorrected(true);
    loaded.retry();
  });
  // The list is the saved copy when the refresh failed; after a correction it says so, so the old date is not read as the new.
  const saved = loaded.state === 'ready' && savedFigures(client);
  const stale = saved ? (corrected ? 'afterCorrection' : 'saved') : undefined;
  useEffect(() => {
    if (loaded.state === 'ready' && !saved) setCorrected(false);
  }, [loaded.state, saved]);
  const last = useRef<CellLogModel>(undefined);
  if (loaded.state === 'ready' && loaded.model) last.current = loaded.model;
  const model = loaded.model ?? (loaded.state === 'loading' ? last.current : undefined);
  const title = t('v2m.title.log');
  return (
    <LiveFrame entry={{ group: 'machines', section: 'machines', screen: 'cell-change-log' }}>
      {(nav) =>
        model ? (
          <CellLogView model={model} nav={nav} title={title} onCorrect={correct} stale={stale} />
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
function ModelPage<K extends ModelKey>(config: PageConfig<K>) {
  const loaded = useScreenModel(config.screen, {} as ScreenParams<K>);
  useRefreshOnFigures(loaded.retry);
  /** The screen stays as it was while a refresh loads or fails: the figures refresh every 30 seconds, as they did in v1. */
  const last = useRef<ScreenModel<K>>(undefined);
  if (loaded.state === 'ready' && loaded.model) last.current = loaded.model;
  return <ModelFrame {...config} loaded={loaded} lastGood={last.current} />;
}

const screenOf = (group: GroupId, section: SectionId, screen: string) => ({
  group,
  section,
  screen,
});

const LIVE: readonly Live[] = [
  { group: 'today', section: 'today', screen: 'dashboard', page: () => <DashboardPage /> },
  {
    group: 'breakdowns',
    section: 'problems',
    screen: 'breakdown-log',
    page: () => <BreakdownLogPage />,
  },
  { group: 'pm', section: 'reports', screen: 'pm-calendar', page: () => <PmCalendarPage /> },
  { group: 'machines', section: 'machines', screen: 'compare', page: () => <ComparePage /> },
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
    group: 'breakdowns',
    section: 'problems',
    screen: 'a4-manpower',
    page: () => (
      <ModelPage
        entry={screenOf('breakdowns', 'problems', 'a4-manpower')}
        screen="manpower"
        empty="analytics.notComputed"
        title="v2r.mp.title"
        draw={(model, shell) => <ManpowerView model={model} {...shell} />}
      />
    ),
  },
  {
    group: 'today',
    section: 'today',
    screen: 'data-checklist',
    page: () => (
      <ModelPage
        entry={screenOf('today', 'today', 'data-checklist')}
        screen="data-checklist"
        empty="analytics.notComputed"
        title="analytics.screen.data-checklist"
        draw={(model, shell) => <DataChecklistLive model={model} {...shell} />}
      />
    ),
  },
  {
    group: 'today',
    section: 'today',
    screen: 'team-focus',
    page: () => (
      <ModelPage
        entry={screenOf('today', 'today', 'team-focus')}
        screen="team-focus"
        empty="analytics.notComputed"
        title="analytics.screen.team-focus"
        draw={(model, shell) => <TeamFocusLive model={model} {...shell} />}
      />
    ),
  },
  {
    group: 'breakdowns',
    section: 'problems',
    screen: 'a6-why-why',
    page: () => (
      <ModelPage
        entry={screenOf('breakdowns', 'problems', 'a6-why-why')}
        screen="why-why"
        empty="analytics.notComputed"
        title="v2r.ww.title"
        draw={(model, shell) => <WhyWhyLive model={model} {...shell} />}
      />
    ),
  },
  {
    group: 'breakdowns',
    section: 'problems',
    screen: 'a1-bd-pm',
    page: () => (
      <ModelPage
        entry={screenOf('breakdowns', 'problems', 'a1-bd-pm')}
        screen="bd-pm"
        empty="analytics.notComputed"
        title="v2r.bd.title"
        draw={(model, shell) => <BdPmView model={model} {...shell} />}
      />
    ),
  },
  {
    group: 'breakdowns',
    section: 'problems',
    screen: 'a2-category-cell',
    page: () => (
      <ModelPage
        entry={screenOf('breakdowns', 'problems', 'a2-category-cell')}
        screen="category-cell"
        empty="analytics.notComputed"
        title="v2r.cc.title"
        draw={(model, shell) => <CategoryCellView model={model} {...shell} />}
      />
    ),
  },
  {
    group: 'breakdowns',
    section: 'problems',
    screen: 'a3-mttr-mtbf',
    page: () => (
      <ModelPage
        entry={screenOf('breakdowns', 'problems', 'a3-mttr-mtbf')}
        screen="mttr-mtbf"
        empty="analytics.notComputed"
        title="v2r.mm.title"
        draw={(model, shell) => <MttrMtbfView model={model} {...shell} />}
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

/**
 * The live v2 page for a group's screen (`?screen=`, or the group's first), or null when that screen is still v1's. A
 * Machines screen the group does not have (a bookmark, a typo, the machine page's id) goes to the register, the
 * group's first v2 screen: there is no v1 copy of it to fall back to. The Reliability and forecast group is v2 whole,
 * so an unknown `?screen=` there opens its first screen, Bottleneck.
 */
export function liveScreen(group: string | undefined, screen: string | null): ReactElement | null {
  // Today: an unknown ?screen= (or none) is the Dashboard, as in v1.
  const named = screen ?? FIRST[group ?? ''] ?? null;
  const found =
    LIVE.find((entry) => entry.group === group && entry.screen === named) ??
    (WHOLE.has(group ?? '') ? LIVE.find((entry) => entry.group === group) : undefined);
  if (found) return <Fragment key={`${found.group}:${found.screen}`}>{found.page()}</Fragment>;
  return unknownMachinesScreen(group, named);
}

/** A Machines screen the group does not have goes to the register; every other miss is the v1 page's. */
function unknownMachinesScreen(
  group: string | undefined,
  named: string | null,
): ReactElement | null {
  return group === 'machines' && named !== null && !knownMachinesScreen(named) ? (
    <Navigate to="/analytics/machines?screen=registers" replace />
  ) : null;
}

/** The screen a group's address opens with no `?screen=`. */
const FIRST: Record<string, string> = {
  machines: 'registers',
  today: 'dashboard',
  breakdowns: 'breakdown-log',
  pm: 'pm-calendar',
};
/** Groups that are v2 whole: an unknown `?screen=` opens their first screen. */
const WHOLE: ReadonlySet<string> = new Set([FORECAST, 'today', 'pm', 'breakdowns']);

function knownMachinesScreen(id: string): boolean {
  return (groupFor('machines')?.screens ?? []).some(
    (known) => known === id && known !== 'machine-page',
  );
}

export { ModelFrame };
