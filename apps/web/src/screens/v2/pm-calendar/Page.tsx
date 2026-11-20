/* eslint-disable i18next/no-literal-string -- query keys only; every visible word goes through t() */
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { schedulePm } from '../../../api.js';
import type { CalendarRange } from '../../../ui/v2/domain/calendar-events.js';
import { SavedCopyNotice, ScreenStates } from '../../../ui/v2/screen-states.js';
import { useScreenModel } from '../data.js';
import { EntityShell } from '../entity/EntityShell.js';
import { useKept } from '../kept.js';
import { LiveFrame, type LiveEntry } from '../live-frame.js';
import { useRefreshOnFigures } from '../refresh.js';
import { refreshCalendar } from './live.js';
import { createMover } from './move.js';
import { PmCalendarView } from './View.js';

export const PM_CALENDAR_ENTRY: LiveEntry = {
  group: 'pm',
  section: 'reports',
  screen: 'pm-calendar',
};

const same = (a: CalendarRange | null, b: CalendarRange): boolean =>
  a !== null && a.from === b.from && a.to === b.to;

/**
 * The PM calendar at `/analytics/pm`, on the routes v1 read. The grid's six weeks are the query, the month on screen
 * stays while the next one comes, and a move is v1's own write (`POST /pm/reschedule`, one idempotency key per attempt,
 * the server's refusal in its own words). A landed move reads the calendar, the tickets and the figures again, as v1
 * did, and the figures' 30-second refresh reads the calendar again too.
 */
export function PmCalendarPage() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [range, setRange] = useState<CalendarRange | null>(null);
  const query = useMemo(() => ({ range }), [range]);
  const loaded = useScreenModel('pm-calendar', query);
  const { retry } = loaded;
  useRefreshOnFigures(() => refreshCalendar(client, retry));
  const model = useKept(loaded);
  const move = model?.words.move;
  // One mover holds one idempotency key per attempt; it is rebuilt only when its words change, never on a refresh.
  const mover = useMemo(
    () => (move ? createMover(schedulePm, move) : undefined),
    [move?.moved, move?.refused, move?.offline],
  );
  // A refresh that failed after a good load leaves the last answer on screen, and says so.
  const stale = loaded.state === 'error' || loaded.state === 'offline';
  const title = t('pm.screen.calendar');
  return (
    <LiveFrame
      notice={model && stale ? <SavedCopyNotice text={t('v2a.saved')} /> : null}
      entry={PM_CALENDAR_ENTRY}
    >
      {(nav) =>
        model && mover ? (
          <PmCalendarView
            model={model}
            loading={loaded.state === 'loading'}
            nav={nav}
            title={title}
            onRange={(next) => setRange((now) => (same(now, next) ? now : next))}
            onMove={async (request) => {
              const line = await mover(request);
              await Promise.all([
                client.invalidateQueries({ queryKey: ['pm-calendar'] }),
                client.invalidateQueries({ queryKey: ['tickets'] }),
                client.invalidateQueries({ queryKey: ['analytics-figures'] }),
              ]);
              retry();
              return line;
            }}
          />
        ) : (
          <EntityShell nav={nav} title={title}>
            <ScreenStates loaded={loaded}>{() => null}</ScreenStates>
          </EntityShell>
        )
      }
    </LiveFrame>
  );
}
