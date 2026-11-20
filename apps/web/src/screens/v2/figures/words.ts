import { fill } from '../../../i18n/fill.js';
import type { EngineTableWords } from '../../../ui/v2/domain/engine-table.js';
import type { Translate } from './read.js';

/** The words every figure screen of the Machines section shares, from the catalogue. */
export type CommonWords = {
  why: string;
  all: string;
  /** `{n}` rows. */
  search: string;
  showing: string;
  noResults: string;
  open: string;
  /** `{date}`. */
  source: string;
  none: string;
};

export const commonWords = (t: Translate): CommonWords => ({
  why: t('v2m.why'),
  all: t('v2m.all'),
  search: t('v2m.search'),
  showing: t('v2m.showing'),
  noResults: t('v2m.noResults'),
  open: t('v2m.open'),
  source: t('v2m.source'),
  none: t('v2m.none'),
});

/** One table's words: its title, its search prompt over `n` rows, and the shared pager line. */
export const tableWords = (c: CommonWords, title: string, n: number): EngineTableWords => ({
  title,
  search: fill(c.search, { n }),
  showing: c.showing,
  noResults: c.noResults,
  open: c.open,
  all: c.all,
});
