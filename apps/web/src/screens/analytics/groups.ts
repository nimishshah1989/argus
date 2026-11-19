import { DRILL_TYPES, type DrillType } from '@uptimo/shared/analytics';
import type { MessageKey } from '@uptimo/shared/i18n';
import {
  BookOpen,
  CalendarCheck,
  Clock,
  Factory,
  FileCheck,
  FlaskConical,
  Fuel,
  Wrench,
  type IconComponent,
} from '../../ui/icon.js';

/**
 * The analytics face menu (ticket 37b, slice 9): the eight locked groups and which registry screen belongs
 * to each. One route per group; a group page renders every screen of its group and that screen's figures.
 * `groups.test.ts` fails when a registered figure is in no group, so 38 to 45 cannot add one that is
 * unreachable, and when a label is missing from either catalogue.
 */

export type GroupId =
  'today' | 'machines' | 'breakdowns' | 'forecast-scorecard' | 'pm' | 'cost' | 'reports' | 'guide';

export interface AnalyticsGroup {
  id: GroupId;
  labelKey: MessageKey;
  icon: IconComponent;
  /** The registry screens this group shows, in menu order. PM is empty until M4b registers it. */
  screens: readonly string[];
}

export const ANALYTICS_GROUPS: readonly AnalyticsGroup[] = [
  {
    id: 'today',
    labelKey: 'analytics.group.today',
    icon: Clock,
    screens: ['dashboard', 'action-center', 'team-focus', 'data-checklist'],
  },
  {
    id: 'machines',
    labelKey: 'analytics.group.machines',
    icon: Factory,
    screens: [
      'registers',
      'cell-change-log',
      'a7-footprint',
      'a8-age',
      'machine-page',
      'compare',
      'a5-energy',
    ],
  },
  {
    id: 'breakdowns',
    labelKey: 'analytics.group.breakdowns',
    icon: Wrench,
    screens: [
      'breakdown-log',
      'a1-bd-pm',
      'a2-category-cell',
      'a3-mttr-mtbf',
      'a4-manpower',
      'a6-why-why',
      'a10-problems',
      'fix-finder',
      'shift-kpis',
    ],
  },
  {
    id: 'forecast-scorecard',
    labelKey: 'analytics.group.forecast-scorecard',
    icon: FlaskConical,
    screens: ['a9-bottleneck-forecast', 'forecast-lab'],
  },
  { id: 'pm', labelKey: 'analytics.group.pm', icon: CalendarCheck, screens: [] },
  { id: 'cost', labelKey: 'analytics.group.cost', icon: Fuel, screens: ['money-matters'] },
  {
    id: 'reports',
    labelKey: 'analytics.group.reports',
    icon: FileCheck,
    screens: ['monthly-report', 'annual-report'],
  },
  { id: 'guide', labelKey: 'analytics.group.guide', icon: BookOpen, screens: [] },
];

export const GROUP_LABELS: Record<GroupId, MessageKey> = {
  today: 'analytics.group.today',
  machines: 'analytics.group.machines',
  breakdowns: 'analytics.group.breakdowns',
  'forecast-scorecard': 'analytics.group.forecast-scorecard',
  pm: 'analytics.group.pm',
  cost: 'analytics.group.cost',
  reports: 'analytics.group.reports',
  guide: 'analytics.group.guide',
};

/** The registry screen id to its menu heading. */
export const SCREEN_LABELS: Record<string, MessageKey> = {
  dashboard: 'analytics.screen.dashboard',
  'data-checklist': 'analytics.screen.data-checklist',
  registers: 'analytics.screen.registers',
  'cell-change-log': 'analytics.screen.cell-change-log',
  'a7-footprint': 'analytics.screen.a7-footprint',
  'a8-age': 'analytics.screen.a8-age',
  'machine-page': 'analytics.screen.machine-page',
  'breakdown-log': 'analytics.screen.breakdown-log',
  'a1-bd-pm': 'analytics.screen.a1-bd-pm',
  'a2-category-cell': 'analytics.screen.a2-category-cell',
  'a3-mttr-mtbf': 'analytics.screen.a3-mttr-mtbf',
  'a4-manpower': 'analytics.screen.a4-manpower',
  'a5-energy': 'analytics.screen.a5-energy',
  'a6-why-why': 'analytics.screen.a6-why-why',
  'a10-problems': 'analytics.screen.a10-problems',
  'a9-bottleneck-forecast': 'analytics.screen.a9-bottleneck-forecast',
  'forecast-lab': 'analytics.screen.forecast-lab',
  compare: 'analytics.screen.compare',
  'team-focus': 'analytics.screen.team-focus',
  'money-matters': 'analytics.screen.money-matters',
  'fix-finder': 'analytics.screen.fix-finder',
  'action-center': 'analytics.screen.action-center',
  'monthly-report': 'analytics.screen.monthly-report',
  'annual-report': 'analytics.screen.annual-report',
  'shift-kpis': 'analytics.screen.shift-kpis',
};

