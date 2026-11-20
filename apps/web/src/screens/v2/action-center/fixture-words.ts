import { dashboardWords } from '../dashboard/fixture-words.js';
import type { ActionCenterWords } from './model.js';

/** Every word the Action Center prints, in English for the gallery; the API adapter brings the reader's language. */
export const actionCenterWords = (unowned: number, watching: number): ActionCenterWords => ({
  why: 'Why?',
  whyThese: 'Why these?',
  decisions: dashboardWords.decisions,
  decisionDetail: dashboardWords.decisionDetail,
  ownersTitle: 'Who owns what',
  assign: `Assign the ${unowned} unowned`,
  settledTitle: 'Not waiting',
  settledLabel: 'Show decisions',
  tabs: { parked: 'Parked ({n})', settled: 'Settled ({n})' },
  settledEmpty: 'Nothing here yet.',
  watch: {
    title: 'Machines that keep coming up',
    search: `Search ${watching} machines`,
    showing: '{from}–{to} of {total}',
    noResults: 'No machine matches this search and filter.',
    open: 'Open',
    columns: { machine: 'Machine', score: 'Score', nudges: 'Open nudges', next: 'Next step' },
    priority: { high: '{n} high', medium: '{n} medium', low: '{n} low' },
    filters: { all: 'All', high: 'Has a high nudge', medium: 'Has a medium nudge' },
  },
});
