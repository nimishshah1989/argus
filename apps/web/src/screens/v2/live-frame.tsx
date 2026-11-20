import type { MessageKey } from '@uptimo/shared/i18n';
import { useEffect, type ReactElement, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getBrand, getMe } from '../../api.js';
import { readsAnalytics } from '../../roles.js';
import { Segmented } from '../../ui/v2/segmented.js';
import { ScreenStates, type Loaded } from '../../ui/v2/screen-states.js';
import { SCREEN_LABELS, groupFor, parseDrill, type GroupId } from '../analytics/groups.js';
import { sectionsFor, type SectionId } from '../analytics/shell/shell-data.js';
import type { NavItem } from '../../ui/v2/shell.js';
import { type ScreenModel } from './data.js';
import { ChromeContext, EntityShell, WhoContext } from './entity/EntityShell.js';
import { liveReply } from './figures/live.js';
import {
  NO_SUCH_FIGURE,
  figureForLegacyDrill,
  searchForLegacyDrill,
} from './rows-behind/legacy.js';
import { useNav } from './nav.js';
import { modelToShow } from './refresh.js';

/** Where a live screen sits: its group, its section of the rail and its own name. */
export type LiveEntry = { group: GroupId; section: SectionId; screen: string };

const NAV_LABEL: Partial<Record<GroupId, MessageKey>> = {
  machines: 'analytics.machines.nav',
  breakdowns: 'analytics.breakdowns.nav',
};

/** The Reliability and forecast section names its screens as the shell's own tab row did: "Screens in {section}". */
export const FORECAST: GroupId = 'forecast-scorecard';

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

/**
 * An old v1 link (`?drill=<type>:<ids>`, from a tile, a bookmark or a pasted address) opens the same rows in the rows
 * panel: the figure those ids belong to is found in the engine's reply and the address becomes `?drawer=figure:<key>`.
 * Ids no figure counts open the panel with nothing in it, never a v1 table.
 */
function useLegacyDrill(screen: string) {
  const { search } = useLocation();
  const navigate = useNavigate();
  const client = useQueryClient();
  useEffect(() => {
    const asked = parseDrill(new URLSearchParams(search).get('drill'));
    if (!asked) return;
    let current = true;
    const go = (figure: string) =>
      current && navigate({ search: searchForLegacyDrill(search, figure) }, { replace: true });
    liveReply(client).then(
      (reply) => go(figureForLegacyDrill(reply, asked, screen)),
      () => go(NO_SUCH_FIGURE),
    );
    return () => {
      current = false;
    };
  }, [search, screen, client, navigate]);
}

/** A screen's frame: the rail by the login's role, the section's screens above, and the figures' states in place of the page. */
export function LiveFrame({
  entry,
  children,
}: {
  entry: LiveEntry;
  children: (nav: ReturnType<typeof useNav>) => ReactNode;
}) {
  const role = useQuery({ queryKey: ['me'], queryFn: getMe }).data?.user.role;
  const { t } = useTranslation();
  const brand = useQuery({ queryKey: ['brand'], queryFn: getBrand }).data?.company;
  const nav = useNav(entry.section, role);
  useLegacyDrill(entry.screen);
  return (
    <WhoContext.Provider value={{ role, company: brand || t('analytics.title') }}>
      <ChromeContext.Provider
        value={
          /* A login that may not open the analytics face sees the refusal, not the section's menu (as in v1). */
          role !== undefined && !readsAnalytics(role) ? null : entry.group === 'today' ? (
            <TodayTabs />
          ) : (
            <ScreenTabs group={entry.group} current={entry.screen} />
          )
        }
      >
        {children(nav)}
      </ChromeContext.Provider>
    </WhoContext.Provider>
  );
}

export type ModelKey =
  | 'dashboard'
  | 'machines-register'
  | 'age'
  | 'footprint'
  | 'fix-finder'
  | 'problem-analysis'
  | 'energy'
  | 'bottleneck'
  | 'forecast-lab'
  | 'shift-kpis'
  | 'manpower'
  | 'why-why'
  | 'bd-pm'
  | 'category-cell'
  | 'mttr-mtbf';

export type PageConfig<K extends ModelKey> = {
  entry: LiveEntry;
  screen: K;
  title: MessageKey;
  /** What the screen says when the model is null: a figure the engine has not computed says so, not "nothing to show". */
  empty?: MessageKey;
  /** Above the states while the page has no model (the Dashboard's Action Center count, as in v1). */
  before?: ReactNode;
  draw: (model: ScreenModel<K>, shell: { nav: NavItem[]; title: string }) => ReactElement;
};

/**
 * What a model page shows for where its load stands: the model when there is one to draw, else the states in the shell,
 * under the screen's own title in every state.
 */
export function ModelFrame<K extends ModelKey>({
  entry,
  title,
  empty,
  before,
  draw,
  loaded,
  lastGood,
}: Omit<PageConfig<K>, 'screen'> & { loaded: Loaded<ScreenModel<K>>; lastGood?: ScreenModel<K> }) {
  const { t } = useTranslation();
  const model = modelToShow(loaded, lastGood);
  const heading = t(title);
  return (
    <LiveFrame entry={entry}>
      {(nav) =>
        model ? (
          draw(model, { nav, title: heading })
        ) : (
          <EntityShell nav={nav} title={heading}>
            {before}
            <ScreenStates loaded={loaded} emptyText={empty ? t(empty) : undefined}>
              {() => null}
            </ScreenStates>
          </EntityShell>
        )
      }
    </LiveFrame>
  );
}
