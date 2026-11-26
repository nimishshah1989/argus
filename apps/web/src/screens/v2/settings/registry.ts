import type { ComponentType } from 'react';
import type { PlantPage } from './pages.js';
import { CompanyView } from './CompanyView.js';
import { TranslationsView } from './TranslationsView.js';
import { JobsView } from './JobsView.js';
import { AuditView } from '../settings-audit/View.js';
import { GlossaryView, ListsView, ProfileView } from '../settings-lists/View.js';
import { LoginsView, PeopleView } from '../settings-people/View.js';
import { GroupsView, MachinesView, ShiftsView } from '../settings-plant/View.js';
import { LadderView, PmPlansView, RegistersView, RosterView } from '../settings-upkeep/View.js';

/**
 * The v2 view of each plant settings page (ADR 0046 d3). Each
 * ticket adds its lines under its own comment only, so two tickets never edit the same line.
 */
export const V2_VIEWS: Record<Exclude<PlantPage, 'home'>, ComponentType> = {
  // S26-1
  jobs: JobsView,
  // S26-2
  machines: MachinesView,
  groups: GroupsView,
  shifts: ShiftsView,
  // S26-3
  'pm-plans': PmPlansView,
  registers: RegistersView,
  roster: RosterView,
  ladder: LadderView,
  // S26-4
  people: PeopleView,
  logins: LoginsView,
  // S26-5
  audit: AuditView,
  // S26-6
  lists: ListsView,
  glossary: GlossaryView,
  'analytics-profile': ProfileView,
  // S26-7
  company: CompanyView,
  translations: TranslationsView,
};
