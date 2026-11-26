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
  key: Key;
  /** Listed only for who may see failed jobs: the admin and the head on a personal login (the API's own rule). */
  needsJobsAccess?: boolean;
}

/**
 * Plant settings (D5): one list is the menu and the routes, so a new page is added in one place. `App.tsx` maps it
 * to `/settings/<page>`, the menu and the phone list read the same entries, and `registry.ts` draws each page.
 */
export const PLANT_PAGES: readonly PlantPageSpec[] = [
  { page: 'machines', key: 'plant.menu.machines' },
  { page: 'groups', key: 'plant.menu.groups' },
  { page: 'shifts', key: 'plant.menu.shifts' },
  { page: 'pm-plans', key: 'pm.menu.plans' },
  { page: 'registers', key: 'plant.menu.registers' },
  { page: 'roster', key: 'plant.menu.roster' },
  { page: 'ladder', key: 'plant.menu.ladder' },
  { page: 'people', key: 'people.menu.people' },
  { page: 'logins', key: 'people.menu.logins' },
  { page: 'audit', key: 'audit.menu' },
  { page: 'jobs', key: 'jobs.menu', needsJobsAccess: true },
  { page: 'lists', key: 'lists.menu.lists' },
  { page: 'glossary', key: 'lists.menu.glossary' },
  { page: 'company', key: 'company.menu.company' },
  { page: 'analytics-profile', key: 'analytics.profile.menu' },
  { page: 'translations', key: 'plant.menu.translations' },
];
