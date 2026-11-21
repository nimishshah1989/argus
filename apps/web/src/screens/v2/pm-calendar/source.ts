import i18n from 'i18next';
import { monthRange } from '../../analytics/pm-calendar-view.js';
import { pmCalendarModel } from './adapter.js';
import type { PmCalendarModel, PmCalendarQuery } from './model.js';
import { COMPLIANCE, TODAY, calendarFor } from './stand-in.js';

/**
 * The gallery's PM calendar: the engine's calendar for the asked days and its compliance figure, through the live
 * adapter. The grid asks for its six weeks once it has drawn; until then the plant's own month.
 */
export const pmCalendarFromStandIn = (query: PmCalendarQuery): Promise<PmCalendarModel> =>
  Promise.resolve(
    pmCalendarModel(
      {
        calendar: calendarFor(query.range ?? monthRange(TODAY)),
        compliance: COMPLIANCE,
        asOf: TODAY,
        canMove: query.canMove ?? false,
      },
      i18n.t.bind(i18n),
    ),
  );
