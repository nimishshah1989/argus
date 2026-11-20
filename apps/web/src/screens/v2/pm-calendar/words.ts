import type { TFunction } from 'i18next';
import { fill } from '../../../i18n/fill.js';
import type { PmCalendarWords } from './model.js';

const tableWords = (t: TFunction, title: string, search: string) => ({
  title,
  search,
  showing: t('v2p.showing'),
  noResults: t('v2p.noResults'),
  open: t('v2p.open'),
});

function jobsWords(t: TFunction, n: number): PmCalendarWords['jobs'] {
  return {
    ...tableWords(t, t('pm.calendar.jobs.title'), fill(t('v2p.pm.jobs.search'), { n })),
    sub: t('pm.calendar.jobs.hint'),
    columns: {
      machine: t('v2p.machine'),
      job: t('v2p.pm.col.job'),
      planned: t('v2p.pm.col.planned'),
      due: t('v2p.pm.col.due'),
      tolerance: t('v2p.pm.col.tolerance'),
      status: t('v2p.pm.col.status'),
      action: t('v2p.pm.col.action'),
    },
    filters: {
      all: t('v2p.all'),
      crowded: t('v2p.pm.jobs.crowded'),
      open: t('pm.calendar.legend.open'),
      planned: t('pm.calendar.legend.planned'),
    },
    moveDate: t('pm.calendar.moveDate'),
  };
}

const moveWords = (t: TFunction): PmCalendarWords['move'] => ({
  title: t('v2p.pm.move.title'),
  now: t('v2p.pm.move.now'),
  label: t('v2p.pm.move.label'),
  confirm: t('v2p.pm.move.confirm'),
  cancel: t('v2p.pm.move.cancel'),
  saving: t('v2p.pm.move.saving'),
  needDate: t('v2p.pm.move.needDate'),
  moved: t('v2p.pm.move.moved'),
  refused: t('v2p.pm.move.refused'),
  offline: t('v2p.pm.move.offline'),
});

/**
 * Every word the PM calendar prints beyond the engine's own text, from the catalogue in the reader's language. The
 * calendar's long-standing words (legend, spread, move) are v1's `pm.*` keys, kept so a word is said one way.
 */
export function pmCalendarWords(
  t: TFunction,
  counts: { jobs: number; spread: number },
): PmCalendarWords {
  return {
    why: t('v2p.why'),
    calendar: {
      title: t('pm.screen.calendar'),
      loading: t('pm.calendar.loading'),
      empty: t('pm.calendar.empty'),
      today: t('pm.calendar.today'),
    },
    legend: {
      label: t('pm.calendar.legend'),
      planned: t('pm.calendar.legend.planned'),
      open: t('pm.calendar.legend.open'),
      crowded: t('pm.calendar.legend.crowded'),
    },
    judged: {
      title: t('v2p.pm.judged.title'),
      sub: t('v2p.pm.judged.sub'),
      none: t('pm.compliance.empty'),
      noFigure: t('pm.calendar.noFigure'),
    },
    spread: {
      ...tableWords(
        t,
        t('pm.calendar.spread.title'),
        fill(t('v2p.pm.spread.search'), { n: counts.spread }),
      ),
      columns: {
        machine: t('v2p.machine'),
        planned: t('v2p.pm.col.planned'),
        free: t('v2p.pm.col.free'),
        action: t('v2p.pm.col.action'),
      },
      noFreeDay: t('pm.calendar.noFreeDay'),
    },
    jobs: jobsWords(t, counts.jobs),
    move: moveWords(t),
  };
}
