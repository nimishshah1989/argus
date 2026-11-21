import type { FiguresReply } from '@uptimo/shared/analytics';
import { fill } from '../../../i18n/fill.js';
import { focusActions, type FocusAction } from '../../analytics/team-focus-actions.js';
import type { Translate } from '../figures/read.js';
import type { BannerModel } from './model.js';

/** Where Team Focus lives: still the Today page's own screen. */
export const TEAM_FOCUS_PATH = '/analytics/today?screen=team-focus';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** The month the plan is for, from the forecast actions' own key (`fc|<machine>|2026-12`); null when there is none. */
function planMonth(actions: readonly FocusAction[]): string | null {
  for (const action of actions) {
    const found = /\|(\d{4})-(\d{2})$/.exec(action.key);
    const name = found ? MONTHS[Number(found[2]) - 1] : undefined;
    if (found && name) return `${name} ${found[1]}`;
  }
  return null;
}

/** The lanes Bhavin's short list draws from, in his order: the record's own gaps (lane E) are never "top". */
const TOP_LANES = ['A', 'B', 'C', 'F', 'D'];

/**
 * Bhavin's Team Focus banner: how many of the month's actions are still open (open or in progress), the month, and the
 * top one, the open action with the most hours at stake. Read from the engine's `team-focus` figure; nothing when the
 * figure is not computed or no action is open. A saved status is not stored yet, so every action reads as open.
 */
export function teamFocusOf(reply: FiguresReply, t: Translate): BannerModel | null {
  const figure = reply.figures.find((f) => f.key === 'team-focus');
  if (figure?.status !== 'ready') return null;
  const actions = focusActions(figure.value);
  const open = actions.filter((a) => a.status === 'open' || a.status === 'prog');
  const top = TOP_LANES.flatMap((lane) => open.filter((a) => a.lane === lane)).sort(
    (a, b) => b.stake - a.stake,
  )[0];
  if (open.length === 0) return null;
  const month = planMonth(actions);
  const one = open.length === 1 ? '.one' : '';
  const lead = fill(t(`v2d.tf.text${month ? '.month' : ''}${one}`), {
    n: open.length,
    month: month ?? '',
  });
  return {
    title: t('v2d.tf.title'),
    text: top ? `${lead} ${fill(t('v2d.tf.top'), { title: top.title })}` : lead,
    open: t('v2d.tf.open'),
    href: TEAM_FOCUS_PATH,
    tone: 'plan',
    tag: null,
  };
}
