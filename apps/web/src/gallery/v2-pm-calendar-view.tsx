import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import type { CalendarRange } from '../ui/v2/domain/calendar-events.js';
import { useScreenModel } from '../screens/v2/data.js';
import { EntityShell } from '../screens/v2/entity/EntityShell.js';
import { useNav } from '../screens/v2/nav.js';
import type { PmCalendarModel } from '../screens/v2/pm-calendar/model.js';
import { createMover } from '../screens/v2/pm-calendar/move.js';
import { standInSend } from '../screens/v2/pm-calendar/stand-in.js';
import { PmCalendarView } from '../screens/v2/pm-calendar/View.js';
import { ScreenStates } from '../ui/v2/screen-states.js';
import { previewProvider } from './v2-preview.js';

const same = (a: CalendarRange | null, b: CalendarRange): boolean =>
  a !== null && a.from === b.from && a.to === b.to;

/**
 * The v2 PM calendar as a screen will run it: the grid's six weeks are the query, the month on screen stays up while
 * the next one comes, and a move is the stand-in write (`?role=plant-head` is a login that may only read, `?offline=1`
 * is a connection that is down, to see the states).
 */
export default function V2PmCalendarView() {
  const [params] = useSearchParams();
  const [range, setRange] = useState<CalendarRange | null>(null);
  const canMove = params.get('role') !== 'plant-head';
  const offline = params.get('offline') === '1';
  const provider = useMemo(() => previewProvider<'pm-calendar'>(params.get('state')), [params]);
  const query = useMemo(() => ({ range, canMove }), [range, canMove]);
  const loaded = useScreenModel('pm-calendar', query, provider);
  const last = useRef<PmCalendarModel>(undefined);
  if (loaded.state === 'ready' && loaded.model) last.current = loaded.model;
  const model = loaded.model ?? (loaded.state === 'loading' ? last.current : undefined);
  const move = model?.words.move;
  const mover = useMemo(
    () =>
      move &&
      createMover(
        offline ? () => Promise.reject(new TypeError('Failed to fetch')) : standInSend,
        move,
      ),
    [move?.moved, move?.refused, move?.offline, offline],
  );
  const nav = useNav('problems');
  const { t } = useTranslation();
  const title = t('pm.screen.calendar');
  if (!model || !mover)
    return (
      <EntityShell nav={nav} title={title}>
        <ScreenStates loaded={loaded}>{() => null}</ScreenStates>
      </EntityShell>
    );
  return (
    <PmCalendarView
      model={model}
      loading={loaded.state === 'loading'}
      nav={nav}
      title={title}
      onRange={(next) => setRange((now) => (same(now, next) ? now : next))}
      onMove={async (request) => {
        const line = await mover(request);
        loaded.retry();
        return line;
      }}
    />
  );
}
