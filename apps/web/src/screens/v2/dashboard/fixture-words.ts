import type { DemoWords } from './fixture-model.js';

/** Every word the Dashboard prints, in English for the gallery; the API adapter brings the reader's language. */
const STATES = {
  run: 'Running',
  risk: 'At risk',
  down: 'Broken down',
  pm: 'In PM',
  idle: 'Idle or out',
};
const FILTERS = { all: 'All', down: 'Down', risk: 'At risk', pm: 'In PM' };

export const dashboardWords: DemoWords = {
  why: 'Why?',
  whyThese: 'Why these 3?',
  decisions: {
    why: 'Why?',
    title: 'Decide today',
    waiting: '{n} waiting · biggest first',
    done: '{n} of {total} decided',
    perMonth: 'a month',
    stripCaption: 'Breakdowns, last 90 days',
  },
  plant: {
    title: 'The plant right now',
    mapLabel: 'Machines by cell',
    filterLabel: 'Show machines',
    filters: FILTERS,
    states: STATES,
    hint: 'Tap any square for that machine in full.',
    cellCounts: { down: '{n} down', risk: '{n} at risk', pm: '{n} in PM', idle: '{n} idle' },
    cellRunning: 'all running',
  },
  targetTitle: 'Against target',
  legend: { actual: 'This month', target: 'Target', last: 'Last month', zone: 'Good zone' },
  paretoTitle: 'Where the hours go',
  addFocus: 'Add to Team Focus',
  seeFixes: 'See the fixes',
  decisionDetail: {
    worth: 'What it is worth',
    perMonth: 'A month',
    perYear: 'A year',
    last90: 'Last 90 days',
    stripCaption: 'Breakdowns, three days a bar',
    why: 'The full story',
  },
  machineDetail: {
    states: STATES,
    figures: 'This month',
    hours: 'Breakdown hours',
    stops: 'Breakdowns, 90 days',
    trend: 'Breakdown hours a week, last 12 weeks',
    why: 'Why it is in this state',
  },
  machines: {
    title: 'Machines',
    search: 'Search 126 machines',
    showing: '{from}–{to} of {total}',
    noResults: 'No machine matches this search and filter.',
    open: 'Open',
    columns: {
      machine: 'Machine',
      status: 'Status',
      hours: 'Hours this month',
      stops: 'Breakdowns, 90 days',
      trend: '12 weeks',
    },
    states: STATES,
    filters: FILTERS,
  },
};
