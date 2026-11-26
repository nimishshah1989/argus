import type { ComponentType } from 'react';
import { CrudPage } from '../../patterns/crud-page.js';
import type { CrudRow, CrudSpec } from '../../patterns/crud-spec.js';
import {
  AlarmClock,
  BookOpen,
  Building2,
  CalendarCheck,
  CalendarClock,
  Clock,
  Factory,
  FlaskConical,
  Languages,
  LayoutGrid,
  List,
  ShieldCheck,
  type IconComponent,
} from '../../ui/icon.js';
import { CompanyScreen } from './Company.js';
import { analyticsProfileSpec } from './analytics-profile-spec.js';
import { TranslationsScreen } from './Translations.js';
import { GlossaryScreen, ListsScreen } from './Lists.js';
import { PeopleSettings, PEOPLE_PAGES } from './People.js';
import { AuditSettings, AUDIT_PAGE } from './Audit.js';
import { JOBS_PAGE } from './Jobs.js';

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
  /** Listed only for who may see failed jobs: the admin and the head on a personal login (the API's own rule). */
  needsJobsAccess?: boolean;
  spec?: CrudSpec<never>;
}

/**
 * Plant settings (D5): one list is the menu and the routes, so a new config (ticket 23) is added in one
 * place. `App.tsx` maps it to `/settings/<page>`, and the left menu and phone list read the same entries.
 */
export const PLANT_PAGES: readonly PlantPageSpec[] = [
  { page: 'machines', icon: Factory, key: 'plant.menu.machines' },
  { page: 'groups', icon: LayoutGrid, key: 'plant.menu.groups' },
  { page: 'shifts', icon: Clock, key: 'plant.menu.shifts' },
  { page: 'pm-plans', icon: CalendarCheck, key: 'pm.menu.plans' },
  { page: 'registers', icon: ShieldCheck, key: 'plant.menu.registers' },
  { page: 'roster', icon: CalendarClock, key: 'plant.menu.roster' },
  { page: 'ladder', icon: AlarmClock, key: 'plant.menu.ladder' },
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

/** The body of a page that has no v2 view yet (`screens/v2/settings/registry.ts`); the shell and the gate are v2's. */
export function Body({ page }: { page: PlantPage }) {
  if (page === 'people' || page === 'logins') return <PeopleSettings page={page} />;
  if (page === 'audit') return <AuditSettings />;
  const found = PLANT_PAGES.find((p) => p.page === page);
  if (!found || (!found.screen && !found.spec)) return null;
  if (found.screen) {
    const Screen = found.screen;
    return <Screen />;
  }
  return <CrudPage key={page} spec={found.spec as CrudSpec<CrudRow>} />;
}
