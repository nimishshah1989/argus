import type { Config, Me, State, Ticket, TicketListQuery } from '../../../api.js';
import type { ActionSpec } from '../../../components/actionSpecs.js';
import type { Takeaways } from '../../../ui/v2/takeaway.js';

/**
 * The Team tab's Waiting list (moved here from v1 `desk/TeamPanel.tsx`): paused tickets only, the one waiting
 * longest first (the server sends newest first).
 */
export function waitingFirst(tickets: Ticket[]): Ticket[] {
  void tickets;
  throw new Error('not implemented');
}

/**
 * Mine's `/tickets` query (v1 `MinePanel.tsx`): working, waiting and closed jobs of the acting person; a shared
 * (kiosk) login drops `personId` and lists everyone's.
 */
export function mineQuery(me: Me | undefined): TicketListQuery {
  void me;
  throw new Error('not implemented');
}

/** One `useTicketWindow` read as the adapters see it (`error` already turned into words). */
export type WindowRead = { items: Ticket[]; loading: boolean; error: string | null };

/** A plain ticket row linking to `/desk/:id`: ref, machine, a detail line and a time on the right. */
export type TicketRowItem = {
  id: string;
  ref: string;
  machine: string;
  detail: string;
  /** "2 h 24 min ago", "45 min"; "—" when the figure is unknown, never "0 min". */
  time: string;
};

/** A section filled by its own `/tickets` window: loading, its error, or its rows (empty → `empty`). */
export type WindowBlock = {
  state: 'loading' | 'error' | 'ready';
  error: string | null;
  rows: TicketRowItem[];
  empty: string;
};

/** A full ticket card on Mine, drawn by `components/TicketCard.tsx` with its one quick button. */
export type MineCard = { ticket: Ticket; machine: string; quick: ActionSpec | null };

/** What the Mine adapter reads: the Mine window, the login and `/config`. `now` is ISO. */
export type MineInput = {
  mine: WindowRead;
  me: Me | undefined;
  config: Config | undefined;
  now: string;
};

/** Everything `/desk/mine` draws under its title, ready to print. */
export type MineModel = {
  /** The Mine window: loading (and nothing read yet), its error, or ready. */
  state: 'loading' | 'error' | 'ready';
  error: string | null;
  now: string;
  names: Record<string, string>;
  inProgress: MineCard[];
  waiting: MineCard[];
  /** My closed jobs of the last 30 days, newest first, every page. */
  closed: TicketRowItem[];
  /** "Nothing assigned to you." when In progress and Waiting are both empty; else null. */
  empty: string | null;
  /** The day report: `/api/v1/reports/day.pdf?date=YYYY-MM-DD` and the file name `day-report-YYYY-MM-DD.pdf`. */
  dayReport: { href: string; file: string };
  words: {
    inProgress: string;
    waiting: string;
    closed: string;
    none: string;
    dayReport: string;
    dayReportError: string;
  };
};

/** One lead in "Working now": their name, hands-on minutes on their working jobs, and those jobs. */
export type WorkingCard = {
  personId: string;
  name: string;
  minutes: string;
  jobs: { id: string; ref: string; machine: string }[];
};

/** One month of "Monthly totals per person": each person's primary minutes, and support minutes when any. */
export type MonthBlock = {
  /** `YYYY-MM`. */
  month: string;
  /** "November 2026". */
  label: string;
  rows: { personId: string; name: string; primary: string; support: string | null }[];
};

/** What the Team adapter reads: `/state` (live sections), `/config`, and the two `/tickets` windows. */
export type TeamInput = {
  state: State;
  config: Config | undefined;
  cancelled: WindowRead;
  closed: WindowRead;
  now: string;
};

/** Section id of the Team screen's one takeaway (`takeaways` key). */
export type TeamSection = 'desk.team';

/** Everything `/desk/team` draws under its title, ready to print. */
export type TeamModel = {
  /** Leads on a working job, most hands-on minutes first. */
  working: WorkingCard[];
  /** Paused jobs, longest wait first; detail = the wait reason's list label, time = minutes waited. */
  waiting: TicketRowItem[];
  /** Open jobs nobody started; detail = the problem, time = since reported. */
  notStarted: TicketRowItem[];
  cancelled: WindowBlock;
  closed: WindowBlock & { months: MonthBlock[] };
  /** `desk.team`: who is on the longest working job, its minutes and machine; null when nobody is working. */
  takeaways: Takeaways;
  words: {
    workingNow: string;
    waiting: string;
    notStarted: string;
    cancelled: string;
    closed: string;
    monthly: string;
    none: string;
    /** "Nobody is working right now." */
    nobody: string;
  };
};
