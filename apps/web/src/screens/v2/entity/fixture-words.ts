import type { CellDetailWords } from '../../../ui/v2/domain/cell-detail.js';
import type { PersonDetailWords } from '../../../ui/v2/domain/person-detail.js';

/** Every word the cell and person drawers print, in English for the gallery; the API adapter brings the reader's language. */
export const cellWords: CellDetailWords = {
  now: 'Right now',
  figures: 'This month',
  hours: 'Breakdown hours',
  worst: 'Machines that cost the most hours',
};

export const personWords: PersonDetailWords = {
  now: 'On now',
  free: 'Nothing assigned right now.',
  month: 'This month',
  jobs: 'Jobs closed',
  hours: 'Hours worked',
};
