import type { Machine, Me, Ticket } from '../../../api.js';
import type { ViewState } from '../../../patterns/view-state.js';

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

/** What a takeaway says and how it is tagged. */
export type ListTakeaway = {
  text: string;
  tone: 'warn' | 'neutral';
  tag: string;
  yardstick: string;
};

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
export function complaintPlace(_ticket: Ticket, _machines: readonly Machine[]): string {
  throw new Error('not implemented');
}

/** The card's pill: `floorStatus`, except a closed ticket with a sign-off shows production's side (disputed keeps Fixed). */
export function complaintPill(_ticket: Ticket): ListPill {
  throw new Error('not implemented');
}

/**
 * Answerers (`canAskHandback`) see the ask while it is asked and the answered lines after; anyone else sees only the
 * timed-out lines (they say what the plant did, never "You said…"). No handback: null.
 */
export function signoffShows(_ticket: Ticket, _role: string): SignoffShows {
  throw new Error('not implemented');
}

/** Cancel is offered only where the domain offers it to this login (`offers(ticket, actorFrom(me), 'cancel')`). */
export function mayCancel(_ticket: Ticket, _me: Me): boolean {
  throw new Error('not implemented');
}

/** The Booked complaint (nobody has taken it) that has waited longest; null when none is Booked. */
export function longestWaiting(
  _rows: readonly Ticket[],
  _machines: readonly Machine[],
  _nowIso: string,
): Longest | null {
  throw new Error('not implemented');
}

/** The oldest loaded PM job (its place is `machineLabel`); null when there are none. */
export function oldestPmJob(
  _rows: readonly Ticket[],
  _machines: readonly Machine[],
  _nowIso: string,
): Longest | null {
  throw new Error('not implemented');
}

/** A sheet's send is ready once the trimmed reason has text and nothing is in flight. */
export function reasonReady(_reason: string, _pending: boolean): boolean {
  throw new Error('not implemented');
}
