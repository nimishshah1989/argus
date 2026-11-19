/* eslint-disable i18next/no-literal-string -- routes, ids and prop values only; every visible string goes through t() */
import type { ComponentType, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import { getMe } from '../../api.js';
import { CrudPage } from '../../patterns/crud-page.js';
import type { CrudRow, CrudSpec } from '../../patterns/crud-spec.js';
import { useWide } from '../../patterns/wide.js';
import {
  AlarmClock,
  BookOpen,
  Building2,
  CalendarCheck,
  CalendarClock,
  ChevronRight,
  Clock,
  Factory,
  FlaskConical,
  Languages,
  LayoutGrid,
  List,
  Menu,
  ShieldCheck,
  type IconComponent,
} from '../../ui/icon.js';
import { SideNav } from '../../ui/side-nav.js';
import { TopBar } from '../../ui/top-bar.js';
import { useSystemTheme } from '../desk/Shell.js';
import { CompanyScreen } from './Company.js';
import { analyticsProfileSpec } from './analytics-profile-spec.js';
import { TranslationsScreen } from './Translations.js';
import { GlossaryScreen, ListsScreen } from './Lists.js';
import { ladderSpec } from './ladder-spec.js';
import { groupsSpec, machinesSpec, shiftsSpec } from './plant-specs.js';
import { pmPlansSpec } from './pm-plans-spec.js';
import { registersSpec } from './registers-spec.js';
import { RosterScreen } from './roster-spec.js';
import { PeopleSettings, PEOPLE_PAGES } from './People.js';
import { AuditSettings, AUDIT_PAGE } from './Audit.js';
import { FailedCount, JOBS_PAGE, canSeeJobs, countLabel, useFailedCount } from './Jobs.js';

export type PlantPage =
  | 'home'
  | 'machines'
  | 'groups'
  | 'shifts'
  | 'pm-plans'
  | 'registers'
  | 'roster'
  | 'ladder'
  | 'people'
  | 'logins'
  | 'audit'
  | 'jobs'
  | 'lists'
  | 'glossary'
  | 'company'
  | 'translations'
  | 'analytics-profile';
type Key =
  | 'plant.menu.machines'
  | 'plant.menu.groups'
  | 'plant.menu.shifts'
  | 'pm.menu.plans'
  | 'plant.menu.registers'
  | 'plant.menu.roster'
  | 'plant.menu.ladder'
  | 'people.menu.people'
  | 'people.menu.logins'
  | 'audit.menu'
  | 'jobs.menu'
  | 'lists.menu.lists'
  | 'lists.menu.glossary'
  | 'company.menu.company'
  | 'plant.menu.translations'
  | 'analytics.profile.menu';

export interface PlantPageSpec {
  page: Exclude<PlantPage, 'home'>;
  icon: IconComponent;
  key: Key;
  /** A page that is not one generated list (the lists hub, the company form). */
  screen?: ComponentType;
  /** Listed only for an admin on a personal login (the API's own rule). */
  adminOnly?: boolean;
  spec?: CrudSpec<never>;
}

/**
 * Plant settings (D5): one list is the menu and the routes, so a new config (ticket 23) is added in one
 * place. `App.tsx` maps it to `/settings/<page>`, and the left menu and phone list read the same entries.
 */
export const PLANT_PAGES: readonly PlantPageSpec[] = [
  { page: 'machines', icon: Factory, key: 'plant.menu.machines', spec: machinesSpec as never },
  { page: 'groups', icon: LayoutGrid, key: 'plant.menu.groups', spec: groupsSpec as never },
  { page: 'shifts', icon: Clock, key: 'plant.menu.shifts', spec: shiftsSpec as never },
  { page: 'pm-plans', icon: CalendarCheck, key: 'pm.menu.plans', spec: pmPlansSpec as never },
  {
    page: 'registers',
    icon: ShieldCheck,
    key: 'plant.menu.registers',
    spec: registersSpec as never,
  },
  { page: 'roster', icon: CalendarClock, key: 'plant.menu.roster', screen: RosterScreen },
  { page: 'ladder', icon: AlarmClock, key: 'plant.menu.ladder', spec: ladderSpec as never },
  ...(PEOPLE_PAGES as readonly PlantPageSpec[]),
  { ...AUDIT_PAGE, spec: null as never },
  JOBS_PAGE,
  { page: 'lists', icon: List, key: 'lists.menu.lists', screen: ListsScreen },
  { page: 'glossary', icon: BookOpen, key: 'lists.menu.glossary', screen: GlossaryScreen },
  { page: 'company', icon: Building2, key: 'company.menu.company', screen: CompanyScreen },
  {
    page: 'analytics-profile',
    icon: FlaskConical,
    key: 'analytics.profile.menu',
    spec: analyticsProfileSpec as never,
  },
  {
    page: 'translations',
    icon: Languages,
    key: 'plant.menu.translations',
    screen: TranslationsScreen,
  },
];

function Home({ pages, failed }: { pages: readonly PlantPageSpec[]; failed: number }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <h2 className="px-1 text-footnote font-semibold text-neutral-600">{t('plant.menu.plant')}</h2>
      <ul className="rounded-2xl bg-surface px-4 shadow-card">
        {pages.map(({ page, icon: Icon, key }) => (
          <li key={page} className="border-t border-neutral-200 first:border-t-0">
            <Link to={`/settings/${page}`} className="flex min-h-16 items-center gap-3 py-2">
              <Icon aria-hidden size={22} />
              <span className="flex-1">
                <span className="block text-body font-semibold">{t(key)}</span>
                <span className="block text-footnote text-neutral-600">{t(`${key}.sub`)}</span>
              </span>
              {page === 'jobs' ? <FailedCount count={failed} /> : null}
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

function Body({
  page,
  pages,
  failed,
}: {
  page: PlantPage;
  pages: readonly PlantPageSpec[];
  failed: number;
}) {
  if (page === 'people' || page === 'logins') return <PeopleSettings page={page} />;
  if (page === 'audit') return <AuditSettings />;
  const found = PLANT_PAGES.find((p) => p.page === page);
  if (!found) return <Home pages={pages} failed={failed} />;
  if (found.screen) {
    const Screen = found.screen;
    return <Screen />;
  }
  return <CrudPage key={page} spec={found.spec as CrudSpec<CrudRow>} />;
}

/** Plant settings for an admin or head: the desktop left menu, or on a phone a list and back to it. */
export function PlantSettings({ page }: { page: PlantPage }) {
  const { t } = useTranslation();
  const wide = useWide();
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  useSystemTheme();
  const role = me.data?.user.role;
  const failed = useFailedCount(me.data?.user);
  const pages = PLANT_PAGES.filter((p) => !p.adminOnly || canSeeJobs(me.data?.user));
  if (wide && page === 'home') return <Navigate to="/settings/machines" replace />;
  let content: ReactNode = <p className="text-neutral-600">{t('common.loading')}</p>;
  if (role)
    content =
      role === 'admin' || role === 'head' ? (
        <Body page={page} pages={pages} failed={failed} />
      ) : (
        <NoAccess />
      );
  const nav = [
    {
      title: t('nav.desk'),
      items: [
        { to: '/desk', label: t('desk.tab.open'), icon: Menu },
        { to: '/desk/board', label: t('deskLists.tab.live'), icon: LayoutGrid },
      ],
    },
    {
      title: t('plant.menu.plant'),
      items: pages.map(({ page: to, icon, key }) => ({
        to: `/settings/${to}`,
        label:
          to === 'jobs' && failed > 0
            ? t('jobs.menu.withCount', { n: countLabel(failed) })
            : t(key),
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
      {page === 'home' ? (
        <TopBar title={t('plant.title')} back={{ to: '/desk', label: t('settings.back') }} />
      ) : (
        <TopBar back={{ to: '/settings', label: t('plant.title') }} />
      )}
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-4">{content}</main>
    </div>
  );
}
