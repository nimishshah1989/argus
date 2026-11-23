import type { TFunction } from 'i18next';
import type { LogWords } from './model.js';

/** Every word the Breakdown Log prints beyond the engine's own text, from the catalogue in the reader's language. */
export function logWords(t: TFunction): LogWords {
  return {
    why: t('v2p.why'),
    headline: t('analytics.log.rows', { rows: '{count}' }),
    recordsTo: t('analytics.asOf', { date: '{date}' }),
    whole: t('v2p.bl.whole'),
    intro: t('analytics.log.intro'),
    openTicket: t('analytics.log.openTicket', { srNo: '{srNo}' }),
    source: t('v2p.bl.source'),
    table: {
      title: t('v2p.bl.title'),
      search: t('v2p.bl.search'),
      showing: t('v2p.showing'),
      page: t('v2p.page'),
      loading: t('v2p.loading'),
      noResults: t('analytics.log.noMatches'),
      open: t('v2p.open'),
    },
    columns: {
      srNo: t('v2p.bl.srNo'),
      ticket: t('v2p.bl.ticket'),
      date: t('v2p.date'),
      shift: t('analytics.log.filter.shift'),
      machine: t('v2p.machine'),
      problem: t('v2p.problem'),
      doneBy: t('v2p.doneBy'),
      hours: t('v2p.bl.hours'),
      code: t('analytics.log.filter.code'),
    },
    filters: {
      date: t('analytics.log.filter.date'),
      month: t('v2p.bl.filter.month'),
      person: t('v2p.bl.filter.person'),
      shift: t('analytics.log.filter.shift'),
      machine: t('analytics.log.filter.machine'),
      code: t('analytics.log.filter.code'),
    },
    all: t('analytics.log.filter.all'),
    imported: t('v2p.bl.imported'),
    long: t('v2p.bl.long'),
    watch: t('v2p.bl.watch'),
    codeOption: t('v2p.bl.codeOption'),
    supportedBy: t('v2p.bl.supportedBy'),
    type: t('v2p.bl.type'),
    export: t('analytics.log.export'),
    exportError: t('analytics.log.exportError'),
    nobody: t('v2p.nobody'),
  };
}
