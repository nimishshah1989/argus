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
import { CellLogView } from './cell-change-log/View.js';
import { DashboardView } from './dashboard/View.js';
import type { DashboardModel } from './dashboard/model.js';
import type { CellLogModel } from './cell-change-log/model.js';
import { useScreenModel } from './data.js';
import { ChromeContext, EntityShell } from './entity/EntityShell.js';
import { useNav } from './nav.js';
import { sectionsFor, type SectionId } from '../analytics/shell/shell-data.js';

/**
 * The v2 screens that are live: each renders at the URL its v1 page had, inside the v2 shell, with the data and the role
 * rules v1 used. `AnalyticsFace` asks here first and falls back to v1's page for any screen not listed.
 */
type Live = {
  group: GroupId;
  section: SectionId;
  screen: string;
  /** The group's first screen, which its address opens with no `?screen=`. */
  first?: true;
  page: () => ReactElement;
};

const NAV_LABEL: Partial<Record<GroupId, MessageKey>> = {
  machines: 'analytics.machines.nav',
  breakdowns: 'analytics.breakdowns.nav',
};

/** The other screens of the group, as one row above the page, so the section stays reachable from a v2 screen. */
function ScreenTabs({ group, current }: { group: GroupId; current: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const screens = (groupFor(group)?.screens ?? []).filter((screen) => screen !== 'machine-page');
  return (
    <Segmented
      label={t(NAV_LABEL[group] ?? 'analytics.menu')}
      options={screens.map((screen) => ({
        key: screen,
        label: t(SCREEN_LABELS[screen] ?? 'analytics.screen.unknown'),
      }))}
      value={current}
      onChange={(screen) => navigate(`/analytics/${group}?screen=${screen}`)}
    />
  );
}

/** Today's screens as one row above the page: each tab is its own route, as the section's tabs are in the v1 shell. */
function TodayTabs() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const role = useQuery({ queryKey: ['me'], queryFn: getMe }).data?.user.role;
  const tabs = sectionsFor(role).find((section) => section.id === 'today')?.tabs ?? [];
  return (
    <Segmented
      label={t('ashell.tabs', { section: t('ashell.section.today') })}
      options={tabs.map((tab) => ({ key: tab.to, label: t(tab.label) }))}
      value={tabs[0]?.to ?? ''}
      onChange={(to) => navigate(to)}
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
  const tabs =
    entry.group === 'today' ? (
      <TodayTabs />
    ) : (
      <ScreenTabs group={entry.group} current={entry.screen} />
    );
  return <ChromeContext.Provider value={tabs}>{children(nav)}</ChromeContext.Provider>;
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

/** The Dashboard: Today's first screen, the landing page of a head. Each figure it prints is the engine's own. */
function DashboardPage() {
  const { t } = useTranslation();
  const loaded = useScreenModel('dashboard', {});
  const last = useRef<DashboardModel>(undefined);
  if (loaded.state === 'ready' && loaded.model) last.current = loaded.model;
  const model = loaded.model ?? (loaded.state === 'loading' ? last.current : undefined);
  const title = t('analytics.screen.dashboard');
  return (
    <LiveFrame entry={{ group: 'today', section: 'today', screen: 'dashboard' }}>
      {(nav) =>
        model ? (
          <DashboardView model={model} nav={nav} title={title} />
        ) : (
          <EntityShell nav={nav} title={title}>
            <ScreenStates loaded={loaded}>{() => null}</ScreenStates>
          </EntityShell>
        )
      }
    </LiveFrame>
  );
}

const LIVE: readonly Live[] = [
  {
    group: 'today',
    section: 'today',
    screen: 'dashboard',
    first: true,
    page: () => <DashboardPage />,
  },
  {
    group: 'machines',
    section: 'machines',
    screen: 'cell-change-log',
    page: () => <CellChangeLogPage />,
  },
];

/**
 * The live v2 page for a group's screen (`?screen=`, or the group's first), or null when that screen is still v1's. A
 * rows-behind link (`?drill=`) still goes to the v1 page that draws it, until every screen opens its rows in the drawer.
 */
export function liveScreen(
  group: string | undefined,
  screen: string | null,
  drilled = false,
): ReactElement | null {
  if (drilled) return null;
  return (
    LIVE.find(
      (entry) =>
        entry.group === group &&
        (entry.screen === screen || (entry.first === true && screen === null)),
    )?.page() ?? null
  );
}
