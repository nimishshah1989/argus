import type { TFunction } from 'i18next';
import type { MineInput, MineModel, TeamInput, TeamModel } from './team-model.js';

/**
 * `/desk/mine` from the Mine window, the login and `/config`. Windows and the day report href come from v1's
 * `screens/desk/views.ts` (kept, imported: `closedLast30Days`, `dayReportHref`, `todayDate`); each card's quick
 * button from `components/actionSpecs.ts` `quickSpec` with `actorFrom(me)`.
 */
export function mineModel(input: MineInput, t: TFunction): MineModel {
  void input;
  void t;
  throw new Error('not implemented');
}

/**
 * `/desk/team` from `/state` and the two windows. Groups and totals come from `views.ts` (`workingByPerson`,
 * `cancelledLast24h`, `closedLast30Days`, `monthlyTotals`); the Waiting list from `waitingFirst`; the takeaway
 * is computed here.
 */
export function teamModel(input: TeamInput, t: TFunction): TeamModel {
  void input;
  void t;
  throw new Error('not implemented');
}
