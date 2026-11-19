import { useQuery } from '@tanstack/react-query';
import { cacheFirst, readConfig, readState, saveConfig, saveState } from './offline/cache.js';
import { correctionBody } from './screens/analytics/machine-values.js';
import {
  ApiError,
  defineResource,
  http,
  httpKeepSession,
  httpWithoutSession,
  idempotencyKey,
  isOffline,
  forgetPushBinding,
  rememberWho,
} from './data/index.js';
import {
  actionCenterBoardSchema,
  pmCalendarReplySchema,
  pmRescheduleReplySchema,
  type ActionCenterBoardReply,
  type NudgeAckBody,
  type PmCalendarReply,
  type PmRescheduleBody,
  type PmRescheduleReply,
} from '@uptimo/shared';
import type { BoardToday } from '@uptimo/shared/board';
import {
  drillReplySchema,
  type DrillReply,
  type DrillType,
  type FiguresReply,
} from '@uptimo/shared/analytics';
import type { User } from '@uptimo/shared/auth';
import type {
  Criticality,
  Group,
  ListItem,
  Machine,
  Person,
  Segment,
  Severity,
  SeverityMatrix,
  Shift,
} from '@uptimo/shared/config';
import type {
  CommandReply,
  Config,
  State,
  Ticket,
  TicketDetail,
  TicketPage,
} from '@uptimo/shared/replies';
import type { SlaPoliciesUpdate, SlaPolicy, SlaProjection, SlaTimer } from '@uptimo/shared/sla';
import type { SignoffFeed } from '@uptimo/shared/signoff';
import type {
  BreakdownReportBody,
  CommandAction,
  PmReport,
  RaiseTicketBody,
} from '@uptimo/shared/ticket';
import type { WhyWhyPayload, WhyWhyWrite } from '@uptimo/shared/why-why';
import type { TaskInput } from '@uptimo/shared/tasks';
import type {
  BreakdownReport,
  CloseKind,
  Figures,
  TicketEvent,
  TicketInterval,
  TicketKind,
  TicketPerson,
  TicketStatus,
} from '@uptimo/shared/ticket-reply';

const config = defineResource<Config>({ key: 'config', path: '/api/v1/config' });
const state = defineResource<State>({ key: 'state', path: '/api/v1/state' });
/** Exported for QueuePage lists (floor My complaints). */
export const tickets = defineResource<TicketDetail, Ticket>({
  key: 'tickets',
  path: '/api/v1/tickets',
});
const boardToday = defineResource<BoardToday>({ key: 'board', path: '/api/v1/board' });
const analyticsFigures = defineResource<FiguresReply>({
  key: 'analytics-figures',
  path: '/api/v1/analytics/figures',
});
/**
 * `GET /analytics/drill` answers `{ type, rows }`, not a cursor page: the engine's plain rows, the same shape
 * the engine reads. The shared contract owns that reply; `list` is only the query-string helper here.
 */
const analyticsDrill = defineResource<DrillReply, never>({
  key: 'analytics-drill',
  path: '/api/v1/analytics/drill',
});
/** The screen's read model (44c's routes): every current nudge with its status, counts and risk rows. */
const actionCenter = defineResource<ActionCenterBoardReply>({
  key: 'analytics-action-center',
  path: '/api/v1/analytics/action-center',
});
/** One nudge's write and reopen; both answer the whole fresh board. */
const actionCenterNudge = defineResource<ActionCenterBoardReply>({
  key: 'analytics-action-center',
  // `:id` is the resource helper's placeholder; the server's own parameter name is `key`.
  path: '/api/v1/analytics/action-center/nudges/:id',
});
/** The rows behind a figure: at most 200 ids, the order of the ids asked; the reply is parsed at this boundary. */
export const getDrill = async (type: DrillType, ids: readonly string[]): Promise<DrillReply> =>
  drillReplySchema.parse(await analyticsDrill.list({ type, ids: ids.join(',') }));
/** One ticket's Why-Why home (R2): a read of the latest record and an append-only write of the next one. */
const whyWhy = defineResource<WhyWhyPayload | null>({
  key: 'why-why',
  path: '/api/v1/tickets/:id/why-why',
});
const signoffFeed = defineResource<SignoffFeed>({
  key: 'signoff-feed',
  path: '/api/v1/board/signoff',
});
const me = defineResource<{ user: Me }>({ key: 'me', path: '/api/v1/auth/me' });
const brand = defineResource<{ company: string; logo: string | null }>({
  key: 'brand',
  path: '/api/v1/brand',
});
const login = defineResource({
  key: 'auth',
  path: '/api/v1/auth/login',
  transport: httpWithoutSession,
});
type ActingChoices = { people: { id: string; name: string; team: string }[] };
const acting = defineResource<ActingChoices>({ key: 'auth', path: '/api/v1/auth/acting' });
const password = defineResource({
  key: 'auth',
  path: '/api/v1/auth/password',
  transport: httpKeepSession,
});
const logout = defineResource({ key: 'auth', path: '/api/v1/auth/logout' });
const settings = defineResource({ key: 'settings', path: '/api/v1/settings' });
const criticality = defineResource({
  key: 'machines',
  path: '/api/v1/machines/:id/criticality',
});

