import i18n from '../../i18n/index.js';

/**
 * Every word of the navigation map preview (ticket 80v), in the `navmap` namespace, so it can be translated later.
 * Gujarati is out of scope for the preview: the `gu` bundle repeats the English.
 */
const en = {
  title: 'Navigation map',
  plant: 'Cosmos Engitech',
  preview: 'preview',
  previewNote: 'This page is a placeholder. Nothing here is real data.',

  'roles.label': 'Preview as',
  'roles.hint': 'Preview only: pick who is signed in to see which sections they get.',
  'role.head': 'Head',
  'role.plant-head': 'Plant head',
  'role.supervisor': 'Supervisor',
  'role.board': 'Board',
  'role.desk': 'Desk',
  'lands.analytics': 'After sign-in: the Analytics menu',
  'lands.desk':
    'After sign-in: the Desk screen (/desk), not this menu. Shown here as if they opened analytics.',

  'menu.label': 'Analytics menu',
  'menu.open': 'Menu',
  'menu.close': 'Close menu',
  'tabs.label': 'Screens in {{section}}',

  'period.label': 'Period',
  'period.ytd': 'This year so far',
  'period.custom': 'Custom range',
  'period.from': 'From',
  'period.to': 'To',

  'search.open': 'Search',
  'search.shortcut': 'Ctrl K',
  'search.title': 'Search sections and screens',
  'search.input': 'Type a section or screen name',
  'search.results': 'Results',
  'search.none': 'Nothing matches',
  'search.section': 'Section',
  'search.screen': 'Screen in {{section}}',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.toggle': 'Switch to {{mode}} theme',

  'section.today': 'Today',
  'section.machines': 'Machines',
  'section.problems': 'Problems',
  'section.reliability': 'Reliability & forecast',
  'section.people': 'People & money',
  'section.reports': 'Reports',
  'section.guide': 'Guide',

  'tab.dashboard': 'Dashboard',
  'tab.action-center': 'Action center',
  'tab.data-checklist': 'Data checklist',
  'tab.machine-list': 'Machine list',
  'tab.one-machine': 'One machine',
  'tab.registers': 'Registers',
  'tab.costliest': 'Costliest',
  'tab.pareto': 'Pareto',
  'tab.repeats': 'Repeats',
  'tab.fix-finder': 'Fix finder',
  'tab.problem-analysis': 'Problem analysis',
  'tab.mtbf-mttr': 'MTBF and MTTR',
  'tab.forecast-lab': 'Forecast lab',
  'tab.risk': 'Risk',
  'tab.team-focus': 'Team focus',
  'tab.manpower': 'Manpower',
  'tab.money': 'Money',
  'tab.monthly': 'Monthly report',
  'tab.annual': 'Annual report',
  'tab.pm-calendar': 'PM calendar',
  'tab.guide': 'How this app works',
};

export type NavMapKey = keyof typeof en;

i18n.addResourceBundle('en', 'navmap', en, true, true);
i18n.addResourceBundle('gu', 'navmap', en, true, true);
