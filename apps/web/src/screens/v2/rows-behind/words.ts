import type { RowsBehindAdapterWords } from '../../../ui/v2/domain/rows-behind-adapter.js';
import type { RowsBehindWords } from '../../../ui/v2/domain/rows-behind.js';
import type { Translate } from '../figures/read.js';

/** The words the rows-behind panel and its adapter print, from the catalogue, in the reader's language. */
export const rowsWords = (t: Translate) => ({ adapter: adapterWords(t), table: tableWords(t) });

function adapterWords(t: Translate): RowsBehindAdapterWords {
  const col = (name: string) => t(`v2m.rows.col.${name}`);
  return {
    locale: 'en-IN',
    counted: {
      machine: t('v2m.rows.machines'),
      ticket: t('v2m.rows.tickets'),
      move: t('v2m.rows.moves'),
    },
    source: t('v2m.rows.source'),
    none: t('v2m.none'),
    cell: t('v2m.reg.cell'),
    hours: t('v2m.rows.hours'),
    columns: {
      machine: col('machine'),
      cell: col('cell'),
      type: col('type'),
      makeModel: col('makeModel'),
      year: col('year'),
      status: col('status'),
      ticket: col('ticket'),
      reported: col('reported'),
      downtime: col('downtime'),
      work: col('work'),
      from: col('from'),
      to: col('to'),
      movedOn: col('movedOn'),
      location: col('location'),
      connectedKva: col('connectedKva'),
      runningKva: col('runningKva'),
    },
    ticketStatus: {
      open: t('v2m.rows.ticket.open'),
      working: t('v2m.rows.ticket.working'),
      waiting: t('v2m.rows.ticket.waiting'),
      closed: t('v2m.rows.ticket.closed'),
      cancelled: t('v2m.rows.ticket.cancelled'),
    },
    ticketKind: {
      stopped: t('v2m.rows.kind.stopped'),
      support: t('v2m.rows.kind.support'),
      general: t('v2m.rows.kind.general'),
    },
    machineStatus: {
      active: t('v2m.rows.machine.active'),
      idle: t('v2m.rows.machine.idle'),
      scrapped: t('v2m.rows.machine.scrapped'),
    },
  };
}

function tableWords(t: Translate): RowsBehindWords {
  return {
    title: t('v2m.rows.title'),
    search: t('v2m.rows.search'),
    showing: t('v2m.showing'),
    noResults: t('v2m.rows.noResults'),
    open: t('v2m.open'),
    all: t('v2m.all'),
    empty: t('v2m.rows.empty'),
  };
}