export function getConfig(): Promise<Config> {
  return cacheFirst({
    cached: readConfig(),
    offline: isOffline(),
    load: () => config.one(),
    save: saveConfig,
    isHttpError: (error) => error instanceof ApiError,
  });
}

export const raiseTicket = (body: RaiseTicketBody): Promise<{ ticket: Ticket }> =>
  tickets.create<{ ticket: Ticket }>(body, { idempotencyKey: idempotencyKey() });

export function getState(): Promise<State> {
  return cacheFirst({
    cached: readState(),
    offline: isOffline(),
    load: () => state.one(),
    save: saveState,
    isHttpError: (error) => error instanceof ApiError,
  });
}

/** The plant's day score for the live board's Response today and Repair today tiles. */
export const getBoardToday = (): Promise<BoardToday> => boardToday.one('today');

/** `GET /analytics/figures`: every figure the menu shows, as of the plant's today. */
export const useAnalyticsFigures = () => analyticsFigures.useOne();

/**
 * `GET /pm/calendar?from&to` (50c): the six-week grid's occurrences, parsed at this boundary. The range is the
 * calendar's own, so the query key carries it and a month change refetches.
 */
export const usePmCalendar = (range: { from: string; to: string }) =>
  useQuery({
    queryKey: ['pm-calendar', range.from, range.to],
    queryFn: async (): Promise<PmCalendarReply> => {
      const query = `from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
      return pmCalendarReplySchema.parse(await http(`/api/v1/pm/calendar?${query}`));
    },
  });

/**
 * `POST /pm/reschedule` (50c): the one move. A refusal is an `ApiError` whose message the page shows (a full day
 * is 409, a Sunday or a date outside the tolerance is 422); each call carries its own idempotency key.
 */
export const schedulePm = async (body: PmRescheduleBody): Promise<PmRescheduleReply> =>
  pmRescheduleReplySchema.parse(
    await http('/api/v1/pm/reschedule', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify(body),
    }),
  );

/** `GET /analytics/action-center`: the Action Center board, as of the plant's today by default. */
export const useActionCenterBoard = () => actionCenter.useOne();

/** `PUT /analytics/action-center/nudges/:key`: acknowledge, snooze or resolve; the fresh board answers. */
export const writeNudge = async (
  key: string,
  body: NudgeAckBody,
): Promise<ActionCenterBoardReply> =>
  actionCenterBoardSchema.parse(await actionCenterNudge.update<unknown>(key, body));

/** `DELETE /analytics/action-center/nudges/:key`: reopen one nudge; the fresh board answers. */
export const reopenNudge = async (key: string): Promise<ActionCenterBoardReply> =>
  actionCenterBoardSchema.parse(
    await http(`/api/v1/analytics/action-center/nudges/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    }),
  );

/** `GET /tickets/:id/why-why`: the latest saved record, or null when none has been saved. */
export const getWhyWhy = (ticketId: string): Promise<WhyWhyPayload | null> => whyWhy.one(ticketId);

/** `PUT /tickets/:id/why-why`: appends one record; the server writes the author and the plant date. */
export const saveWhyWhy = (ticketId: string, body: WhyWhyWrite): Promise<WhyWhyPayload> =>
  whyWhy.update<WhyWhyPayload>(ticketId, body);

/** `GET /board/signoff`: closed tickets still waiting for production, the longest wait first. */
export const getSignoffFeed = (): Promise<SignoffFeed> => signoffFeed.one();

export const getTicket = (id: string): Promise<TicketDetail> => tickets.one(id);

/** `GET /tickets` (M1a-5c): cursor-paginated; status/kind serialise as comma-separated subsets. */
export const listTickets = (query: TicketListQuery = {}): Promise<TicketPage> =>
  tickets.list(query);

/** The same list as pages, by cursor (`useInfiniteQuery`): the desk lists read every page they need. */
export const useTicketPages = (query: TicketListQuery) => tickets.useList(query);

/** GET /auth/me; also caches who this phone is acting as (offline commands record it). */
export const getMe = (): Promise<{ user: Me }> =>
  me.one().then((reply) => {
    rememberWho(reply.user);
    return reply;
  });

export const getBrand = (): Promise<{ company: string; logo: string | null }> => brand.one();

