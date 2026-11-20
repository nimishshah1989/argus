import { dashboardWords } from '../fixtures/words.js';
import type { TeamFocusWords } from './model.js';

/** Every word Team Focus prints, in English for the gallery; the API adapter brings the reader's language. */
export const teamFocusWords = (actionCount: number, peopleCount: number): TeamFocusWords => ({
  why: 'Why?',
  allOwned: 'Every open action has an owner.',
  decisions: {
    why: 'Why?',
    title: 'Needs an owner',
    waiting: '{n} waiting · biggest first',
    done: '{n} of {total} assigned',
    perMonth: 'a month',
    stripCaption: 'Breakdowns, last 90 days',
  },
  decisionDetail: {
    ...dashboardWords.decisionDetail,
    worth: 'What it wins back',
  },
  peopleTitle: 'Who is carrying what',
  people: {
    title: 'Who is carrying what',
    search: `Search ${peopleCount} people`,
    showing: '{from}–{to} of {total}',
    noResults: 'No one matches this filter.',
    open: 'Open',
    columns: {
      person: 'Person',
      open: 'Open actions',
      hours: 'Hours a month',
      done: 'Closed',
      load: 'Load',
    },
    filters: { all: 'All', over: 'Overloaded', room: 'Has room' },
  },
  actions: {
    title: 'Every action this month',
    search: `Search ${actionCount} actions`,
    showing: '{from}–{to} of {total}',
    noResults: 'No action matches this filter.',
    open: 'Open',
    columns: { action: 'Action', owner: 'Owner', status: 'Status', hours: 'Hours a month' },
    filters: { all: 'All', noOwner: 'No owner', doing: 'In progress', done: 'Done' },
    noOwner: 'Nobody yet',
  },
});
