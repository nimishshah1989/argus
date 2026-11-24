import type { TFunction } from 'i18next';
import type { TeamFocusWords } from './model.js';

const peopleWords = (t: TFunction, count: number): TeamFocusWords['people'] => ({
  title: t('v2tf.people.title'),
  search: t('v2tf.people.search', { count }),
  showing: t('v2tf.showing'),
  noResults: t('v2tf.people.noResults'),
  open: t('v2tf.open'),
  columns: {
    person: t('v2tf.people.col.person'),
    open: t('v2tf.people.col.open'),
    hours: t('v2tf.people.col.hours'),
    done: t('v2tf.people.col.done'),
    load: t('v2tf.people.col.load'),
  },
  filters: {
    all: t('v2tf.people.filter.all'),
    over: t('v2tf.people.filter.over'),
    room: t('v2tf.people.filter.room'),
  },
});

const actionWords = (t: TFunction, count: number): TeamFocusWords['actions'] => ({
  title: t('v2tf.actions.title'),
  search: t('v2tf.actions.search', { count }),
  showing: t('v2tf.showing'),
  noResults: t('v2tf.actions.noResults'),
  open: t('v2tf.open'),
  columns: {
    action: t('v2tf.actions.col.action'),
    owner: t('v2tf.actions.col.owner'),
    status: t('v2tf.actions.col.status'),
    hours: t('v2tf.actions.col.hours'),
  },
  filters: {
    all: t('v2tf.actions.filter.all'),
    noOwner: t('v2tf.actions.filter.noOwner'),
    doing: t('v2tf.actions.filter.doing'),
    done: t('v2tf.actions.filter.done'),
  },
  noOwner: t('v2tf.actions.noOwner'),
});

/** Every word Team Focus prints, from the catalogue; the search boxes count the people and actions listed. */
export function teamFocusWords(
  t: TFunction,
  actionCount: number,
  peopleCount: number,
): TeamFocusWords {
  return {
    why: t('v2tf.why'),
    allOwned: t('v2tf.allOwned'),
    decisions: {
      why: t('v2tf.why'),
      title: t('v2tf.decisions.title'),
      waiting: t('v2tf.decisions.waiting'),
      done: t('v2tf.decisions.done'),
      perMonth: t('v2tf.perMonth'),
      stripCaption: t('v2tf.stripCaption'),
    },
    decisionDetail: {
      worth: t('v2tf.worth'),
      perMonth: t('v2tf.perMonth'),
      perYear: t('v2tf.perYear'),
      last90: t('v2tf.last90'),
      stripCaption: t('v2tf.stripCaption'),
      why: t('v2tf.why'),
    },
    peopleTitle: t('v2tf.people.title'),
    people: peopleWords(t, peopleCount),
    actions: actionWords(t, actionCount),
  };
}