/** POST /auth/login; a wrong password is an ApiError with the server's message. */
export const signIn = (body: {
  username: string;
  password: string;
}): Promise<{ token: string; user: Me }> => login.create<{ token: string; user: Me }>(body);

/** GET /auth/acting: the people this shared phone may choose (names and teams only). */
export const getActingChoices = (): Promise<ActingChoices> => acting.one();

/** POST /auth/acting: who is using this shared phone from now on. */
export const chooseActing = (actingPersonId: string): Promise<unknown> =>
  acting.create({ actingPersonId });

/** POST /auth/password; a wrong current password is a 401 ApiError that keeps this phone signed in. */
export const changePassword = (body: { old: string; password: string }): Promise<unknown> =>
  password.create(body).then((reply) => {
    forgetPushBinding();
    return reply;
  });

/** POST /auth/logout: ends this phone's session on the server. */
export const signOut = (): Promise<unknown> => logout.create({});

export {
  ApiError,
  askWhoIsActing,
  clearToken,
  getToken,
  isOffline,
  sendCommand,
  setToken,
} from './data/index.js';

export type { BoardToday };
export type {
  BreakdownReport,
  BreakdownReportBody,
  CloseKind,
  CommandAction,
  Config,
  Criticality,
  Figures,
  Group,
  ListItem,
  Machine,
  Person,
  PmReport,
  RaiseTicketBody,
  Segment,
  Severity,
  SeverityMatrix,
  Shift,
  SlaPoliciesUpdate,
  SlaPolicy,
  SlaProjection,
  SlaTimer,
  State,
  Ticket,
  TicketDetail,
  TicketEvent,
  TicketInterval,
  TicketPage,
  TicketPerson,
  TicketStatus,
};
export type RaiseKind = TicketKind;
export type Me = User;
export type BreakdownCategory = NonNullable<BreakdownReportBody['breakdownCategory']>;
export type CommandResult = CommandReply | { queued: true; id: string };

export type CorrectChanges = Partial<
  Pick<Ticket, 'reportedAt' | 'startedAt' | 'closedAt' | 'problem' | 'leadPersonId'>
> & { machineId?: string | null; kind?: RaiseKind; closedByPersonId?: string | null };

export type TicketListQuery = {
  status?: TicketStatus[];
  kind?: RaiseKind[];
  machineId?: string;
  personId?: string;
  raisedBy?: string;
  from?: string;
  to?: string;
  /** The channel a ticket was raised through; `['pm']` is the technician's PM job list (49c). */
  channel?: string[];
  cursor?: string;
  limit?: number;
};

/** The action bodies the desk sends; each command from DOMAIN.md §4. */
export type CommandBody =
  | { personId?: string }
  | { personId?: string; reasonCode: string; note?: string }
  | { personId?: string; text: string }
  | { personId?: string; note: string; toPersonId?: string }
  | {
      personId?: string;
      kind: CloseKind;
      at?: string;
      note?: string;
      report?: BreakdownReportBody;
      /** What a close leaves behind (ticket 19): the follow-up task. */
      task?: TaskInput;
      /** Asked only when a follow-up task is marked done: 0 to 1440. */
      taskDownMin?: number;
    }
  | { personId?: string; report: BreakdownReportBody }
  | { personId?: string; reason: string }
  | { personId?: string; role: 'primary' | 'support' }
  | { personId?: string; response: 'confirmed' | 'disputed'; reason?: string }
  | { reason: string; changes: CorrectChanges };

export const putSeverityMatrix = (value: SeverityMatrix): Promise<{ ok: boolean }> =>
  settings.update<{ ok: boolean }>('severity_matrix', { value });

export const putMachineCriticality = (
  machineId: string,
  c: 'A' | 'B' | 'C' | null,
): Promise<{ ok: boolean }> => criticality.update<{ ok: boolean }>(machineId, { criticality: c });

/** PATCH `/machines/:id/moves/:moveId`: one cell move's corrected date; a refusal is an ApiError. */
export const correctMove = (
  machineId: string,
  moveId: string,
  effectiveFrom: string,
): Promise<unknown> =>
  http(`/api/v1/machines/${encodeURIComponent(machineId)}/moves/${encodeURIComponent(moveId)}`, {
    method: 'PATCH',
    body: JSON.stringify(correctionBody(effectiveFrom)),
  });

export const putSlaPolicies = (body: SlaPoliciesUpdate): Promise<{ ok: boolean }> =>
  settings.update<{ ok: boolean }>('sla-policies', body);

const rosterCopy = defineResource<{ created: number; skipped: number }>({
  key: 'roster',
  path: '/api/v1/roster/copy',
});

/** POST /roster/copy: repeat one day's roster over the next seven days; a refusal is an ApiError. */
export const copyRoster = (date: string): Promise<{ created: number; skipped: number }> =>
  rosterCopy.create({ date });
