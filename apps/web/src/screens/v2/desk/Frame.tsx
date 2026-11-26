import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getMe } from '../../../api.js';
import { AccountButton, AccountSheet } from '../../../components/AccountSheet.js';
import { readsAnalytics } from '../../../roles.js';
import { SyncStatus } from '../../../patterns/sync-status.js';
import { useWide } from '../../../patterns/wide.js';
import {
  CirclePlus,
  FlaskConical,
  LayoutGrid,
  Lock,
  Menu,
  Users,
  Wrench,
  type IconComponent,
} from '../../../ui/icon.js';
import { SideNav } from '../../../ui/side-nav.js';
import { useSystemTheme } from '../../../ui/system-theme.js';
import { TabBar } from '../../../ui/tab-bar.js';
import { TopBar } from '../../../ui/top-bar.js';
import type { DeskView } from './model.js';

export const rowClass =
  'flex min-h-target items-center justify-between gap-3 rounded-card bg-surface px-4 py-3 shadow-card';

/** The small capitals over a group of cards or rows. */
export function ListHeading({ children }: { children: ReactNode }) {
  return <h2 className="v2-h2">{children}</h2>;
}

function TopTrailing({ person }: { person: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <SyncStatus />
      {person}
    </div>
  );
}

/** Header with the sync pill, the screen, and the five desk destinations: a bottom tab bar, or the left menu from 1024 px. */
function deskTabs(t: TFunction, badge: number) {
  return [
    { to: '/desk', label: t('desk.tab.open'), icon: Menu, badge },
    { to: '/desk/mine', label: t('desk.tab.mine'), icon: Wrench },
    { to: '/desk/team', label: t('desk.tab.team'), icon: Users },
    { to: '/floor', label: t('deskLists.tab.report'), icon: CirclePlus },
    { to: '/desk/board', label: t('deskLists.tab.live'), icon: LayoutGrid },
  ];
}

interface DeskTab {
  to: string;
  label: string;
  icon: IconComponent;
  badge?: number;
}

/** The desktop menu adds the analytics face for the roles `readsAnalytics` names (the server's `canAnalytics`); the phone keeps its five tabs. */
function menuTabs(role: string | undefined, tabs: DeskTab[], t: TFunction): DeskTab[] {
  if (!role || !readsAnalytics(role)) return tabs;
  return [...tabs, { to: '/analytics', label: t('analytics.entry'), icon: FlaskConical }];
}

export function DeskFrame({
  title,
  subtitle,
  current,
  badge,
  children,
}: {
  title: string;
  subtitle?: string;
  current: DeskView;
  badge: number;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const wide = useWide();
  useSystemTheme();
  const tabs = deskTabs(t, badge);
  const role = useQuery({ queryKey: ['me'], queryFn: getMe }).data?.user.role;
  const wideTabs = menuTabs(role, tabs, t);
  const here = current === 'open' ? '/desk' : `/desk/${current}`;
  const [account, setAccount] = useState(false);
  const person = <AccountButton named={wide} onClick={() => setAccount(true)} />;
  const top = (
    <TopBar
      title={title}
      subtitle={subtitle}
      trailing={<TopTrailing person={wide ? null : person} />}
    />
  );
  const sheet = <AccountSheet open={account} onOpenChange={setAccount} />;
  if (wide)
    return (
      <div className="flex min-h-dvh bg-v2-page">
        <div className="sticky top-0 h-dvh">
          <SideNav
            label={t('deskLists.tabs')}
            groups={[{ items: wideTabs }]}
            current={here}
            footer={person}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          {top}
          <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4">
            {children}
          </main>
        </div>
        {sheet}
      </div>
    );
  return (
    <div className="flex min-h-dvh flex-col bg-v2-page">
      {top}
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-4">{children}</main>
      <TabBar label={t('deskLists.tabs')} tabs={tabs} current={here} />
      {sheet}
    </div>
  );
}

/** A login whose role may not open this screen (B4): say so, and offer what it can do. */
export function NotAvailable({ roleLabel }: { roleLabel: string }) {
  const { t } = useTranslation();
  useSystemTheme();
  return (
    <div className="flex min-h-dvh flex-col bg-v2-page">
      <TopBar
        title={t('desk.title')}
        trailing={<span className="v2-pill v2-pill-neutral">{roleLabel}</span>}
      />
      <main className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 px-4 pt-32 text-center">
        <span className="flex h-18 w-18 items-center justify-center rounded-full bg-v2-well">
          <Lock aria-hidden size={32} />
        </span>
        <h2 className="v2-h2">{t('deskLists.notAvailable')}</h2>
        <p className="v2-sub">{t('deskLists.notAvailable.body')}</p>
        <Link to="/floor" className="v2-btn v2-btn-primary mt-8 w-full">
          {t('deskLists.reportProblem')}
        </Link>
      </main>
    </div>
  );
}
