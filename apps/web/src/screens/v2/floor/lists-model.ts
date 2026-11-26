import type { Machine, Me, Ticket } from '../../../api.js';
import { actorFrom, offers } from '../../../components/actionSpecs.js';
import { machineLabel } from '../../../components/format.js';
import { canAskHandback, signoffState } from '../../../components/signoff.js';
import { floorStatus } from '../../../faces/floor/machines.js';
import type { ViewState } from '../../../patterns/view-state.js';
import type { TakeawayData } from '../../../ui/v2/takeaway.js';

/**
 * S27-B floor lists (ADR 0045 T2): My complaints (`/floor/mine`) and PM jobs (`/floor/pm`). Pure rules only; the
 * words come from the catalogue in `lists-adapter.ts`. v1's `floorStatus` (`faces/floor/machines.ts`), `offers` /
 * `actorFrom` (`components/actionSpecs.ts`) and `signoffState` / `canAskHandback` (`components/signoff.ts`) are
 * reused, never copied.
 */

/** A card's status pill, as `StatusPill` takes it: floor words, the ticket word for Cancelled, or production's side. */
export type ListPill =
  | { group: 'floor'; id: 'booked' | 'in_progress' | 'fixed' }
  | { group: 'ticket'; id: 'cancelled' }
  | { group: 'handback'; id: 'requested' | 'confirmed' | 'timed_out' };

/** What the sign-off block shows this login on one card. */
export type SignoffShows = 'ask' | 'answered' | null;

/** The figure behind a list's takeaway: the job that has waited longest, from the loaded rows only. */
export type Longest = {
  ticketId: string;
  ref: string;
  place: string;
  /** Whole minutes from `reportedAt` to now, never below 0. */
  minutes: number;
  /** The yardstick: how many rows the rule looked at (My complaints: Booked rows; PM jobs: every loaded row). */
  of: number;
};

/**
 * The kit's takeaway (`ui/v2/takeaway.tsx`, drawn with `Takeaway`: a `p`, no heading or button, so the pinned floor
 * order is untouched) plus its yardstick line. Tone `risk` with `outlier` = the named ticket's id.
 */
export type ListTakeaway = TakeawayData & { yardstick: string };

/** The "Is it fixed?" block, or what production said once the question is over. */
export type SignoffModel =
  | {
      kind: 'ask';
      title: string;
      /** "Maintenance closed it at HH:MM…"; null when the ticket has no `closedAt`. */
      body: string | null;
      yes: string;
      no: string;
      /** v1 `RefusalNote` for a refused "Yes" (other cell / not allowed / could not send); never the new-breakdown one. */
      error: string | null;
      /** "Yes, it is fixed" is disabled while this ticket's answer is in flight. */
      busy: boolean;
    }
  | { kind: 'answered'; lines: { text: string; quiet: boolean }[] };

/** One My complaints card (a list item): place, pill, "kind · REF", problem, reported time, then its controls. */
export type ComplaintCard = {
  id: string;
  ref: string;
  place: string;
  pill: ListPill;
  /** "Machine stopped · BD-0012"; `stopped` draws it in the danger tone. */
  kindLine: string;
  stopped: boolean;
  problem: string;
  reported: string;
  /** The Cancel button's word when this login may cancel the ticket; null hides it. */
  cancel: string | null;
  signoff: SignoffModel | null;
};

/** "Load more" under a list: absent, offered, or fetching. */
export type More = { label: string; busy: boolean } | null;

/** `/floor/mine`. Cards are newest first, as the server sends them. */
export type MineModel = {
  title: string;
  state: ViewState;
  empty: string;
  takeaway: ListTakeaway | null;
  cards: ComplaintCard[];
  more: More;
};

/** One PM job: a link to `/desk/:id` whose name reads code, pill, REF, plan title (gallery `PM` order). */
export type PmJobCard = {
  id: string;
  href: string;
  code: string;
  ref: string;
  pill: ListPill;
  title: string;
  reported: string;
};

/** `/floor/pm` (maintenance only; the tab and route guard are the Page's). */
export type PmModel = {
  title: string;
  hint: string;
  state: ViewState;
  empty: string;
  takeaway: ListTakeaway | null;
  cards: PmJobCard[];
  more: More;
};

