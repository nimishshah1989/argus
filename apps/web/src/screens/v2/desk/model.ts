import type { TaskState } from '@uptimo/shared/tasks';
import type { Config, Me, State, Ticket } from '../../../api.js';
import type { ActionSpec } from '../../../components/actionSpecs.js';
import type { Takeaways } from '../../../ui/v2/takeaway.js';
import type { ChipFilter } from '../../desk/openLists.js';

/** The three desk lists. */
export type DeskView = 'open' | 'mine' | 'team';

/** The Open screen's segments, Breakdowns first. */
export type Segment = 'breakdowns' | 'tasks' | 'work';

/** Section ids of the Open screen's takeaways (`model.takeaways` keys). */
export type OpenSection = 'desk.breakdowns' | 'desk.tasks';

/**
 * DOMAIN §3 (moved here from v1 `desk/Shell.tsx`): technician, supervisor, head and admin open all three lists;
 * the plant head opens Open and Team, not Mine; every other role (operator, board) opens none.
 */
export function mayOpen(view: DeskView, role: string): boolean {
  void view;
  void role;
  throw new Error('not implemented');
}

/** Today where the plant is, `YYYY-MM-DD` (moved here from v1 `desk/TasksList.tsx`). */
export function plantToday(timeZone: string, now: Date): string {
  void timeZone;
  void now;
  throw new Error('not implemented');
}

/** "Plant settings" and "Settings" links: admin and head only (not plant head). */
export function showsSettings(role: string | undefined): boolean {
  void role;
  throw new Error('not implemented');
}

/** What the Open adapter reads: the `/state`, `/config` and `/auth/me` replies plus the screen's own choices. */
export type OpenInput = {
  state: State;
  config: Config | undefined;
  me: Me | undefined;
  filter: ChipFilter;
  segment: Segment;
};

/** One tile of the "Machine status" strip. `pressed` is the tile the lists are filtered by. */
export type CountTile = {
  id: Exclude<ChipFilter, ''>;
  label: string;
  value: number;
  tone: 'danger' | 'hold' | 'warning' | 'ok';
  pressed: boolean;
};

/** A ticket card drawn by `components/TicketCard.tsx`; `longest` puts the "Longest" tag on it. */
export type OpenCard = {
  ticket: Ticket;
  machine: string;
  quick: ActionSpec | null;
  longest: boolean;
};

/** A follow-up task card: state pill, "reason · expected date" line, "Left by …" or "Follow-up task". */
export type TaskCard = {
  ticket: Ticket;
  machine: string;
  state: TaskState;
  overdue: boolean;
  line: string;
  meta: string;
};

/** A "Closed without a report" card: "Closed {at} by {who}" and its Fill report link. */
export type ReportCard = { ticket: Ticket; machine: string; meta: string };

/** A list under a hint line, or its empty sentence. */
export type CardBlock<C> = { hint: string; empty: string; cards: C[] };

/** Everything the Open screen draws (`/desk`), ready to print. */
export type OpenModel = {
  /** Breakdown count for the Open tab's badge. */
  badge: number;
  settings: boolean;
  counts: CountTile[];
  /** "Showing machines down. Tap to show all." while a Down/Waiting/Support tile is pressed, else null. */
  showing: string | null;
  /** "Team now: nobody on a job" / "Team now: 1 on a job" / "Team now: n on jobs". */
  teamNow: string;
  segment: Segment;
  segments: { id: Segment; label: string; pressed: boolean }[];
  breakdowns: CardBlock<OpenCard> & { paused: { heading: string; cards: OpenCard[] } | null };
  tasks: CardBlock<TaskCard>;
  work: CardBlock<OpenCard>;
  /** "Closed without a report (n)"; null when there are none. */
  needsReport: { heading: string; hint: string; cards: ReportCard[] } | null;
  /** UX rule 60: one computed line per section; null when there is nothing worth saying. */
  takeaways: Takeaways;
  /** The words the View prints that are not list data. */
  words: { longest: string; pickTicket: string; ticketPane: string; fillReport: string };
};
