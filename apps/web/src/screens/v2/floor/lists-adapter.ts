import type { TFunction } from 'i18next';
import { REASON_MAX_LENGTH } from '@uptimo/shared/ticket';
import type { Machine, Me, Ticket } from '../../../api.js';
import { formatMinutes, machineLabel } from '../../../components/format.js';
import {
  formatLimit,
  signoffLimitMin,
  signoffState,
  type Refusal,
} from '../../../components/signoff.js';
import { floorStatus } from '../../../faces/floor/machines.js';
import { clock } from '../../../faces/floor/use-floor.js';
import type { ViewState } from '../../../patterns/view-state.js';
import {
  complaintPill,
  complaintPlace,
  longestWaiting,
  mayCancel,
  oldestPmJob,
  reasonReady,
  signoffShows,
  type CancelModel,
  type ComplaintCard,
  type DisputeModel,
  type ListTakeaway,
  type Longest,
  type MineModel,
  type More,
  type PmModel,
  type SignoffModel,
} from './lists-model.js';

/** What both lists read besides their rows: the login (role, acting person), the plant's machines, and now. */
export type ListsContext = {
  me: Me;
  machines: readonly Machine[];
  nowIso: string;
  /** From `viewState({ online, hasData, isEmpty, error })`. */
  state: ViewState;
  /** The list query's paging: whether another page exists and whether it is being fetched. */
  paging: { hasNext: boolean; fetching: boolean };
  /** The last "Is it fixed?" answer this phone sent (one at a time): in flight, or refused. Absent = none. */
  answer?: { ticketId: string; pending: boolean; refusal: Refusal | null } | null;
};

const KIND = {
  stopped: 'reportFloor.kindStopped',
  support: 'reportFloor.kindSupport',
  general: 'floor.workRequest',
} as const;

/** v1's `clock`, but a missing or unreadable time is left out rather than printed as "Invalid Date". */
const timeOf = (iso: string | null | undefined): string =>
  iso && !Number.isNaN(new Date(iso).getTime()) ? clock(iso) : '';

/** v1 `RefusalNote`: the refusals that are words on the sheet or the card; a new breakdown has its own sheet body. */
function refusalText(refusal: Refusal | null, t: TFunction): string | null {
  if (refusal?.kind === 'otherCell') return t('signoff.otherCell');
  if (refusal?.kind === 'notAllowed') return t('signoff.notAllowed');
  if (refusal?.kind === 'other') return t('signoff.failed');
  return null;
}

/** v1 `SignoffAnswered`. */
function answeredLines(ticket: Ticket, t: TFunction): SignoffModel {
  const lines: { text: string; quiet: boolean }[] = [];
  const handback = ticket.handback;
  if (handback) {
    const state = signoffState(handback);
    const time = timeOf(handback.respondedAt);
    if (state === 'confirmed') {
      lines.push({ text: t('signoff.confirmed', { time }), quiet: false });
      lines.push({
        text: t('signoff.turnaround', {
          maintenance: formatMinutes(handback.turnaround.maintenanceMin),
          production: formatMinutes(handback.turnaround.productionMin),
        }),
        quiet: true,
      });
    } else if (state === 'reopened') {
      lines.push({ text: t('signoff.reopened', { time }), quiet: false });
      if (handback.disputeReason)
        lines.push({
          text: t('signoff.yourReason', { reason: handback.disputeReason }),
          quiet: true,
        });
    } else {
      const limit = signoffLimitMin(handback);
      if (limit !== null)
        lines.push({ text: t('signoff.timedOut', { limit: formatLimit(limit) }), quiet: false });
      const closed = timeOf(ticket.closedAt);
      if (closed) lines.push({ text: t('signoff.closedAt', { time: closed }), quiet: true });
    }
  }
  return { kind: 'answered', lines };
}

function signoffOf(ticket: Ticket, ctx: ListsContext, t: TFunction): SignoffModel | null {
  const shows = signoffShows(ticket, ctx.me.role);
  if (shows === 'answered') return answeredLines(ticket, t);
  if (shows !== 'ask') return null;
  const answer = ctx.answer?.ticketId === ticket.id ? ctx.answer : null;
  const closed = timeOf(ticket.closedAt);
  return {
    kind: 'ask',
    title: t('signoff.ask'),
    body: closed ? t('signoff.askBody', { time: closed }) : null,
    yes: t('signoff.yes'),
    no: t('signoff.no'),
    error: refusalText(answer?.refusal ?? null, t),
    busy: answer?.pending ?? false,
  };
}

function cardOf(ticket: Ticket, ctx: ListsContext, t: TFunction): ComplaintCard {
  return {
    id: ticket.id,
    ref: ticket.ref,
    place: complaintPlace(ticket, ctx.machines),
    pill: complaintPill(ticket),
    kindLine: `${t(KIND[ticket.kind])} · ${ticket.ref}`,
    stopped: ticket.kind === 'stopped',
    problem: ticket.problem,
    reported: t('reportFloor.reportedAt', { time: timeOf(ticket.reportedAt) }),
    cancel: mayCancel(ticket, ctx.me) ? t('action.cancel') : null,
    signoff: signoffOf(ticket, ctx, t),
  };
}