/** The "Not fixed" sheet: the note (or the new-breakdown refusal), the reason, Send back / Cancel or Go back. */
export type DisputeModel = {
  title: string;
  /** Set when the server refused because the machine already has a new open breakdown; the sheet then only goes back. */
  refused: { title: string; reported: string | null; body: string } | null;
  note: string;
  reasonLabel: string;
  reasonId: string;
  maxLength: number;
  hint: string;
  /** Other refusals (other cell, not allowed, could not send), in words; null when none. */
  error: string | null;
  send: string;
  cancel: string;
  back: string;
  ready: boolean;
};

/** The "Cancel the ticket" sheet: "Why cancel?" is required. */
export type CancelModel = {
  title: string;
  reasonLabel: string;
  reasonId: string;
  submit: string;
  error: string | null;
  ready: boolean;
};

/** What a complaint is about on the floor: its machine's code from the plant, else the typed place, else ''. */
export const complaintPlace = (ticket: Ticket, machines: readonly Machine[]): string =>
  machines.find((m) => m.id === ticket.machineId)?.code ?? ticket.location ?? '';

/** The card's pill: `floorStatus`, except a closed ticket with a sign-off shows production's side (disputed keeps Fixed). */
export function complaintPill(ticket: Ticket): ListPill {
  const side = ticket.status === 'closed' ? ticket.handback?.status : undefined;
  if (side && side !== 'disputed') return { group: 'handback', id: side };
  return floorStatus(ticket);
}

/**
 * Answerers (`canAskHandback`) see the ask while it is asked and the answered lines after; anyone else sees only the
 * timed-out lines (they say what the plant did, never "You said…"). No handback: null.
 */
export function signoffShows(ticket: Ticket, role: string): SignoffShows {
  if (!ticket.handback) return null;
  const state = signoffState(ticket.handback);
  if (state === 'timedOut') return 'answered';
  if (!canAskHandback(role)) return null;
  return state === 'asking' ? 'ask' : 'answered';
}

/** Cancel is offered only where the domain offers it to this login (`offers(ticket, actorFrom(me), 'cancel')`). */
export function mayCancel(ticket: Ticket, me: Me): boolean {
  const actor = actorFrom(me);
  return actor !== null && offers(ticket, actor, 'cancel');
}

const wholeMinutes = (fromIso: string, nowIso: string): number =>
  Math.max(0, Math.floor((new Date(nowIso).getTime() - new Date(fromIso).getTime()) / 60000));

const oldest = (rows: readonly Ticket[]): Ticket | undefined =>
  rows.reduce<Ticket | undefined>(
    (best, row) => (!best || row.reportedAt < best.reportedAt ? row : best),
    undefined,
  );

const longest = (
  job: Ticket | undefined,
  place: string,
  of: number,
  nowIso: string,
): Longest | null =>
  job
    ? { ticketId: job.id, ref: job.ref, place, minutes: wholeMinutes(job.reportedAt, nowIso), of }
    : null;

/** The Booked complaint (nobody has taken it) that has waited longest; null when none is Booked. */
export function longestWaiting(
  rows: readonly Ticket[],
  machines: readonly Machine[],
  nowIso: string,
): Longest | null {
  const booked = rows.filter((row) => {
    const status = floorStatus(row);
    return status.group === 'floor' && status.id === 'booked';
  });
  const job = oldest(booked);
  return longest(job, job ? complaintPlace(job, machines) : '', booked.length, nowIso);
}

/** The oldest loaded PM job (its place is `machineLabel`); null when there are none. */
export function oldestPmJob(
  rows: readonly Ticket[],
  machines: readonly Machine[],
  nowIso: string,
): Longest | null {
  const job = oldest(rows);
  return longest(job, job ? machineLabel(job, [...machines]) : '', rows.length, nowIso);
}

/** A sheet's send is ready once the trimmed reason has text and nothing is in flight. */
export const reasonReady = (reason: string, pending: boolean): boolean =>
  reason.trim() !== '' && !pending;
