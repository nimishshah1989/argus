import type { ComponentType } from 'react';
import type { PlantPage } from '../../settings/Plant.js';
import { JobsView } from './JobsView.js';
import { AuditView } from '../settings-audit/View.js';
import { LoginsView, PeopleView } from '../settings-people/View.js';
import { GroupsView, MachinesView, ShiftsView } from '../settings-plant/View.js';
import { LadderView, PmPlansView, RegistersView, RosterView } from '../settings-upkeep/View.js';

/**
 * The v2 view of each plant settings page (ADR 0046 d3). A page not listed here still draws v1's body. Each
 * ticket adds its lines under its own comment only, so two tickets never edit the same line.
 */
export const V2_VIEWS: Partial<Record<PlantPage, ComponentType>> = {
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
  // S26-7
};
