import type { AnalyticsProfile, DrillType } from '@uptimo/shared';
import type { Period } from './availability.js';
import type { PlantEventRow } from './plant-events.js';
import type { ProblemGroup } from './problem-groups.js';

/**
 * The plain rows the engines read, shaped for the engines and not for the tables. A person is a code and a
 * team, never a name or phone. Every row carries the database `id` so a figure can name the rows it came from.
 * Dates are plant dates (`YYYY-MM-DD`) and instants are ISO text, so a fixture is JSON.
 */
export interface MachineRow {
  id: string;
  code: string;
  segment: string | null;
  category: string | null;
  cell: string | null;
  location: string | null;
  make: string | null;
  model: string | null;
  controller: string | null;
  /** The nameplate fields the machine page prints (ticket 39); the database columns exist, the fixture fills them. */
  serial?: string | null;
  controllerModel?: string | null;
  controllerSerial?: string | null;
  year: number | null;
  purchasedOn: string | null;
  powerKw: number | null;
  capacityKva: number | null;
  assetCode: string | null;
  status: 'active' | 'idle' | 'scrapped';
  criticality: 'A' | 'B' | 'C' | null;
  /**
   * The plant leaves this machine out of production data (the Robot, and any machine excluded in Settings): it stays
   * in the fleet totals, the breakdown log and the expansion timeline, but no production figure reads its breakdowns
   * or adds its available hours (breakdown percent, availability, MTTR/MTBF, footprint, reports).
   */
  excludedFromProduction: boolean;
  /** What the plant keeps beside the columns: footprint, conveyor side and the like (ticket 39 reads it). */
  metadata: Record<string, unknown>;
}

export interface MoveRow {
  id: string;
  machineId: string;
  fromCell: string | null;
  toCell: string | null;
  /** The locations the move carried (0014); absent on a row written before the column existed. */
  fromLocation?: string | null;
  toLocation?: string | null;
  effectiveFrom: string;
}

export interface PersonRow {
  id: string;
  /** A stable pseudonym (`P-` and eight characters of the id); the engine never sees a name. */
  code: string;
  /** The coded name the platform prints (`Person 41`, `Maint. Team`); never a real name. */
  displayName: string;
  team: 'maintenance' | 'production' | 'vendor';
  active: boolean;
}

/** The report written when a breakdown is closed (a history ticket carries the same fields). */
export interface ReportRow {
  id: string;
  ticketId: string | null;
  machineId: string;
  date: string;
  shift: string;
  problem: string;
  downtimeMin: number;
  responseMin: number | null;
  repairMin: number | null;
  category: string | null;
  maintCode: string | null;
  /** The first spare the row used (`spare1`); a figure that counts part names reads `spares` where it exists. */
  spareUsed: string | null;
  /**
   * Every spare the row names (`spare1` to `spare3`), in the log's order. The Team Focus spares lane counts a part
   * when any of the three names it, so a row written before this field reads `spareUsed` alone.
   */
  spares?: readonly string[];
  rootCause: string | null;
  doneBy: string[];
  supportedBy: string[];
  /** What the team did (`corrective_action`); the problem grouping reads it when the problem text says nothing. */
  correctiveAction?: string | null;
  /**
   * The legacy platform's recorded-hours column, where the source has one. The plant stores minutes and this
   * column can disagree with them by a rounding or a typo, so a figure that ports the platform's own number reads
   * it when present and falls back to `downtimeMin / 60` when it is not.
   */
  recordedHours?: number | null;
  /**
   * The three spare costs the platform's Action Center adds up, in rupees (ticket 44); the column exists, the loader
   * does not read it yet, so a live row reads undefined and the spares rule sees nothing.
   */
  spareCost?: number | null;
  /** The platform's three spare-cost slots in the log's order; the stored row has one sum today. */
  spareCosts?: readonly (number | null)[];
  /**
   * The legacy platform's stable log number (its "Sr No"), where the source recorded one: the Breakdown Log prints
   * it. A log the platform numbered itself has gaps here (deleted entries keep their number), so a figure must
   * never renumber one from the row's position; a row with no number gets its place in date order instead.
   */
  srNo?: number | null;
  /** Who saw it (`observed_by`); the data checklist asks only whether the field is empty, never prints it. */
  observedBy?: string | null;
}

