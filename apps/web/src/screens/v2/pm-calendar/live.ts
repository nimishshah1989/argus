import type { TFunction } from 'i18next';
import { pmCalendarQuery } from '../../../api.js';
import { monthRange } from '../../analytics/pm-calendar-view.js';
import type { QueryClient } from '@tanstack/react-query';
import { liveReply, liveRole, read } from '../figures/live.js';
import { figureOf } from '../printed-page/printed.js';
import { pmCalendarModel } from './adapter.js';
import type { PmCalendarModel, PmCalendarQuery } from './model.js';

const FIGURE = 'pm-compliance';

/** Only a head or an admin may move a job; the server refuses everyone else whatever the screen shows. */
export const mayMovePm = (role: string | undefined): boolean => role === 'head' || role === 'admin';

/**
 * The PM calendar for the days asked, from the routes v1 read: `GET /pm/calendar` for the grid's six weeks (under v1's
 * own query key, so the cache is shared), the engine's `pm-compliance` figure and the signed-in role. With no range it
 * is the plant's own month, as v1 opened. A refusal stays the server's, so an operator sees "not for you".
 */
export async function livePmCalendar(
  client: QueryClient | undefined,
  query: PmCalendarQuery,
  t: TFunction,
): Promise<PmCalendarModel> {
  const [figures, role] = await Promise.all([liveReply(client), liveRole(client)]);
  const calendar = await read(client, pmCalendarQuery(query.range ?? monthRange(figures.asOf)));
  const figure = figureOf(figures, FIGURE);
  const named = figure?.status === 'ready' && figure.drill.ids.length > 0;
  return pmCalendarModel(
    {
      calendar,
      compliance: figure?.value,
      asOf: figures.asOf,
      canMove: mayMovePm(role),
      drill: named ? { figure: FIGURE, label: t('analytics.drill.open') } : null,
    },
    t,
  );
}

/**
 * One refresh (the figures were read again, as v1's calendar was every 30 seconds): the calendar's copies are marked old,
 * so the live reader, which serves anything under 30 seconds old from its cache, asks the server again; then `again`.
 */
export function refreshCalendar(client: QueryClient, again: () => void): void {
  void client.invalidateQueries({ queryKey: ['pm-calendar'], refetchType: 'none' });
  again();
}