const moreOf = (ctx: ListsContext, t: TFunction): More =>
  ctx.paging.hasNext
    ? {
        label: ctx.paging.fetching ? t('common.loading') : t('kit.pattern.more'),
        busy: ctx.paging.fetching,
      }
    : null;

function takeawayOf(
  found: Longest | null,
  words: { text: string; of: string },
  t: TFunction,
): ListTakeaway | null {
  if (!found) return null;
  return {
    text: t(words.text, { place: found.place, wait: formatMinutes(found.minutes) }),
    tone: 'risk',
    tag: t('floor.lists.tagLongest'),
    outlier: found.ticketId,
    yardstick: t(words.of, { n: found.of }),
  };
}

/**
 * `/floor/mine` from the loaded `/tickets?raisedBy=actingPersonId` rows (newest first, as sent). Card words, pill,
 * sign-off block and Cancel follow `lists-model.ts`; times are v1's `clock()` (`faces/floor/use-floor.ts`).
 */
export function mineModel(rows: readonly Ticket[], ctx: ListsContext, t: TFunction): MineModel {
  const ready = ctx.state === 'ready';
  return {
    title: t('floor.complaints'),
    state: ctx.state,
    empty: t('floor.complaintsEmpty'),
    takeaway: ready
      ? takeawayOf(
          longestWaiting(rows, ctx.machines, ctx.nowIso),
          { text: 'floor.lists.mineLongest', of: 'floor.lists.mineOf' },
          t,
        )
      : null,
    cards: ready ? rows.map((ticket) => cardOf(ticket, ctx, t)) : [],
    more: moreOf(ctx, t),
  };
}

/** `/floor/pm` from the loaded `/tickets?channel=pm&status=open,working` rows; each card links to `/desk/:id`. */
export function pmModel(rows: readonly Ticket[], ctx: ListsContext, t: TFunction): PmModel {
  const ready = ctx.state === 'ready';
  const machines = [...ctx.machines];
  return {
    title: t('pm.jobs.title'),
    hint: t('pm.jobs.sub'),
    state: ctx.state,
    empty: t('pm.jobs.empty'),
    takeaway: ready
      ? takeawayOf(
          oldestPmJob(rows, ctx.machines, ctx.nowIso),
          { text: 'floor.lists.pmOldest', of: 'floor.lists.pmOf' },
          t,
        )
      : null,
    cards: ready
      ? rows.map((ticket) => ({
          id: ticket.id,
          href: `/desk/${ticket.id}`,
          code: machineLabel(ticket, machines),
          ref: ticket.ref,
          pill: floorStatus(ticket),
          title: ticket.problem,
          reported: t('reportFloor.reportedAt', { time: timeOf(ticket.reportedAt) }),
        }))
      : [],
    more: moreOf(ctx, t),
  };
}

/** The "Not fixed" sheet for one ticket: the typed reason, the last refusal, whether a send is in flight. */
export function disputeModel(
  ticket: Ticket,
  input: { reason: string; refusal: Refusal | null; pending: boolean },
  t: TFunction,
): DisputeModel {
  const { refusal } = input;
  const blocked = refusal?.kind === 'newBreakdown' ? refusal : null;
  const reported = timeOf(blocked?.reportedAt);
  return {
    title: t('signoff.no'),
    refused: blocked
      ? {
          title: blocked.ref
            ? t('signoff.refusedTitle', { ref: blocked.ref })
            : t('signoff.refusedTitleNoRef'),
          reported: reported ? t('signoff.refusedReported', { time: reported }) : null,
          body: t('signoff.refusedBody', { ref: ticket.ref }),
        }
      : null,
    note: t('signoff.disputeNote', { ref: ticket.ref }),
    reasonLabel: t('signoff.reasonLabel'),
    reasonId: `signoff-${ticket.id}`,
    maxLength: REASON_MAX_LENGTH,
    hint: t('signoff.reasonHint'),
    error: blocked ? null : refusalText(refusal, t),
    send: t('signoff.send'),
    cancel: t('signoff.cancel'),
    back: t('signoff.back'),
    ready: !blocked && reasonReady(input.reason, input.pending),
  };
}

/** The "Cancel the ticket" sheet for one ticket: the typed reason, the command's error, whether one is in flight. */
export function cancelModel(
  ticket: Ticket,
  input: { reason: string; error: string | null; pending: boolean },
  t: TFunction,
): CancelModel {
  return {
    title: t('action.cancel.title'),
    reasonLabel: t('action.whyCancel'),
    reasonId: `cancel-${ticket.id}`,
    submit: t('action.cancel.submit'),
    error: input.error,
    ready: reasonReady(input.reason, input.pending),
  };
}
