import type { TFunction } from 'i18next';
import { fill } from '../../../i18n/fill.js';
import type { FixFinderWords } from './model.js';

/** Every word Fix Finder prints beyond the engine's own text, from the catalogue in the reader's language. */
export function fixFinderWords(t: TFunction, cases: number): FixFinderWords {
  return {
    why: t('v2p.why'),
    headline: t('v2p.ff.headline'),
    noFigures: t('v2p.ff.noFigures'),
    lastSeen: t('v2p.ff.lastSeen'),
    source: t('v2p.ff.source'),
    cases: {
      title: t('v2p.ff.title'),
      search: fill(t('v2p.ff.search'), { n: cases }),
      showing: t('v2p.showing'),
      noResults: t('v2p.noResults'),
      open: t('v2p.open'),
      columns: {
        match: t('v2p.ff.match'),
        date: t('v2p.date'),
        machine: t('v2p.machine'),
        problem: t('v2p.problem'),
        done: t('v2p.ff.done'),
        down: t('v2p.ff.down'),
        doneBy: t('v2p.doneBy'),
      },
      filters: { all: t('v2p.all'), full: t('v2p.ff.full'), partial: t('v2p.ff.partial') },
      nobody: t('v2p.nobody'),
    },
  };
}
