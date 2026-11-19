import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getMe } from '../../api.js';
import { AccountButton, AccountSheet } from '../../components/AccountSheet.js';
import { DESK_ROLES, readsAnalytics } from '../../roles.js';
import { SyncStatus } from '../../patterns/sync-status.js';
import { useWide } from '../../patterns/wide.js';
import {
  CirclePlus,
  FlaskConical,
  LayoutGrid,
  Lock,
  Menu,
  Users,
  Wrench,
  type IconComponent,
} from '../../ui/icon.js';
import { SideNav } from '../../ui/side-nav.js';
import { TabBar } from '../../ui/tab-bar.js';
import { TopBar } from '../../ui/top-bar.js';

function TopTrailing({ person }: { person: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <SyncStatus />
      {person}
    </div>
  );
}

export type DeskView = 'open' | 'mine' | 'team';

const DESK: readonly string[] = DESK_ROLES;
/** DOMAIN §3: Mine is for people who work tickets; the plant head sees Open and Team only. */
const MAY_OPEN: Record<DeskView, readonly string[]> = {
  open: DESK,
  mine: DESK.filter((role) => role !== 'plant_head'),
  team: DESK,
};

export function mayOpen(view: DeskView, role: string): boolean {
  return MAY_OPEN[view].includes(role);
}

/**
 * The desk follows the phone's light or dark setting (design lock B6) and gives it back when it closes.
 * `alwaysDark` is the wall TV, which is dark whatever the device says.
 */
export function useSystemTheme(alwaysDark = false): void {
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      if (alwaysDark || query.matches) document.documentElement.dataset.theme = 'dark';
      else delete document.documentElement.dataset.theme;
    };
    apply();
    query.addEventListener('change', apply);
    return () => {
      query.removeEventListener('change', apply);
      delete document.documentElement.dataset.theme;
    };
  }, [alwaysDark]);
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

/** The desktop menu adds the analytics face for the roles the lock names; the phone keeps its five tabs. */
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
      <div className="flex min-h-dvh bg-neutral-100 text-neutral-900">
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
    <div className="flex min-h-dvh flex-col bg-neutral-100 text-neutral-900">
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
    <div className="flex min-h-dvh flex-col bg-neutral-100 text-neutral-900">
      <TopBar
        title={t('desk.title')}
        trailing={
          <span className="rounded-full bg-muted-tint px-2.5 py-1 text-caption font-bold text-muted-ink">
            {roleLabel}
          </span>
        }
      />
      <main className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 px-4 pt-32 text-center">
        <span className="flex h-18 w-18 items-center justify-center rounded-full bg-neutral-200">
          <Lock aria-hidden size={32} />
        </span>
        <h2 className="text-title2 font-extrabold">{t('deskLists.notAvailable')}</h2>
        <p className="text-body text-neutral-600">{t('deskLists.notAvailable.body')}</p>
        <Link
          to="/floor"
          className="mt-8 flex min-h-target w-full items-center justify-center rounded-xl bg-accent-strong px-4 text-body font-semibold text-accent-ink"
        >
          {t('deskLists.reportProblem')}
        </Link>
      </main>
    </div>
  );
}
