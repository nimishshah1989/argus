/* eslint-disable i18next/no-literal-string -- routes, ids and prop values only; every visible string goes through t() */
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import { getMe } from '../../api.js';
import { CrudPage } from '../../patterns/crud-page.js';
import type { CrudRow, CrudSpec } from '../../patterns/crud-spec.js';
import { useWide } from '../../patterns/wide.js';
import { ChevronRight, Clock, Factory, LayoutGrid, type IconComponent } from '../../ui/icon.js';
import { SideNav } from '../../ui/side-nav.js';
import { TopBar } from '../../ui/top-bar.js';
import { useSystemTheme } from '../desk/Shell.js';
import { groupsSpec, machinesSpec, shiftsSpec } from './plant-specs.js';

type PlantPage = 'home' | 'machines' | 'groups' | 'shifts';
type Key = 'plant.menu.machines' | 'plant.menu.groups' | 'plant.menu.shifts';

/** Plant settings (D5): one menu entry per config of `CrudPage`; the menu is where a new config is added. */
const PAGES: {
  page: Exclude<PlantPage, 'home'>;
  icon: IconComponent;
  key: Key;
  spec: CrudSpec<never>;
}[] = [
  { page: 'machines', icon: Factory, key: 'plant.menu.machines', spec: machinesSpec as never },
  { page: 'groups', icon: LayoutGrid, key: 'plant.menu.groups', spec: groupsSpec as never },
  { page: 'shifts', icon: Clock, key: 'plant.menu.shifts', spec: shiftsSpec as never },
];

function Home() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <h2 className="px-1 text-footnote font-semibold text-neutral-600">{t('plant.menu.plant')}</h2>
      <ul className="rounded-2xl bg-surface px-4 shadow-card">
        {PAGES.map(({ page, icon: Icon, key }) => (
          <li key={page} className="border-t border-neutral-200 first:border-t-0">
            <Link to={`/settings/${page}`} className="flex min-h-16 items-center gap-3 py-2">
              <Icon aria-hidden size={22} />
              <span className="flex-1">
                <span className="block text-body font-semibold">{t(key)}</span>
                <span className="block text-footnote text-neutral-600">{t(`${key}.sub`)}</span>
              </span>
              <ChevronRight aria-hidden size={20} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NoAccess() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2 pt-8 text-center">
      <h2 className="text-title2 font-extrabold">{t('plant.noAccess')}</h2>
      <p className="text-body text-neutral-600">{t('plant.noAccess.body')}</p>
    </div>
  );
}

function Body({ page }: { page: PlantPage }) {
  const found = PAGES.find((p) => p.page === page);
  return found ? <CrudPage key={page} spec={found.spec as CrudSpec<CrudRow>} /> : <Home />;
}

/** Plant settings for an admin or head: the desktop left menu, or on a phone a list and back to it. */
export function PlantSettings({ page }: { page: PlantPage }) {
  const { t } = useTranslation();
  const wide = useWide();
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  useSystemTheme();
  const role = me.data?.user.role;
  if (wide && page === 'home') return <Navigate to="/settings/machines" replace />;
  let content: ReactNode = <p className="text-neutral-600">{t('common.loading')}</p>;
  if (role) content = role === 'admin' || role === 'head' ? <Body page={page} /> : <NoAccess />;
  const nav = [
    {
      title: t('plant.menu.plant'),
      items: PAGES.map(({ page: to, icon, key }) => ({
        to: `/settings/${to}`,
        label: t(key),
        icon,
      })),
    },
  ];
  const bar = <TopBar title={t('plant.title')} />;
  if (wide)
    return (
      <div className="flex min-h-dvh bg-neutral-100 text-neutral-900">
        <div className="sticky top-0 h-dvh">
          <SideNav label={t('plant.menu')} groups={nav} current={`/settings/${page}`} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          {bar}
          <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4">{content}</main>
        </div>
      </div>
    );
  return (
    <div className="flex min-h-dvh flex-col bg-neutral-100 text-neutral-900">
      {page === 'home' ? bar : <TopBar back={{ to: '/settings', label: t('plant.title') }} />}
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-4">{content}</main>
    </div>
  );
}