export interface TicketRow {
  id: string;
  ref: string;
  kind: 'stopped' | 'support' | 'general';
  status: 'open' | 'working' | 'waiting' | 'closed' | 'cancelled';
  machineId: string | null;
  reportedAt: string;
  closedAt: string | null;
  /** `history` for a ticket loaded from the old log (`import`, `backfill`), `live` for the rest. */
  source: 'live' | 'history';
  downtimeMin: number | null;
  repairMin: number | null;
  workType: string | null;
  /**
   * The channel the work came in through (`raised_channel`): 46c's shared predicate reads it, so planned work is
   * told apart from a live breakdown without a second field (ticket 50b). Optional: a fixture that predates the
   * field reads as no channel at all.
   */
  raisedChannel?: string | null;
  /**
   * The planned job's scheduled plant date, `task_expected_on` (50 R11): a PM job's due or moved day, an
   * inspection's target. NULL on a live breakdown; a ticket with none falls back to its reported day (R6).
   */
  scheduledOn?: string | null;
}

/** A follow-up job under a ticket: a ticket with a parent. */
export interface TaskRow extends TicketRow {
  parentId: string;
  reason: string | null;
  expectedOn: string | null;
}

export interface ListRow {
  code: string;
  label: string;
  active: boolean;
}

/**
 * One saved Why-Why record (the ticket-36 home's `why_why` payload): the five whys, the conclusion, and the
 * author and plant date the platform keeps beside it. A person is a code, never a name.
 */
export interface WhyWhyRow {
  ticketId: string;
  whys: readonly [string, string, string, string, string];
  conclusion: string;
  completedBy: string;
  /** The plant date (`YYYY-MM-DD`) the record was completed on. */
  completedDate: string;
}

/** The cause a person decided for one breakdown on a young machine (ADR 0051): the latest `oem_cause` event. */
export interface OemCauseRow {
  ticketId: string;
  cause: 'oem' | 'install' | 'ours' | 'undecided';
}

/**
 * One saved Action Center acknowledgement (ticket 44): the status the plant chose for one nudge key, who owns it,
 * the plant date it is due, a note and the instant it was saved. A snooze also carries the instant it opens again.
 * Times are ISO instants and the due date is a plant date or `''`.
 */
export interface NudgeAck {
  status: 'ack' | 'snooze' | 'done';
  owner: string;
  due: string;
  note: string;
  at: string;
  until?: string;
}

/** One external AMC or extended-warranty line (ticket 44's reminder rule; M4b's register fills it). */
export interface AmcLine {
  id: string;
  machineId: string;
  type: string | null;
  /** The plant date the contract starts, or null when the plant has not entered one. */
  start: string | null;
  months: number;
  vendor: string | null;
  noRenew: boolean;
  /**
   * The last day the register stored, when a live row carries one (51c). The reminder and the sheet prefer it
   * over the start-and-tenure arithmetic, which the register does not store.
   */
  endsOn?: string;
  /** The register row this line came from (51c): two rows for one item are two identities. */
  itemKey?: string;
}

/** One legal test or calibration line: what is tested, when it was last done and how long it stays valid. */
export interface LegalLine {
  id: string;
  machineId: string;
  tid: string;
  name: string;
  form: string | null;
  /** The plant date of the last test, or null when no test is on record. */
  last: string | null;
  months: number;
  cert: string | null;
  /** The next due day the register stored, when a live row carries one (51c); preferred over the tenure. */
  dueOn?: string;
  /** The register row this line came from (51c); the row, not its type, is the item's identity. */
  itemKey?: string;
}

/**
 * One row of the plant's shift settings as the working-hours basis reads it: minutes from local midnight, the
 * direction the row says it runs, and whether the floor is offered it. The standard family's calendar is the union
 * of the active windows, so a shifted-off window is no working time (ticket 48, R2).
 */
export interface ShiftRow {
  code: string;
  name: string;
  startMinute: number;
  endMinute: number;
  crossesMidnight: boolean;
  active: boolean;
}

/**
 * The plant's own settings that a figure needs beside its rows: the legacy platform kept both in Settings, and a
 * figure that ports its numbers reads them here. Optional, so a tenant that never set them reads the defaults.
 */
export interface EngineSettings {
  /** Machines left out of breakdown hours, MTTR, BD % and availability (they stay in the fleet totals). */
  excludedMachineIds: readonly string[];
  /** Manual problem-group fixes from the legacy App Settings, by breakdown report id (ticket 41 owns the screen). */
  problemFixes: Readonly<Record<string, string>>;
  /**
   * The Settings team list, in its own order: what A4 tracks. The platform keeps the vendor and inactive members
   * "for historical completeness", so the list is the plant's, not a filter over the people rows (R6).
   */
  teamCodes?: readonly string[];
  /**
   * The plant's machine categories, in the Settings order: A4's Specialization prints every entry except Robot,
   * including one with no machines (an all-dash column). Absent falls back to the fleet's categories.
   */
  categories?: readonly string[];
  /** The plant's cells, in the Settings order (A5 buckets by this list, not by machines' first appearance). */
  cells?: readonly string[];
  /** The plant's locations, in the Settings order; a machine whose location is unlisted belongs to no bucket. */
  locations?: readonly string[];
  /** The plant's edited problem-group list; absent reads the platform default (`PROBLEM_GROUPS`), never a subset. */
  problemGroups?: readonly ProblemGroup[];
  /** The Action Center's saved acknowledgements, by the platform's nudge key (ticket 44). */
  nudgeAcks?: Readonly<Record<string, NudgeAck>>;
  /** How many days before an AMC ends the Action Center warns; the platform's default is 15. */
  amcRemindDays?: number;
  /** How many days before a legal test is due the Action Center warns; the platform's default is 15. */
  legalRemindDays?: number;
  /**
   * The plant date the platform's figures start from (ADR 0027): a run that names no span reads nothing before it, so
   * loading older history moves no figure. Cosmos: `2026-01-01`. Absent: every year counts.
   */
  dataFrom?: string;
}

