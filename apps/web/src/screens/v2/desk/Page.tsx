/* eslint-disable i18next/no-literal-string -- prop values, ids and routes only; every visible string goes through t() */
import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  getConfig,
  getCrew,
  getMe,
  getState,
  type CommandAction,
  type State,
  type Ticket,
} from '../../../api.js';
import { errorMessage, formatTime } from '../../../components/format.js';
import { useCommand } from '../../../data/index.js';
import { useWide } from '../../../patterns/wide.js';
import type { DrawerSpec } from '../../../ui/v2/drawer.js';
import { Notice } from '../../../ui/v2/notice.js';
import { ErrorState, Skeleton } from '../../../ui/v2/screen-states.js';
import { breakdownCount, type ChipFilter } from '../../desk/openLists.js';
import { useTicketWindow } from '../../desk/useTicketWindow.js';
import {
  CANCELLED_WINDOW_MS,
  CLOSED_WINDOW_MS,
  dayReportHref,
  todayDate,
} from '../../desk/views.js';
import { BoardPage } from '../board/Page.js';
import { TicketPage } from '../ticket/Page.js';
import { openModel } from './adapter.js';
import { DeskFrame, NotAvailable } from './Frame.js';
import { MineView } from './MineView.js';
import { mayOpen, type DeskView, type Segment } from './model.js';
import { SignoffCard, type FromList } from './parts.js';
import { mineModel, teamModel } from './team-adapter.js';
import { mineQuery, type WindowRead } from './team-model.js';
import { TeamView } from './TeamView.js';
import { downloadPdf } from './pdf.js';
import { OpenView } from './View.js';

const roleLabel = (role: string, t: (key: string) => string): string =>
  t(`account.role.${role === 'plant_head' ? 'plantHead' : role}`);

const LIST_ROUTE: Record<DeskView, string> = {
  open: '/desk',
  mine: '/desk/mine',
  team: '/desk/team',
};
/** The browser Live board: its stop rows open their ticket beside it too. */
const BOARD_ROUTE = '/desk/board';

/** The ticket beside a list (ADR 0056 point 4): the kit drawer holds the ticket page; closing it goes back to the list. */
function useTicketDrawer(ticketId: string | undefined, from: string): DrawerSpec | null {
  const { t } = useTranslation();
  const navigate = useNavigate();
  if (!ticketId) return null;
  return {
    id: ticketId,
    label: t('deskWide.ticket'),
    onClose: () => navigate(from),
    fullPage: { href: `/desk/${ticketId}`, label: t('ashell.entity.fullPage') },
    content: <TicketPage embedded from={from} />,
  };
}

const updatedLine = (state: UseQueryResult<State>, t: TFunction) =>
  state.dataUpdatedAt
    ? t('deskLists.updated', { time: formatTime(new Date(state.dataUpdatedAt).toISOString()) })
    : undefined;

/**
 * `/desk` (the live wiring): reads `/state`, `/config`, `/auth/me`, holds the filter and segment, runs quick commands
 * through `useCommand`, and refuses a role `mayOpen` refuses. `ticketId`: the ticket open beside the list.
 */
export function DeskOpenPage({ ticketId }: { ticketId?: string }): ReactNode {
  const { t } = useTranslation();
  const state = useQuery({ queryKey: ['state'], queryFn: getState });
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const { run, error, pending } = useCommand();
  const [filter, setFilter] = useState<ChipFilter>('');
  const [segment, setSegment] = useState<Segment>('breakdowns');
  const drawer = useTicketDrawer(ticketId, LIST_ROUTE.open);
  const user = me.data?.user;
  if (user && !mayOpen('open', user.role))
    return <NotAvailable roleLabel={roleLabel(user.role, t)} />;
  const model = state.data
    ? openModel({ state: state.data, config: config.data, me: user, filter, segment }, t)
    : undefined;
  const onQuick = (ticket: Ticket, action: CommandAction) => {
    if (user?.actingPersonId) void run(ticket.id, action, {});
  };
  let body: ReactNode;
  if (model && state.data)
    body = (
      <OpenView
        model={model}
        pending={pending}
        onFilter={setFilter}
        onSegment={setSegment}
        onQuick={onQuick}
        signoff={<SignoffCard now={state.data.now} />}
      />
    );
  else if (state.error) body = <ErrorState onRetry={() => void state.refetch()} />;
  else body = <Skeleton blocks={4} />;
  return (
    <DeskFrame
      title={t('desk.tab.open')}
      updated={updatedLine(state, t)}
      current="open"
      badge={model?.badge ?? 0}
      drawer={drawer}
    >
      {error ? <Notice tone="loss" title={error} /> : null}
      {body}
    </DeskFrame>
  );
}

/** The Live board with a stop's ticket in its side panel; Close goes back to the board. */
function BoardBeside({ ticketId }: { ticketId: string }): ReactNode {
  return <BoardPage drawer={useTicketDrawer(ticketId, BOARD_ROUTE)} />;
}

