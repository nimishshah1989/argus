import type { Machine, Ticket } from '../../../api.js';
import type { RowStatus } from '../../../faces/floor/machines.js';
import type { FloorData } from '../../../faces/floor/use-floor.js';

/**
 * S27 Floor, report flow (`/floor`, `/floor/other`), ADR 0045 T1. Floor keeps exactly v1's behaviour (decision 6):
 * these types are what the View draws, every word already translated; the rules below are v1's, moved out of the
 * deleted v1 views. The machine search, groups, row status and recent machines stay in `faces/floor/machines.ts`
 * and `use-floor.ts` and are imported, not copied.
 */

/** The gallery's ask: the floor of a maintenance login (PM jobs tab, start-now box) or not. */
export type FloorQuery = { maintenance?: boolean };

/** The floor's tabs. PM jobs is maintenance only. */
export type FloorTabKey = 'report' | 'mine' | 'pm';
export type FloorTab = { key: FloorTabKey; to: string; label: string };
/** The tab bar: its accessible name ("Floor"), the tabs in order, and the one the path lights. */
export type TabsModel = { label: string; tabs: FloorTab[]; current: FloorTabKey };

/** One machine row: the code first (its button name starts with it), the detail line, the live status pill. */
export type MachineRowModel = {
  id: string;
  code: string;
  /** "Already reported. Tap to view the ticket." / "Needs support. Tap to say it has stopped." / "group · cell". */
  detail: string;
  status: RowStatus;
  opens: 'sheet' | 'situation';
};
export type GroupTileModel = { id: string; code: string; name: string; count: string };
export type SegmentModel = { id: string; title: string; count: number; groups: GroupTileModel[] };

/** Step 1 before a group is open: hint, search, recent chips, Other work card, the segments, the search rows. */
export type BrowseModel = {
  kind: 'browse';
  title: string;
  hint: string;
  findLabel: string;
  findPlaceholder: string;
  query: string;
  recentLabel: string;
  /** At most 3, newest first, unknown ids dropped; empty while the query is not blank. */
  recent: { id: string; code: string }[];
  /** The "Other work (not a machine)" card; null while the query is not blank. */
  other: { title: string; detail: string } | null;
  /** Empty while the query is not blank. */
  segments: SegmentModel[];
  rows: MachineRowModel[];
  /** The no-match line, only for a non-blank query that found nothing. */
  noMatch: string | null;
};
/** Step 1 inside a group: title "CODE Name", back "Groups", the number-only field. */
export type GroupStepModel = {
  kind: 'group';
  title: string;
  back: string;
  idLabel: string;
  placeholder: string;
  hint: string;
  query: string;
  rows: MachineRowModel[];
};

/** Step 2: the machine card, the banners it carries, the two choices. */
export type SituationModel = {
  title: string;
  back: string;
  machine: { label: string; code: string; detail: string };
  /** "This machine already has a support ticket, REF." under the title "Needs support". */
  support: { title: string; text: string } | null;
  /** "This machine has a follow-up task" and one "REF · reason · expected DATE" line per pending task. */
  tasks: { title: string; lines: string[] } | null;
  stopped: { title: string; detail: string };
  running: { title: string; detail: string };
  /** On a support ticket "Still running, needs support" opens that ticket's sheet instead of Step 3. */
  runningOpensSheet: boolean;
};

/** Who sends it: maintenance gets the start-now checkbox, everyone else reads "Reporting as Name (Title)". */
export type WhoModel =
  { kind: 'startNow'; label: string; checked: boolean } | { kind: 'reportingAs'; text: string };

/** Step 3: what is wrong, the quick chips, who, and the Send that names the situation. */
export type ProblemModel = {
  title: string;
  back: string;
  code: string;
  kind: 'stopped' | 'support';
  /** Support → stopped: the old problem shown instead of the box; nothing typed, Send enabled. */
  upgradeText: string | null;
  label: string;
  placeholder: string;
  problem: string;
  chips: { id: string; label: string; pressed: boolean }[];
  who: WhoModel;
  action: string;
  ready: boolean;
};