/**
 * One PM plan as the engine reads it (ticket 50b): the recurrence's target, its interval and its clock. `createdAt`
 * is an ISO instant whose plant-local day is the anchor; `updatedAt` is how the effective plan is chosen when a
 * machine could match more than one (the machine's own plan first, then the newest category plan, 49 R3).
 */
export interface PmPlanRow {
  id: string;
  machineId: string | null;
  category: string | null;
  intervalDays: number | null;
  createdAt: string;
  lastDoneOn: string | null;
  active: boolean;
  updatedAt: string;
}

export interface EngineData {
  /** The plant's IANA time zone. Every date the engines compare is a plant date, made with `plantDay`. */
  timeZone: string;
  machines: MachineRow[];
  moves: MoveRow[];
  tickets: TicketRow[];
  tasks: TaskRow[];
  reports: ReportRow[];
  people: PersonRow[];
  lists: Record<string, ListRow[]>;
  settings?: EngineSettings;
  /** The saved Why-Why records, latest per ticket; a ticket with no record is a candidate A6 shows as not started. */
  whyWhy?: readonly WhyWhyRow[];
  /** The OEM causes people decided, latest per ticket (ADR 0051). Absent or missing a ticket: not decided. */
  oemCauses?: readonly OemCauseRow[];
  /** The plant events (ticket 91): power and air failures, each with the machines it stopped. Absent: none. */
  plantEvents?: readonly PlantEventRow[];
  /**
   * The plant's shift windows (ticket 48). Optional so every fixture and test that builds `EngineData` keeps
   * compiling: with it absent the working-hour basis has no hours and prints dashes (R3).
   */
  shifts?: readonly ShiftRow[];
  /** The external AMC and warranty lines (ticket 44's reminder rule); M4b ticket 51 fills them from the register. */
  amc?: readonly AmcLine[];
  /** The legal test and calibration lines (ticket 44's reminder rule); empty until the register lands. */
  legal?: readonly LegalLine[];
  /**
   * Every PM plan of the plant, switched-off ones too (ticket 50b): the effective plan decides a PM job's tolerance
   * and the workbook's next-due row. Optional, so a fixture with no plans reads every PM ticket at the default ±15.
   */
  pmPlans?: readonly PmPlanRow[];
  /**
   * The span the run was asked for (ticket 76), set by the engine only when a span was named. A figure that reads the
   * span gets the plant cut to it: its reports, machines and moves end at `period.to`, its tickets are all kept. Only
   * `runWith` with a span makes this: a computer called on its own sees none and reads the as-of year to date.
   */
  period?: Period;
  /**
   * Every `YYYY-MM` month the plant recorded nothing in, first record to the run date, except the month still
   * running (it counts only when the run date is its last day); set with `period`.
   */
  gaps?: readonly string[];
}

/** What one figure is: a value the face prints, and the rows behind it. */
export type FigureValue =
  | number
  | string
  | boolean
  | null
  | readonly FigureValue[]
  | { readonly [key: string]: FigureValue };

export interface Computed {
  value: FigureValue;
  /** The ids of the rows the figure came from, all of its registered drill type. */
  drillIds: readonly string[];
}

export interface ComputeInput {
  data: EngineData;
  asOf: string;
  profile: AnalyticsProfile;
}

export type Computer = (input: ComputeInput) => Computed;

export interface FigureResult {
  key: string;
  screen: string;
  owner: number;
  status: 'ready' | 'not_computed';
  value: FigureValue;
  drill: { type: DrillType; ids: string[] };
}

export interface EngineResult {
  asOf: string;
  profile: AnalyticsProfile;
  /** How many rows of each kind the run was given. */
  rows: Record<'machines' | 'moves' | 'tickets' | 'tasks' | 'reports' | 'people', number>;
  /** How many machines the plant leaves out of production data (ticket 77a); 0 when it leaves none out. */
  excludedMachines: number;
  figures: FigureResult[];
  /** The span the figures were computed for, with its gap months; absent when the run named no span. */
  period?: Period;
}
