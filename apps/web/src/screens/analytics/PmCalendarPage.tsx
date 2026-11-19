import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { PmCalendarItem } from '@uptimo/shared';
import { useSearchParams } from 'react-router-dom';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { getMe, useAnalyticsFigures, usePmCalendar } from '../../api.js';
import { DrillTable } from './DrillTable.js';
import { FigureDrill } from './KeyPage.js';
import { usePmMove } from './pm-move.js';
import { JobList } from './pm-calendar-move.js';
import {
  CalendarArea,
  ComplianceTiles,
  ComplianceWindow,
  Legend,
  MoveNotes,
  SpreadPanel,
} from './pm-calendar-parts.js';
import { StateNotice } from '../../patterns/frame.js';
import { useFiguresState, type ScreenState } from './screen-state.js';
import { Template } from './shell/patterns/template.js';
import { eventsOf, loadOf, monthRange, readPmCompliance, shownMonth } from './pm-calendar-view.js';
import { parseDrill, type AnalyticsGroup } from './groups.js';
import { displayDay } from './machine-values.js';

/** The template this screen stands on: the calendar in the main region, the lists beside it. */
const KIND = 'analysis' as const;

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
  const state = useFiguresState(figures);
  if (state !== 'ready' || !figures.data)
    return (
      <StateNotice
        state={state as Exclude<ScreenState, 'ready'>}
        empty={t('analytics.empty')}
        onRetry={() => void figures.refetch()}
      />
    );
  const figure = figures.data.figures.find((candidate) => candidate.key === 'pm-compliance');
  return <PmCalendarBody group={group} asOf={figures.data.asOf} figure={figure} />;
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
    <Template
      title={t('pm.screen.calendar')}
      kind={KIND}
      lede={t('pm.calendar.asOf', { date: displayDay(asOf) })}
      figures={compliance ? <ComplianceTiles view={compliance} /> : null}
      aside={<PmAside items={items} month={shownMonth(range)} canMove={canMove} pmMove={pmMove} />}
      main={
        <>
          {drill ? <DrillTable group={group} drill={drill} headingLevel={3} /> : null}
          <ComplianceWindow view={compliance} />
          {figure && figure.drill.ids.length > 0 ? (
            <FigureDrill figure={figure} group={group} />
          ) : null}
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
        </>
      }
    />
  );
}

/** The lists beside the calendar: the crowded days, then every job with its keyboard Move to date. */
function PmAside({
  items,
  month,
  canMove,
  pmMove,
}: {
  items: readonly PmCalendarItem[];
  month: string;
  canMove: boolean;
  pmMove: ReturnType<typeof usePmMove>;
}) {
  return (
    <>
      <SpreadPanel
        items={items}
        canMove={canMove}
        pending={pmMove.pending}
        onMove={pmMove.moveItem}
      />
      {canMove ? (
        <JobList
          items={items}
          month={month}
          refusal={pmMove.refusal}
          pending={pmMove.pending}
          move={pmMove.moveJob}
          announce={pmMove.announce}
        />
      ) : null}
    </>
  );
}
