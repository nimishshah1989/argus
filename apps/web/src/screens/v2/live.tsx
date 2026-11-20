/* eslint-disable i18next/no-literal-string -- screen ids and routes only; every visible word goes through t() */
import type { MessageKey } from '@uptimo/shared/i18n';
import { useRef, type ReactElement, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { correctMove, getMe } from '../../api.js';
import { ApiError, isOffline } from '../../data/index.js';
import { Segmented } from '../../ui/v2/segmented.js';
import { ScreenStates } from '../../ui/v2/screen-states.js';
import { correctionError } from '../analytics/machine-values.js';
import { SCREEN_LABELS, groupFor, type GroupId } from '../analytics/groups.js';
import { ActionCenterPage } from './action-center/Page.js';
import { AgeView } from './age/View.js';
import { CellLogView } from './cell-change-log/View.js';
import { DashboardPage } from './dashboard/Page.js';
import { FixFinderView } from './fix-finder/View.js';
import { FootprintView } from './footprint/View.js';
import { MachinePage } from './machine/Page.js';
import { RegistersView } from './machines-register/View.js';
import { ProblemAnalysisView } from './problem-analysis/View.js';
import type { CellLogModel } from './cell-change-log/model.js';
import { useScreenModel, type ScreenModel, type ScreenParams } from './data.js';
import { ChromeContext, EntityShell } from './entity/EntityShell.js';
import { useNav } from './nav.js';
import type { NavItem } from '../../ui/v2/shell.js';
import { SECTIONS, type SectionId } from '../analytics/shell/shell-data.js';
import { ACTION_CENTER_PATH } from '../analytics/groups.js';

/**
 * The v2 screens that are live: each renders at the URL its v1 page had, inside the v2 shell, with the data and the role
 * rules v1 used. `AnalyticsFace` asks here first and falls back to v1's page for any screen not listed.
 */
type Live = { group: GroupId; section: SectionId; screen: string; page: () => ReactElement };

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

/** The Today section's screens as one row above the page; each is a real route of the section. */
function TodayTabs({ current }: { current: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const tabs = SECTIONS.find((section) => section.id === 'today')?.tabs ?? [];
  return (
    <Segmented
      label={t('ashell.section.today')}
      options={tabs.map((tab) => ({ key: tab.to, label: t(tab.label) }))}
      value={current}
      onChange={(to) => navigate(to)}
    />
  );
}

/** A screen's frame: the rail by the login's role, the section's screens above, and the figures' states in place of the page. */
function Frame({
  section,
  chrome,
  children,
}: {
  section: SectionId;
  chrome: ReactNode;
  children: (nav: ReturnType<typeof useNav>) => ReactNode;
}) {
  const role = useQuery({ queryKey: ['me'], queryFn: getMe }).data?.user.role;
  const nav = useNav(section, role);
  return <ChromeContext.Provider value={chrome}>{children(nav)}</ChromeContext.Provider>;
}

function LiveFrame({
  entry,
  children,
}: {
  entry: Pick<Live, 'group' | 'section' | 'screen'>;
  children: (nav: ReturnType<typeof useNav>) => ReactNode;
}) {
  return (
    <Frame
      section={entry.section}
      chrome={<ScreenTabs group={entry.group} current={entry.screen} />}
    >
      {children}
    </Frame>
  );
}

/** The Action Center, at the address v1 had (`/analytics/today/action-center`). */
export function ActionCenterLive() {
  const { t } = useTranslation();
  return (
    <Frame section="today" chrome={<TodayTabs current={ACTION_CENTER_PATH} />}>
      {(nav) => <ActionCenterPage nav={nav} title={t('analytics.screen.action-center')} />}
    </Frame>
  );
}

/** One machine's page, at the address v1 had (`/analytics/machines/:id`). */
export function MachinePageLive() {
  const { id = '' } = useParams();
  return (
    <LiveFrame entry={{ group: 'machines', section: 'machines', screen: 'machine-page' }}>
      {(nav) => <MachinePage id={id} nav={nav} />}
    </LiveFrame>
  );
}

/** The Dashboard, at the address v1 had (`/analytics/today`, and `?screen=dashboard`). */
function DashboardLive() {
  const { t } = useTranslation();
  return (
    <Frame section="today" chrome={<TodayTabs current="/analytics/today" />}>
      {(nav) => <DashboardPage nav={nav} title={t('analytics.screen.dashboard')} />}
    </Frame>
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
  K extends 'machines-register' | 'age' | 'footprint' | 'fix-finder' | 'problem-analysis',
>({
  entry,
  screen,
  title,
  draw,
}: {
  entry: Pick<Live, 'group' | 'section' | 'screen'>;
  screen: K;
  title: MessageKey;
  draw: (model: ScreenModel<K>, shell: { nav: NavItem[]; title: string }) => ReactElement;
}) {
  const { t } = useTranslation();
  const loaded = useScreenModel(screen, {} as ScreenParams<K>);
  const heading = t(title);
  return (
    <LiveFrame entry={entry}>
      {(nav) =>
        loaded.state === 'ready' && loaded.model ? (
          draw(loaded.model, { nav, title: heading })
        ) : (
          <EntityShell nav={nav} title={heading}>
            <ScreenStates loaded={loaded}>{() => null}</ScreenStates>
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
  { group: 'today', section: 'today', screen: 'dashboard', page: () => <DashboardLive /> },
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
];

/** The live v2 page for a group's screen (`?screen=`, or the group's first), or null when that screen is still v1's. */
export function liveScreen(group: string | undefined, screen: string | null): ReactElement | null {
  const named =
    screen ?? (group === 'machines' ? 'registers' : group === 'today' ? 'dashboard' : null);
  return LIVE.find((entry) => entry.group === group && entry.screen === named)?.page() ?? null;
}
