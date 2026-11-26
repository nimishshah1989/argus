import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getBrand, getMe } from '../../../api.js';
import { readsAnalytics } from '../../../roles.js';
import { AccountButton, AccountSheet } from '../../../ui/v2/account-sheet.js';
import { DraftsList } from '../../../ui/v2/drafts-list.js';
import type { DrawerSpec } from '../../../ui/v2/drawer.js';
import { Segmented } from '../../../ui/v2/segmented.js';
import { EntityShell, WhoContext } from '../entity/EntityShell.js';
import { useNav } from '../nav.js';
import { mayOpen, showsSettings, type DeskView } from './model.js';
import { OfflineNotice, SyncStatus } from './parts.js';

type Tab = DeskView | 'live';
const ROUTE: Record<Tab, string> = {
  open: '/desk',
  mine: '/desk/mine',
  team: '/desk/team',
  live: '/desk/board',
};

/** The rail of a desk page: the login's sections, with the desk (its foot entry) marked as the page you are on. */
export function useDeskNav(role: string | undefined) {
  return useNav('today', role).map((item) => ({ ...item, current: item.id === 'desk' }));
}

/**
 * The desk's section tabs (ADR 0056 point 2): Open (count), Mine, Team and Live board as the kit's tabs, then
 * "Report a problem" (the floor's report flow), Plant settings and Settings for admin and head, and the account.
 */
function DeskTabs({ current, badge, role }: { current: DeskView; badge: number; role?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [account, setAccount] = useState(false);
  const tabs: { key: Tab; label: string }[] = [
    { key: 'open', label: `${t('desk.tab.open')} (${badge})` },
    { key: 'mine', label: t('desk.tab.mine') },
    { key: 'team', label: t('desk.tab.team') },
    { key: 'live', label: t('deskLists.tab.live') },
  ];
  const shown = tabs.filter((tab) => tab.key === 'live' || !role || mayOpen(tab.key, role));
  return (
    <div className="v2-desk-bar">
      <Segmented
        label={t('deskLists.tabs')}
        options={shown}
        value={current}
        onChange={(key) => navigate(ROUTE[key])}
      />
      <div className="v2-desk-tools">
        <Link to="/floor" className="v2-btn v2-btn-primary">
          {t('deskLists.reportProblem')}
        </Link>
        {role && readsAnalytics(role) ? (
          <Link to="/analytics" className="v2-btn v2-btn-ghost">
            {t('analytics.entry')}
          </Link>
        ) : null}
        {showsSettings(role) ? (
          <>
            <Link to="/settings/machines" className="v2-btn v2-btn-ghost">
              {t('plant.menu.link')}
            </Link>
            <Link to="/desk/settings" className="v2-btn v2-btn-ghost">
              {t('settings.title')}
            </Link>
          </>
        ) : null}
        <AccountButton onClick={() => setAccount(true)} />
      </div>
      <AccountSheet open={account} onOpenChange={setAccount} />
    </div>
  );
}

/** The frame's company name and role, as the analytics screens give it (the header's plant, the search's pages). */
export function DeskWho({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const role = useQuery({ queryKey: ['me'], queryFn: getMe }).data?.user.role;
  const brand = useQuery({ queryKey: ['brand'], queryFn: getBrand }).data?.company;
  return (
    <WhoContext.Provider value={{ role, company: brand || t('analytics.title') }}>
      {children}
    </WhoContext.Provider>
  );
}

/**
 * A desk page in the v2 Shell (ADR 0055 point 2, S28): the rail with Desk current, the title in the header, the
 * section tabs and tools, "Updated · sync", the offline notice, the drafts, then the page. `drawer` is the ticket
 * opened beside the list on a wide screen.
 */
export function DeskFrame({
  title,
  updated,
  current,
  badge,
  drawer = null,
  children,
}: {
  title: string;
  updated?: string;
  current: DeskView;
  badge: number;
  drawer?: DrawerSpec | null;
  children: ReactNode;
}) {
  const role = useQuery({ queryKey: ['me'], queryFn: getMe }).data?.user.role;
  const nav = useDeskNav(role);
  return (
    <DeskWho>
      <EntityShell nav={nav} title={title} drawer={drawer}>
        <div className="v2-desk">
          <DeskTabs current={current} badge={badge} role={role} />
          <p className="v2-sub v2-desk-sync">
            {updated ? <span>{updated}</span> : null}
            <SyncStatus />
          </p>
          <OfflineNotice />
          <DraftsList />
          {children}
        </div>
      </EntityShell>
    </DeskWho>
  );
}

/** A login whose role may not open this screen (B4): say so, and offer what it can do. */
export function NotAvailable({ roleLabel }: { roleLabel: string }) {
  const { t } = useTranslation();
  const role = useQuery({ queryKey: ['me'], queryFn: getMe }).data?.user.role;
  const nav = useDeskNav(role);
  return (
    <DeskWho>
      <EntityShell nav={nav} title={t('desk.title')}>
        <section className="v2-card v2-pad v2-stack v2-desk-refused">
          <span className="v2-pill v2-pill-neutral">{roleLabel}</span>
          <h2 className="v2-h2">{t('deskLists.notAvailable')}</h2>
          <p className="v2-sub">{t('deskLists.notAvailable.body')}</p>
          <Link to="/floor" className="v2-btn v2-btn-primary">
            {t('deskLists.reportProblem')}
          </Link>
        </section>
      </EntityShell>
    </DeskWho>
  );
}