/** Mine and Team: the frame, the role check and the ticket beside the list. */
function ListPage({
  view,
  title,
  ticketId,
  children,
}: {
  view: Exclude<DeskView, 'open'>;
  title: string;
  ticketId?: string;
  children: (data: { state: UseQueryResult<State> }) => ReactNode;
}): ReactNode {
  const { t } = useTranslation();
  const state = useQuery({ queryKey: ['state'], queryFn: getState });
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const drawer = useTicketDrawer(ticketId, LIST_ROUTE[view]);
  const user = me.data?.user;
  if (user && !mayOpen(view, user.role))
    return <NotAvailable roleLabel={roleLabel(user.role, t)} />;
  return (
    <DeskFrame
      title={title}
      updated={updatedLine(state, t)}
      current={view}
      badge={breakdownCount(state.data?.open ?? [])}
      drawer={drawer}
    >
      {children({ state })}
    </DeskFrame>
  );
}

/** The day report as v1 downloaded it: with the sign-in token, saved as `day-report-{date}.pdf`. */
const downloadDayReport = () => downloadPdf(dayReportHref(), `day-report-${todayDate()}.pdf`);

function MineBody({ now }: { now: string }): ReactNode {
  const { t } = useTranslation();
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const { run, error, pending } = useCommand();
  const [failed, setFailed] = useState(false);
  const user = me.data?.user;
  const mine = useTicketWindow(mineQuery(user), Date.now() - CLOSED_WINDOW_MS);
  const model = mineModel(
    {
      mine: {
        items: mine.items,
        loading: mine.loading,
        error: mine.error ? errorMessage(mine.error) : null,
      },
      me: user,
      config: config.data,
      now,
    },
    t,
  );
  return (
    <>
      {error ? <Notice tone="loss" title={error} /> : null}
      <MineView
        model={model}
        pending={pending}
        onQuick={(ticket, action) => {
          if (user?.actingPersonId) void run(ticket.id, action, {});
        }}
        onDayReport={() => {
          setFailed(false);
          void downloadDayReport().then((ok) => setFailed(!ok));
        }}
        dayReportFailed={failed}
      />
    </>
  );
}

const windowRead = (read: ReturnType<typeof useTicketWindow>): WindowRead => ({
  items: read.items,
  loading: read.loading,
  error: read.error ? errorMessage(read.error) : null,
});

const CREW_POLL_MS = 15_000;

function TeamBody({ state }: { state: UseQueryResult<State> }): ReactNode {
  const { t } = useTranslation();
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  // Read again every 15 s, so a join or a leave shows without a reload.
  const crew = useQuery({ queryKey: ['crew'], queryFn: getCrew, refetchInterval: CREW_POLL_MS });
  const cancelled = useTicketWindow({ status: ['cancelled'] }, Date.now() - CANCELLED_WINDOW_MS);
  const closed = useTicketWindow({ status: ['closed'] }, Date.now() - CLOSED_WINDOW_MS);
  if (state.isLoading && !state.data) return <Skeleton blocks={2} />;
  if (state.error || !state.data) return <Notice tone="loss" title={errorMessage(state.error)} />;
  const model = teamModel(
    {
      state: state.data,
      crew: crew.data?.items,
      config: config.data,
      cancelled: windowRead(cancelled),
      closed: windowRead(closed),
      now: state.data.now,
    },
    t,
  );
  return <TeamView model={model} />;
}

/** `/desk/mine` (the live wiring): my jobs in progress, waiting and closed, quick buttons, the day report. */
export function DeskMinePage({ ticketId }: { ticketId?: string }): ReactNode {
  const { t } = useTranslation();
  return (
    <ListPage view="mine" title={t('desk.mineTitle')} ticketId={ticketId}>
      {({ state }) => <MineBody now={state.data?.now ?? new Date().toISOString()} />}
    </ListPage>
  );
}

/** `/desk/team` (the live wiring): who is working, waiting, not started, and the cancelled and closed windows. */
export function DeskTeamPage({ ticketId }: { ticketId?: string }): ReactNode {
  const { t } = useTranslation();
  return (
    <ListPage view="team" title={t('desk.teamNow')} ticketId={ticketId}>
      {({ state }) => <TeamBody state={state} />}
    </ListPage>
  );
}

/**
 * `/desk/:id?` (replaces v1 `screens/desk/TicketRoute`): no id is the Open list. A ticket opened from a desk list on
 * a wide screen (the row passes `from` in the history state) opens in the side panel beside that list; opened by a
 * link, on a phone, or by a login that may not open the desk, it is its own page.
 */
export function DeskRoute(): ReactNode {
  const { id } = useParams();
  const wide = useWide();
  const location = useLocation();
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const from = (location.state as Partial<FromList> | null)?.from;
  if (!id) return <DeskOpenPage />;
  const role = me.data?.user.role;
  // Until the role is known a wide screen opened from a list shows nothing: the page, then the panel, would flash.
  if (from && wide && me.isPending) return null;
  const beside = Boolean(from) && wide && role !== undefined && mayOpen('open', role);
  return beside ? besideList(from, id) : <TicketPage />;
}

/** The list the ticket was opened from, with the ticket in its side panel (a call, not a component: the Open list keeps its filter). */
function besideList(from: string | undefined, id: string): ReactNode {
  if (from === LIST_ROUTE.mine) return <DeskMinePage ticketId={id} />;
  if (from === LIST_ROUTE.team) return <DeskTeamPage ticketId={id} />;
  if (from === BOARD_ROUTE) return <BoardBeside ticketId={id} />;
  return <DeskOpenPage ticketId={id} />;
}
