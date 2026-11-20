import { dashboardFixture } from '../dashboard/fixture.js';
import type { MachinePageWords, Tag } from './model.js';

/** Every word the Machine page prints, in English for the gallery; the API adapter brings the reader's language. */
export const TAGS = {
  open: { text: 'Open', tone: 'loss', icon: 'stop' },
  repeat: { text: 'Repeat', tone: 'risk', icon: 'alert' },
  waited: { text: 'Waited for a part', tone: 'neutral', icon: 'clock' },
  fixed: { text: 'Fixed', tone: 'gain', icon: 'check' },
  overdue: { text: 'Overdue', tone: 'loss', icon: 'alert' },
  inPm: { text: 'In PM now', tone: 'plan', icon: 'wrench' },
  onTime: { text: 'On schedule', tone: 'gain', icon: 'check' },
  allStocked: { text: 'All in stock', tone: 'gain', icon: 'check' },
} satisfies Record<string, Tag>;

export const machinePageWords: MachinePageWords = {
  why: 'Why?',
  states: dashboardFixture.words.machineDetail.states,
  nextTitle: 'What to do next',
  undo: 'Undo',
  pmTitle: 'Planned maintenance',
  sparesTitle: 'Spares',
  historySub: 'Last 12 months · press a row for the full story',
  history: {
    title: 'Breakdown history',
    search: 'Search breakdowns',
    showing: '{from}–{to} of {total}',
    noResults: 'No breakdown matches this search and filter.',
    open: 'Open',
    columns: {
      date: 'Date',
      problem: 'Problem',
      who: 'Fixed by',
      hours: 'Hours',
      result: 'Result',
    },
    filters: { all: 'All', last90: 'Last 90 days', repeat: 'Repeats', waited: 'Waited for a part' },
    detailTitle: '{date} · {problem}',
    close: 'Close',
  },
};
