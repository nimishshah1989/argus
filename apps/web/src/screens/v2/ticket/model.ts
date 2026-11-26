import type { Config, Me, TicketDetail } from '../../../api.js';
import {
  actionSpecs,
  actorFrom,
  crewFrom,
  type ActionSpec,
} from '../../../components/actionSpecs.js';
import { lockoutView, type LockoutView } from '../../../components/lockout.js';
import type { StatusRef } from '../../../ui/meaning.js';
import type { Tone } from '../../../ui/status/index.js';
import type { TakeawayData, Takeaways } from '../../../ui/v2/takeaway.js';

/**
 * S29 Ticket (ADR 0045 ticket 5): the read part of `/desk/:id` as data. The action components (ActionBar, ActionForm,
 * LockoutCard/Gate, AdminPanel, CloseFlow, SignoffPanel, TaskPanel, PmClose, ReportControls) are v1's, re-hosted
 * unchanged by the View; this model draws everything else.
 */

/** Everything the model is computed from: the `/tickets/:id` reply, `/config`, the login, the clock and the brand. */
export type TicketInput = {
  detail: TicketDetail;
  config?: Config;
  /** `/auth/me`'s `user`; absent while it loads. */
  me?: Me;
  /** ISO time the page is drawn at (live downtime, running work time, the elapsed yardstick). */
  now: string;
  /** The tenant's name for the WhatsApp text (`/brand`'s `company`). */
  brand?: string;
};

/** A header chip: the StatusPill it draws and its word ("Stopped", "Booked", "With report", "Needs lockout"). */
export type TicketChip = StatusRef & { text: string };

/** One row of a facts list: a `dt` and exactly one `dd`. A note never becomes a second `dd`. */
export type TicketFact = {
  label: string;
  value: string;
  /** "(running)" beside a working ticket's Work time; printed after the `dd`, never in it. */
  note?: string;
};

/** One "Minutes" figure. `hint` ("stopped", "hands on", the wait reason) and `yardstick` print outside the `dd`. */
export type MinuteFigure = {
  id: 'downtime' | 'workTime' | 'waiting';
  label: string;
  /** Exactly the minutes, e.g. "1 h 30 min"; never "… so far" (that word belongs to the facts row). */
  value: string;
  hint?: string;
  /** What the figure is measured against: the ticket's elapsed time, "of 1 h 06 min since reported". */
  yardstick: string;
  /** The figure behind `value`, for ranking (minutes). */
  minutes: number;
};

/** One "Who worked on it" row: lead first, then the crew. */
export type PersonLine = {
  key: string;
  name: string;
  /** "Lead · joined 10:55", with " · left" when they left. */
  sub: string;
  /** Their minutes, e.g. "47 min". */
  value: string;
  minutes: number;
};

/** One "Full history" entry, oldest first. */
export type HistoryLine = {
  key: number;
  tone: Tone;
  title: string;
  at: string;
  when: string;
  /** Who, the text, the escalation line, confirmed steps, the reason, joined with " · ". */
  detail?: string;
  /** "Set the ladder" (head and admin only) beside an escalation nobody was told about. */
  link?: { to: string; label: string };
};

export type TicketModel = {
  /** "Open tickets" back to `/desk`. */
  back: { to: string; label: string };
  /** The machine label, or the ref for a work request; the h1. */
  title: string;
  /** The ref chip beside the title; null for a work request (the title is already the ref). */
  ref: string | null;
  /** Kind (live only), status, report (closed breakdown/support only), lockout, in that order. */
  chips: TicketChip[];
  /** "category · cell", snapshot first; null when neither is known. */
  machineLine: string | null;
  problem: string;
  /** "Acknowledged by {who} · {time}" from the newest acknowledge event; null when never acknowledged. */
  acknowledgedBy: string | null;
  facts: TicketFact[];
  /** The breakdown report card's rows; null with no report or with a PM report (the View keeps `PmReportCard`). */
  report: { heading: string; rows: TicketFact[] } | null;
  /** "Send on WhatsApp" with its wa.me link. */
  share: { label: string; href: string };
  /** The "Minutes" card; null when the ticket has no figures yet. */
  minutes: { heading: string; figures: MinuteFigure[] } | null;
  people: { heading: string; rows: PersonLine[]; empty: string };
  history: { heading: string; rows: HistoryLine[]; empty: string };
  /** Section takeaways (ADR 0023): `ticket.minutes` and `ticket.people`; null when there is nothing to say. */
  takeaways: Takeaways & {
    'ticket.minutes': TakeawayData | null;
    'ticket.people': TakeawayData | null;
  };
};

/** The registry params: the ticket id from the route. */
export type TicketQuery = { id: string };

/**
 * The action bar for this login, in v1's order (wraps `actionSpecs`, `actorFrom`, `crewFrom`): [] with no login, no
 * acting person, an unknown role or the board login, and on a closed or cancelled ticket.
 */
export function allowedActions(detail: TicketDetail, me: Me | undefined): ActionSpec[] {
  const actor = me ? actorFrom(me) : null;
  return actor ? actionSpecs(detail.ticket, crewFrom(detail.people), actor) : [];
}

/** What `LockoutGate` needs: the acting person and `lockoutView` over the offered actions (moved from v1 TicketDetail). */
export function lockoutFor(
  detail: TicketDetail,
  me: Me | undefined,
): { personId: string; view: LockoutView | null } {
  const { ticket, people } = detail;
  const personId = me?.actingPersonId ?? '';
  if (!personId || !me || !actorFrom(me)) return { personId, view: null };
  const onCrew =
    ticket.leadPersonId === personId ||
    people.some((member) => member.personId === personId && !member.leftAt);
  const offered = allowedActions(detail, me).map((spec) => spec.action);
  return {
    personId,
    view: lockoutView({
      lockout: ticket.lockout,
      status: ticket.status,
      personId,
      onCrew,
      offered,
    }),
  };
}

/** A closed breakdown or support ticket has its report ('with') or still needs it ('needs'); otherwise null. */
export function reportState(detail: TicketDetail): 'with' | 'needs' | null {
  const { ticket, report } = detail;
  if (ticket.status !== 'closed' || ticket.kind === 'general') return null;
  if (report || ticket.closeKind === 'report') return 'with';
  return ticket.closeKind === 'no_report' ? 'needs' : null;
}

/** Whether the page shows the report form's context (a config and an acting person), as v1's `Controls` did. */
export function hasReportContext(config: Config | undefined, me: Me | undefined): boolean {
  return Boolean(config && me?.actingPersonId);
}
