import type { NavMapKey } from './strings.js';

/** The shape of the analytics menu: six sections plus the Guide, each with the screens that become its tabs. */
export type RoleId = 'head' | 'plant-head' | 'supervisor' | 'board' | 'desk';
export interface Screen {
  id: string;
  label: NavMapKey;
}
export interface Section {
  id: string;
  label: NavMapKey;
  screens: Screen[];
}

const s = (id: string, label: NavMapKey): Screen => ({ id, label });

export const SECTIONS: Section[] = [
  {
    id: 'today',
    label: 'section.today',
    screens: [
      s('dashboard', 'tab.dashboard'),
      s('action-center', 'tab.action-center'),
      s('data-checklist', 'tab.data-checklist'),
    ],
  },
  {
    id: 'machines',
    label: 'section.machines',
    screens: [
      s('machine-list', 'tab.machine-list'),
      s('one-machine', 'tab.one-machine'),
      s('registers', 'tab.registers'),
    ],
  },
  {
    id: 'problems',
    label: 'section.problems',
    screens: [
      s('costliest', 'tab.costliest'),
      s('pareto', 'tab.pareto'),
      s('repeats', 'tab.repeats'),
      s('fix-finder', 'tab.fix-finder'),
      s('problem-analysis', 'tab.problem-analysis'),
    ],
  },
  {
    id: 'reliability',
    label: 'section.reliability',
    screens: [
      s('mtbf-mttr', 'tab.mtbf-mttr'),
      s('forecast-lab', 'tab.forecast-lab'),
      s('risk', 'tab.risk'),
    ],
  },
  {
    id: 'people',
    label: 'section.people',
    screens: [
      s('team-focus', 'tab.team-focus'),
      s('manpower', 'tab.manpower'),
      s('money', 'tab.money'),
    ],
  },
  {
    id: 'reports',
    label: 'section.reports',
    screens: [
      s('monthly', 'tab.monthly'),
      s('annual', 'tab.annual'),
      s('pm-calendar', 'tab.pm-calendar'),
    ],
  },
  { id: 'guide', label: 'section.guide', screens: [s('guide', 'tab.guide')] },
];

export const ROLES: { id: RoleId; label: NavMapKey; lands: 'analytics' | 'desk' }[] = [
  { id: 'head', label: 'role.head', lands: 'analytics' },
  { id: 'plant-head', label: 'role.plant-head', lands: 'analytics' },
  { id: 'supervisor', label: 'role.supervisor', lands: 'analytics' },
  { id: 'board', label: 'role.board', lands: 'analytics' },
  { id: 'desk', label: 'role.desk', lands: 'desk' },
];

/** Which sections each role sees. A preview assumption for the product owner to correct, not a stored rule. */
const SEES: Record<RoleId, string[]> = {
  head: ['today', 'machines', 'problems', 'reliability', 'people', 'reports', 'guide'],
  'plant-head': ['today', 'machines', 'problems', 'reliability', 'people', 'reports', 'guide'],
  supervisor: ['today', 'machines', 'problems', 'people', 'guide'],
  board: ['today', 'reliability', 'people', 'reports', 'guide'],
  desk: ['today', 'machines', 'problems', 'guide'],
};

export const sectionsFor = (role: RoleId): Section[] =>
  SECTIONS.filter((x) => SEES[role].includes(x.id));

export const isRole = (v: string | null): v is RoleId => ROLES.some((r) => r.id === v);
