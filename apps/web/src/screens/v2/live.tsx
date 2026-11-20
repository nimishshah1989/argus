/* eslint-disable i18next/no-literal-string -- screen ids and routes only; every visible word goes through t() */
import type { MessageKey } from '@uptimo/shared/i18n';
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { correctMove, getBrand, getMe } from '../../api.js';
import { ApiError, isOffline } from '../../data/index.js';
import { Segmented } from '../../ui/v2/segmented.js';
import { ScreenStates } from '../../ui/v2/screen-states.js';
import { correctionError } from '../analytics/machine-values.js';
import { SCREEN_LABELS, groupFor, parseDrill, type GroupId } from '../analytics/groups.js';
import { AgeView } from './age/View.js';
import { CellLogView } from './cell-change-log/View.js';
import { FixFinderView } from './fix-finder/View.js';
import { FootprintView } from './footprint/View.js';
import { RegistersView } from './machines-register/View.js';
import { ProblemAnalysisView } from './problem-analysis/View.js';
import type { CellLogModel } from './cell-change-log/model.js';
import { useScreenModel, type ScreenModel, type ScreenParams } from './data.js';
import { savedFigures } from './figures/live.js';
import { ChromeContext, EntityShell, WhoContext } from './entity/EntityShell.js';
import { liveReply } from './figures/live.js';
import {
  NO_SUCH_FIGURE,
  figureForLegacyDrill,
  searchForLegacyDrill,
} from './rows-behind/legacy.js';
import { useNav } from './nav.js';
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
function LiveFrame({
  entry,
  children,
}: {
  entry: Pick<Live, 'group' | 'section' | 'screen'>;
  children: (nav: ReturnType<typeof useNav>) => ReactNode;
}) {
  const role = useQuery({ queryKey: ['me'], queryFn: getMe }).data?.user.role;
  const { t } = useTranslation();
  const brand = useQuery({ queryKey: ['brand'], queryFn: getBrand }).data?.company;
  const nav = useNav(entry.section, role);
  useLegacyDrill(entry.screen);
  return (
    <WhoContext.Provider value={{ role, company: brand || t('analytics.title') }}>
      <ChromeContext.Provider value={<ScreenTabs group={entry.group} current={entry.screen} />}>
        {children(nav)}
      </ChromeContext.Provider>
    </WhoContext.Provider>
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

/**
 * The live v2 page for a group's screen (`?screen=`, or the group's first), or null when that screen is still v1's. A
 * Machines screen the group does not have (a bookmark, a typo, the machine page's id) goes to the register, the
 * group's first v2 screen: there is no v1 copy of it to fall back to.
 */
export function liveScreen(group: string | undefined, screen: string | null): ReactElement | null {
  const named = screen ?? (group === 'machines' ? 'registers' : null);
  const found = LIVE.find((entry) => entry.group === group && entry.screen === named);
  if (found) return found.page();
  const known = groupFor('machines')?.screens.filter((id) => id !== 'machine-page') ?? [];
  return group === 'machines' && named !== null && !known.includes(named) ? (
    <Navigate to="/analytics/machines?screen=registers" replace />
  ) : null;
}
