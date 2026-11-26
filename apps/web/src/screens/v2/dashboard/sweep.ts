import type { FiguresReply } from '@uptimo/shared/analytics';
import type { Strip } from '../../../ui/v2/action-strip.js';
import type { RankedRow } from '../../../ui/v2/ranked-bars.js';
import { fill } from '../../../i18n/fill.js';
import { bannerOf } from '../../analytics/action-center.js';
import { ACTION_CENTER_PATH } from '../../analytics/groups.js';
import { focusActions } from '../../analytics/team-focus-actions.js';
import type { Translate } from '../figures/read.js';
import { TEAM_FOCUS_PATH } from './banners.js';
import type { CostliestModel, DashboardFacts } from './model.js';

/** Sweep 706, batch A (ADR 0041, 0043): the pure helpers the Dashboard's kit pieces are fed from. */

/**
 * The Dashboard's action strips (ADR 0036 R2, ADR 0043), always exactly these three, in this order; strips with a
 * count of 0 are kept here (the kit's `topStrips` drops them):
 * 1. key `ac-high`, severity `high`, count = `bannerOf(board).high` (`screens/analytics/action-center.ts`), what =
 *    `t('v2d.strip.high.one')` when the count is 1 else `t('v2d.strip.high')`, link `t('v2d.strip.ac.open')`, href
 *    `ACTION_CENTER_PATH` (`screens/analytics/groups.ts`).
 * 2. key `ac-medium`, severity `medium`, count = `bannerOf(board).medium`, what `v2d.strip.medium.one` / `v2d.strip.medium`,
 *    the same link and href as 1.
 * 3. key `tf`, severity `low`, count = the Team Focus actions still open: the engine's `team-focus` figure, only when its
 *    status is `ready`, read with `focusActions(figure.value)` (`screens/analytics/team-focus-actions.ts`), counting
 *    the actions whose status is `open` or `prog` (exactly as `teamFocusOf` in `banners.ts` counts them); what
 *    `v2d.strip.tf.one` / `v2d.strip.tf`, link `t('v2d.tf.open')`, href `TEAM_FOCUS_PATH` (`banners.ts`).
 * `board` null, or `bannerOf(board)` null (no nudge open) → counts 1 and 2 are 0. Figure missing or not ready → count 3
 * is 0. Words come only from `t`; the count is never put inside `what`.
 */
export function dashboardStrips(
  board: DashboardFacts['board'],
  reply: FiguresReply,
  t: Translate,
): Strip[] {
  const banner = board === null ? null : bannerOf(board);
  const figure = reply.figures.find((f) => f.key === 'team-focus');
  const tf =
    figure?.status === 'ready'
      ? focusActions(figure.value).filter((a) => a.status === 'open' || a.status === 'prog').length
      : 0;
  const what = (key: string, n: number) => t(n === 1 ? `${key}.one` : key);
  const high = banner?.high ?? 0;
  const medium = banner?.medium ?? 0;
  const link = t('v2d.strip.ac.open');
  return [
    {
      key: 'ac-high',
      severity: 'high',
      count: high,
      what: what('v2d.strip.high', high),
      link,
      href: ACTION_CENTER_PATH,
    },
    {
      key: 'ac-medium',
      severity: 'medium',
      count: medium,
      what: what('v2d.strip.medium', medium),
      link,
      href: ACTION_CENTER_PATH,
    },
    {
      key: 'tf',
      severity: 'low',
      count: tf,
      what: what('v2d.strip.tf', tf),
      link: t('v2d.tf.open'),
      href: TEAM_FOCUS_PATH,
    },
  ];
}

/**
 * The costliest problems as `RankedBars` rows (ADR 0043 §2), from the card's own table (`costliestOf` in `tables.ts`,
 * whose row cells are [problem, hours, share, breakdowns]). `null` table → `[]`. One row per table row, in table order:
 * - `key`: the row's position as a string ("0", "1", …), so two problems with the same name stay apart;
 * - `label`: the problem cell's `text`;
 * - `value`: the hours cell's `sort` when it is a finite number, else `NaN` (the kit draws it last, with no bar);
 * - `valueText`: the hours cell's `text` exactly as printed (never re-rounded, never re-formatted);
 * - `countText`: `t('v2d.bubble.tip.breakdowns')` with `{value}` filled by the breakdowns cell's `text`
 *   ("Breakdowns: 12"), so the per-problem breakdown count the table showed is kept.
 * No `moneyText`, no `rest`.
 */
export function costliestRows(costliest: CostliestModel, t: Translate): RankedRow[] {
  return (costliest.table?.rows ?? []).map((cells, i) => {
    const hours = cells[1]?.sort;
    return {
      key: String(i),
      label: cells[0]?.text ?? '',
      value: typeof hours === 'number' && Number.isFinite(hours) ? hours : Number.NaN,
      valueText: cells[1]?.text ?? '',
      countText: fill(t('v2d.bubble.tip.breakdowns'), { value: cells[3]?.text ?? '' }),
    };
  });
}
