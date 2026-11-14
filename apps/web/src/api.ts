import { cacheFirst, readConfig, readState, saveConfig, saveState } from './offline/cache.js';
import {
  ApiError,
  defineResource,
  httpKeepSession,
  httpWithoutSession,
  idempotencyKey,
  isOffline,
} from './data/index.js';
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
import type { BreakdownReportBody, CommandAction, RaiseTicketBody } from '@uptimo/shared/ticket';
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
const me = defineResource<{ user: Me }>({ key: 'me', path: '/api/v1/auth/me' });
const brand = defineResource<{ company: string }>({ key: 'brand', path: '/api/v1/brand' });
const login = defineResource({
  key: 'auth',
  path: '/api/v1/auth/login',
  transport: httpWithoutSession,
});
const acting = defineResource({ key: 'auth', path: '/api/v1/auth/acting' });
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
const waitReasons = defineResource({ key: 'lists', path: '/api/v1/lists/wait_reason' });

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

export const getTicket = (id: string): Promise<TicketDetail> => tickets.one(id);

/** `GET /tickets` (M1a-5c): cursor-paginated; status/kind serialise as comma-separated subsets. */
export const listTickets = (query: TicketListQuery = {}): Promise<TicketPage> =>
  tickets.list(query);

/** The same list as pages, by cursor (`useInfiniteQuery`): the desk lists read every page they need. */
export const useTicketPages = (query: TicketListQuery) => tickets.useList(query);

export const getMe = (): Promise<{ user: Me }> => me.one();

export const getBrand = (): Promise<{ company: string }> => brand.one();

/** POST /auth/login; a wrong password is an ApiError with the server's message. */
export const signIn = (body: {
  username: string;
  password: string;
}): Promise<{ token: string; user: Me }> => login.create<{ token: string; user: Me }>(body);

/** POST /auth/acting: who is using this shared phone from now on. */
export const chooseActing = (actingPersonId: string): Promise<unknown> =>
  acting.create({ actingPersonId });

/** POST /auth/password; a wrong current password is a 401 ApiError that keeps this phone signed in. */
export const changePassword = (body: { old: string; password: string }): Promise<unknown> =>
  password.create(body);

/** POST /auth/logout: ends this phone's session on the server. */
export const signOut = (): Promise<unknown> => logout.create({});

export { ApiError, clearToken, getToken, isOffline, sendCommand, setToken } from './data/index.js';

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
  cursor?: string;
  limit?: number;
};

/** The action bodies the desk sends; each command from DOMAIN.md §4. */
export type CommandBody =
  | { personId: string }
  | { personId: string; reasonCode: string; note?: string }
  | { personId: string; text: string }
  | { personId: string; note: string; toPersonId?: string }
  | { personId: string; kind: CloseKind; note?: string; report?: BreakdownReportBody }
  | { personId: string; report: BreakdownReportBody }
  | { personId: string; reason: string }
  | { personId: string; role: 'primary' | 'support' }
  | { reason: string; changes: CorrectChanges };

export const putSeverityMatrix = (value: SeverityMatrix): Promise<{ ok: boolean }> =>
  settings.update<{ ok: boolean }>('severity_matrix', { value });

export const putMachineCriticality = (
  machineId: string,
  c: 'A' | 'B' | 'C' | null,
): Promise<{ ok: boolean }> => criticality.update<{ ok: boolean }>(machineId, { criticality: c });

export const putSlaPolicies = (body: SlaPoliciesUpdate): Promise<{ ok: boolean }> =>
  settings.update<{ ok: boolean }>('sla-policies', body);

/** Sends every editable field; null translations/tags stay omitted because the PUT schema is optional. */
export function putWaitReason(item: ListItem): Promise<{ ok: boolean }> {
  return waitReasons.update<{ ok: boolean }>(item.code, {
    label: item.label,
    labelGu: item.labelGu ?? undefined,
    labelHi: item.labelHi ?? undefined,
    sort: item.sort,
    active: item.active,
    isVendor: item.isVendor,
    pausesSla: item.pausesSla,
    tag: item.tag ?? undefined,
  });
}