/** A ticket's facts card (Sent and the ticket sheet). */
export type TicketFactsModel = {
  place: string;
  status: RowStatus;
  /** "Ticket number REF". */
  number: string;
  problem: string;
  /** "Reported HH:MM by Name (Title)". */
  reported: string;
};
export type SentModel = {
  title: string;
  /** "CODE now shows on the live board as stopped." — a stopped ticket only. */
  onLive: string | null;
  facts: TicketFactsModel;
  another: string;
  seeMine: string;
};
/** The read-only ticket sheet, a dialog named by the place. */
export type TicketSheetModel = { title: string; facts: TicketFactsModel; started: string };

/** The whole report flow for one render. */
export type ReportModel = {
  title: string;
  /** 1 when a deep link named a known machine, else 0. */
  start: 0 | 1;
  machine: BrowseModel | GroupStepModel;
  /** Null until a machine is picked. */
  situation: SituationModel | null;
  problem: ProblemModel;
  sent: SentModel | null;
  sheet: TicketSheetModel | null;
};

/** The Other work form, as typed. */
export type OtherWorkForm = {
  place: string;
  typed: string;
  workType: string;
  needed: string;
  urgent: boolean;
};
export const EMPTY_OTHER_WORK: OtherWorkForm = {
  place: '',
  typed: '',
  workType: '',
  needed: '',
  urgent: false,
};

/** `/floor/other`: one step, aside "Work request", back "Report". */
export type OtherWorkModel = {
  title: string;
  stepTitle: string;
  aside: string;
  back: string;
  intro: string;
  where: { label: string; choose: string; places: string[]; typedLabel: string };
  workType: { label: string; choose: string; types: string[] };
  needed: { label: string; placeholder: string };
  urgency: { label: string; normal: string; urgent: string };
  form: OtherWorkForm;
  who: WhoModel;
  action: string;
  ready: boolean;
  sent: SentModel | null;
};

/** What the screen shows before the floor data is in: its shape, or why it failed and Try again. */
export type FloorWaiting = 'loading' | 'error' | 'offline';

/** The tabs a login gets: Report and My complaints; PM jobs only when `maintenance` is true (not while loading). */
export function floorTabKeys(maintenance: boolean | undefined): FloorTabKey[] {
  return maintenance === true ? ['report', 'mine', 'pm'] : ['report', 'mine'];
}

/** The tab a path lights: `/floor/mine` → mine, `/floor/pm` → pm, anything else (Other work too) → report. */
export function currentTab(pathname: string): FloorTabKey {
  return pathname === '/floor/mine' ? 'mine' : pathname === '/floor/pm' ? 'pm' : 'report';
}

/** A tap on a machine: an open breakdown (not a support ticket) opens its sheet; else Step 2. */
export function rowOpens(ticket: Ticket | undefined): 'sheet' | 'situation' {
  return ticket && ticket.kind !== 'support' ? 'sheet' : 'situation';
}

/** The step the flow opens on: Step 2 (1) when the deep link found a machine. */
export function startStep(machine: Machine | null): 0 | 1 {
  return machine ? 1 : 0;
}

/** What a ticket is about on the floor: its machine's code, else the place for other work, else ''. */
export function ticketPlace(data: FloorData, ticket: Ticket): string {
  return data.config.machines.find((m) => m.id === ticket.machineId)?.code ?? ticket.location ?? '';
}

/** "Name (Title)" (or "Name") of the person who reported it; '' when the plant does not list them. */
export function reporterName(data: FloorData, ticket: Ticket): string {
  const person = data.config.people.find((x) => x.id === ticket.reportedByPersonId);
  if (!person) return '';
  return person.title ? `${person.name} (${person.title})` : person.name;
}

/** Send may be pressed on Step 3: an upgrade, or a problem that is not blank once trimmed. */
export function sendReady(upgrade: boolean, problem: string): boolean {
  return upgrade || problem.trim().length > 0;
}

/** The place an Other work request is sent for: the typed place (trimmed) wins over the picked cell. */
export function otherWorkLocation(form: OtherWorkForm): string {
  return form.typed.trim() || form.place;
}

/** Send work request may be pressed: a place, a type of work and a need (trimmed). */
export function otherWorkReady(form: OtherWorkForm): boolean {
  return Boolean(otherWorkLocation(form) && form.workType && form.needed.trim());
}

/** Before the data is in: still loading until there is an error; a failed load reads offline when the phone is. */
export function floorWaiting(error: unknown, online: boolean): FloorWaiting {
  if (!error) return 'loading';
  return online ? 'error' : 'offline';
}
