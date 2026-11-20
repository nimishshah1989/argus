import type { TFunction } from 'i18next';
import type { ProblemAnalysisWords } from './model.js';

/** Every word Problem Analysis prints beyond the engine's own text, from the catalogue in the reader's language. */
export function problemAnalysisWords(t: TFunction): ProblemAnalysisWords {
  return {
    why: t('v2p.why'),
    all: t('v2p.all'),
    accept: t('analytics.problems.accept'),
    remove: t('v2p.pa.remove'),
    editorTitle: t('analytics.problems.editorTitle'),
    context: t('v2p.pa.context'),
    whatIf: t('v2p.pa.whatIf'),
    charts: {
      bar: { sub: t('v2p.pa.barSub'), aria: t('v2p.pa.barAria') },
      scatter: { sub: t('v2p.pa.scatterSub'), aria: t('v2p.pa.scatterAria') },
    },
    headline: t('v2p.pa.headline'),
    noFigures: t('v2p.pa.noFigures'),
    source: t('v2p.pa.source'),
    editorReadOnly: t('analytics.problems.editorReadOnly'),
    table: {
      title: '',
      search: t('v2p.pa.search'),
      showing: t('v2p.showing'),
      noResults: t('v2p.noResults'),
      open: t('v2p.open'),
    },
  };
}
