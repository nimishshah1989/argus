import type { DataChecklistWords } from './model.js';

/** Every word the Data Checklist prints, in English for the gallery; the API adapter brings the reader's language. */
export const dataChecklistWords = (records: number, passing: number): DataChecklistWords => ({
  why: 'Why?',
  check: { why: 'Why it matters', owner: 'Owner' },
  allClear: 'Every check passes. The figures can be trusted.',
  passingTitle: 'Already trusted',
  passingSub: `${passing} checks pass`,
  ownerIs: 'Owner',
  records: {
    title: 'Records to fix',
    search: `Search ${records} records`,
    showing: '{from}–{to} of {total}',
    noResults: 'No record matches this search and filter.',
    open: 'Open',
    columns: { record: 'Record', area: 'Part of the data', owner: 'Owner', open: 'Open for' },
    all: 'All',
  },
});
