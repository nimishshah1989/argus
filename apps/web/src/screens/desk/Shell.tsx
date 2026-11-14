/* eslint-disable i18next/no-literal-string -- prop values, ids and routes only; every visible string goes through t() */
import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SyncStatus } from '../../patterns/sync-status.js';
import { CirclePlus, LayoutGrid, Lock, Menu, Users, Wrench } from '../../ui/icon.js';
import { TabBar } from '../../ui/tab-bar.js';
import { TopBar } from '../../ui/top-bar.js';

export type DeskView = 'open' | 'mine' | 'team';

const DESK = ['technician', 'supervisor', 'head', 'plant_head', 'admin'];
/** DOMAIN §3: Mine is for people who work tickets; the plant head sees Open and Team only. */
const MAY_OPEN: Record<DeskView, string[]> = {
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

/** Header with the sync pill, the screen, and the five desk tabs. */
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
  useSystemTheme();
  const tabs = [
    { to: '/desk', label: t('desk.tab.open'), icon: Menu, badge },
    { to: '/desk/mine', label: t('desk.tab.mine'), icon: Wrench },
    { to: '/desk/team', label: t('desk.tab.team'), icon: Users },
    { to: '/floor', label: t('deskLists.tab.report'), icon: CirclePlus },
    { to: '/desk/board', label: t('deskLists.tab.live'), icon: LayoutGrid },
  ];
  return (
    <div className="flex min-h-dvh flex-col bg-neutral-100 text-neutral-900">
      <TopBar title={title} subtitle={subtitle} trailing={<SyncStatus />} />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-4">{children}</main>
      <TabBar
        label={t('deskLists.tabs')}
        tabs={tabs}
        current={current === 'open' ? '/desk' : `/desk/${current}`}
      />
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
