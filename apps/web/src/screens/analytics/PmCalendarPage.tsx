import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import type { FiguresReply } from '@uptimo/shared/analytics';
import type { PmCalendarItem } from '@uptimo/shared';
import { getMe, schedulePm, useAnalyticsFigures, usePmCalendar } from '../../api.js';
import { ApiError, idempotencyKey, useOnline } from '../../data/index.js';
import { StateNotice } from '../../patterns/frame.js';
import { viewState, type ViewState } from '../../patterns/view-state.js';
import { Stack } from '../../ui/layout.js';
import { DrillTable } from './DrillTable.js';
import { FigureDrill } from './KeyPage.js';
import type { PmMove } from './PmCalendar.js';
import {
  CalendarArea,
  ComplianceTiles,
  Legend,
  MoveNotes,
  PageHead,
  SpreadPanel,
} from './pm-calendar-parts.js';
import { eventsOf, loadOf, monthRange, moveKeys, readPmCompliance } from './pm-calendar-view.js';
import { parseDrill, type AnalyticsGroup } from './groups.js';
import { displayDay } from './machine-values.js';

type Figure = FiguresReply['figures'][number];

/**
 * The PM calendar page (ticket 50c, R2/R8/R10/R16) at `/analytics/pm`: the two compliance tiles, the lazy month
 * grid of each machine's next PM, the crowded "Spread the load" panel and the drill. The figures reply is the
 * page's as-of, so its month is the plant's; the calendar's own range comes back from `datesSet`. Only head and
 * admin may drag or press Move (the server refuses everyone else whatever this page hides).
 */
export default function PmCalendarPage({ group }: { group: AnalyticsGroup }) {
  const { t } = useTranslation();
  const figures = useAnalyticsFigures();
  const online = useOnline();
  const state = viewState({
    online,
    hasData: figures.data !== undefined,
    isEmpty: false,
    error: figures.error,
  });
  if (state !== 'ready' || !figures.data)
    return (
      <StateNotice
        state={state as Exclude<ViewState, 'ready'>}
        empty={t('analytics.empty')}
        onRetry={() => void figures.refetch()}
      />
    );
  const figure = figures.data.figures.find((candidate) => candidate.key === 'pm-compliance');
  return <PmCalendarBody group={group} asOf={figures.data.asOf} figure={figure} />;
}

/** The move the grid and the panel share: one write, one refusal line, one status line. */
function usePmMove() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [refusal, setRefusal] = useState<string | null>(null);
  const [moved, setMoved] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const keys = useRef(moveKeys(idempotencyKey)).current;
  const move = async (request: PmMove): Promise<void> => {
    setRefusal(null);
    setMoved(null);
    setPending(true);
    try {
      // `machineCode` is the status line's; the strict reschedule body carries only the ids and the day.
      const body = {
        machineId: request.machineId,
        planId: request.planId,
        ticketId: request.ticketId,
        scheduledOn: request.scheduledOn,
      };
      const reply = await schedulePm(body, keys.keyFor(body));
      keys.settled();
      await Promise.all([
        client.invalidateQueries({ queryKey: ['pm-calendar'] }),
        client.invalidateQueries({ queryKey: ['tickets'] }),
        client.invalidateQueries({ queryKey: ['analytics-figures'] }),
      ]);
      setMoved(
        t('pm.calendar.moved', {
          machine: request.machineCode,
          date: displayDay(reply.scheduledOn),
        }),
      );
    } catch (error) {
      // A refusal is the server's answer, so the next try is a new attempt; a dropped connection retries the same key.
      if (error instanceof ApiError) keys.settled();
      setRefusal(error instanceof ApiError ? error.message : t('pm.calendar.refused'));
      throw error;
    } finally {
      setPending(false);
    }
  };
  const moveItem = (item: PmCalendarItem, target: string): void => {
    void move({
      planId: item.planId,
      machineId: item.machineId,
      machineCode: item.machineCode,
      ticketId: item.ticketId,
      scheduledOn: target,
    }).catch(() => undefined);
  };
  return { refusal, moved, pending, move, moveItem };
}

/** The ready page: the figure's state is settled, so the calendar and its writes may run. */
function PmCalendarBody({
  group,
  asOf,
  figure,
}: {
  group: AnalyticsGroup;
  asOf: string;
  figure: Figure | undefined;
}) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const role = useQuery({ queryKey: ['me'], queryFn: getMe }).data?.user.role;
  const canMove = role === 'head' || role === 'admin';
  const [range, setRange] = useState(() => monthRange(asOf));
  const calendar = usePmCalendar(range);
  const items = calendar.data?.items ?? [];
  const events = useMemo(() => eventsOf(items), [items]);
  const compliance = readPmCompliance(figure?.value);
  const drill = parseDrill(params.get('drill'));
  const pmMove = usePmMove();
  return (
    <Stack gap={6}>
      {drill ? <DrillTable group={group} drill={drill} /> : null}
      <PageHead asOf={asOf} />
      {compliance ? (
        <ComplianceTiles view={compliance} />
      ) : (
        <p className="text-body text-neutral-600">{t('pm.calendar.noFigure')}</p>
      )}
      {figure && figure.drill.ids.length > 0 ? <FigureDrill figure={figure} group={group} /> : null}
      <MoveNotes refusal={pmMove.refusal} moved={pmMove.moved} />
      <CalendarArea
        calendar={calendar}
        events={events}
        canMove={canMove}
        initialDate={asOf}
        onMove={pmMove.move}
        onRange={(next) =>
          setRange((current) =>
            current.from === next.from && current.to === next.to ? current : next,
          )
        }
      />
      {calendar.data ? (
        <Legend cap={calendar.data.cap} count={items.length} days={loadOf(items).size} />
      ) : null}
      <SpreadPanel
        items={items}
        canMove={canMove}
        pending={pmMove.pending}
        onMove={pmMove.moveItem}
      />
    </Stack>
  );
}
