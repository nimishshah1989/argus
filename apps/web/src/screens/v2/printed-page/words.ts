import type { TFunction } from 'i18next';
import type { PageWords } from './page-model.js';

/**
 * The words every printed-page screen shares, from the catalogue in the reader's language. `source` is the key of the
 * screen's own "Source: ... Records to {date}." line.
 */
export function pageWords(t: TFunction, source: string): PageWords {
  return {
    why: t('v2p.why'),
    all: t('v2p.all'),
    source: t(source),
    cell: t('v2r.cell'),
    chart: { sub: t('v2r.chart.sub'), aria: t('v2r.chart.aria') },
    pair: {
      title: t('v2r.pair.title'),
      fallback: [t('v2r.pair.jobs'), t('v2r.pair.hours')],
      count: t('v2r.pair.count'),
    },
    table: {
      title: '',
      search: t('v2r.search'),
      showing: t('v2p.showing'),
      noResults: t('v2p.noResults'),
      open: t('v2p.open'),
    },
  };
}