/** The registry figure key to the label a tile and the Guide print. */
export const FIGURE_LABELS: Record<string, MessageKey> = {
  'dashboard.total-machines': 'analytics.figure.dashboard.total-machines',
  'dashboard.utilities': 'analytics.figure.dashboard.utilities',
  'dashboard.dg-sets': 'analytics.figure.dashboard.dg-sets',
  'dashboard.cnc-machines': 'analytics.figure.dashboard.cnc-machines',
  'dashboard.conventional-machines': 'analytics.figure.dashboard.conventional-machines',
  'dashboard.process-machines': 'analytics.figure.dashboard.process-machines',
  'dashboard.total-breakdowns': 'analytics.figure.dashboard.total-breakdowns',
  'dashboard.total-downtime-hours': 'analytics.figure.dashboard.total-downtime-hours',
  'dashboard.pm-hours': 'analytics.figure.dashboard.pm-hours',
  'dashboard.no-downtime-hours': 'analytics.figure.dashboard.no-downtime-hours',
  'dashboard.breakdown-free': 'analytics.figure.dashboard.breakdown-free',
  'dashboard.costliest-problems': 'analytics.figure.dashboard.costliest-problems',
  'dashboard.bubble-chart': 'analytics.figure.dashboard.bubble-chart',
  'dashboard.expansion-timeline': 'analytics.figure.dashboard.expansion-timeline',
  'dashboard.fleet-availability': 'analytics.figure.dashboard.fleet-availability',
  'dashboard.plant-bd-pct': 'analytics.figure.dashboard.plant-bd-pct',
  'dashboard.avg-complaints-per-day': 'analytics.figure.dashboard.avg-complaints-per-day',
  'dashboard.avg-bd-hours-per-day': 'analytics.figure.dashboard.avg-bd-hours-per-day',
  'dashboard.avg-bd-hours-per-machine': 'analytics.figure.dashboard.avg-bd-hours-per-machine',
  'data-checklist': 'analytics.figure.data-checklist',
  registers: 'analytics.figure.registers',
  'cell-change-log': 'analytics.figure.cell-change-log',
  'a7-footprint': 'analytics.figure.a7-footprint',
  'a8-age': 'analytics.figure.a8-age',
  'machine-page': 'analytics.figure.machine-page',
  'breakdown-log': 'analytics.figure.breakdown-log',
  'a1-bd-pm': 'analytics.figure.a1-bd-pm',
  'a2-category-cell': 'analytics.figure.a2-category-cell',
  'a3-mttr-mtbf': 'analytics.figure.a3-mttr-mtbf',
  'a4-manpower': 'analytics.figure.a4-manpower',
  'a5-energy': 'analytics.figure.a5-energy',
  'a6-why-why': 'analytics.figure.a6-why-why',
  'a10-problems': 'analytics.figure.a10-problems',
  'a9-bottleneck-forecast': 'analytics.figure.a9-bottleneck-forecast',
  'forecast-lab': 'analytics.figure.forecast-lab',
  compare: 'analytics.figure.compare',
  'compare.spares-cost': 'analytics.figure.compare.spares-cost',
  'team-focus': 'analytics.figure.team-focus',
  'team-focus.cost': 'analytics.figure.team-focus.cost',
  'money-matters': 'analytics.figure.money-matters',
  'fix-finder': 'analytics.figure.fix-finder',
  'action-center': 'analytics.figure.action-center',
  'action-center.spares-spend': 'analytics.figure.action-center.spares-spend',
  'monthly-report': 'analytics.figure.monthly-report',
  'annual-report': 'analytics.figure.annual-report',
  'shift-kpis.compare': 'analytics.figure.shift-kpis.compare',
  'shift-kpis.shift-split': 'analytics.figure.shift-kpis.shift-split',
  'shift-kpis.backlog': 'analytics.figure.shift-kpis.backlog',
  'shift-kpis.breakdown-map': 'analytics.figure.shift-kpis.breakdown-map',
  reliability: 'analytics.figure.reliability',
};

/**
 * The figures printed in hours (the engine rounds them to the key's decimals). A tile prints the value with
 * at least one decimal, so a whole number of hours still reads as hours; a count prints as a count. Pure: the
 * tile and the e2e's expected text both read this rule from here.
 */
export const HOUR_FIGURES: ReadonlySet<string> = new Set([
  'dashboard.total-downtime-hours',
  'dashboard.pm-hours',
  'dashboard.no-downtime-hours',
  'dashboard.avg-bd-hours-per-day',
  'dashboard.avg-bd-hours-per-machine',
]);

/** The unit a ready figure prints after its value; null for a count, a percentage or an object. */
export function unitOf(key: string): MessageKey | null {
  return HOUR_FIGURES.has(key) ? 'analytics.unit.hours' : null;
}

/** The group a screen belongs to; null only for a registry screen the menu has not placed yet. */
export function groupOfScreen(screen: string): AnalyticsGroup | null {
  return ANALYTICS_GROUPS.find((group) => group.screens.includes(screen)) ?? null;
}

export function groupFor(id: string | undefined): AnalyticsGroup | undefined {
  return ANALYTICS_GROUPS.find((group) => group.id === id);
}

/** The Machines group's route; one machine's page hangs under it (`/analytics/machines/:id`). */
export const MACHINES_PATH = '/analytics/machines';

/** The data checklist's own route, under the Today group (packet 38.3). */
export const CHECKLIST_PATH = '/analytics/today/checklist';

/** The Action Center screen's own route, under the Today group (packet 44d). */
export const ACTION_CENTER_PATH = '/analytics/today/action-center';

/** The drill link a tile carries: the group page, with the type and the rows in the query. */
export function drillHref(group: GroupId, type: DrillType, ids: readonly string[]): string {
  return `/analytics/${group}?drill=${encodeURIComponent(`${type}:${ids.join(',')}`)}`;
}

/** `type:id,id` from the query; null for no drill, an unknown type or no rows. */
export function parseDrill(raw: string | null): { type: DrillType; ids: string[] } | null {
  if (!raw) return null;
  const colon = raw.indexOf(':');
  if (colon < 1) return null;
  const type = raw.slice(0, colon);
  if (!(DRILL_TYPES as readonly string[]).includes(type)) return null;
  const ids = raw
    .slice(colon + 1)
    .split(',')
    .filter((id) => id.trim() !== '');
  return ids.length === 0 ? null : { type: type as DrillType, ids };
}
