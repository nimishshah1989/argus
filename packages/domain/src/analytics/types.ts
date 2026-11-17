import type { AnalyticsProfile, DrillType } from '@uptimo/shared';

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
  spareUsed: string | null;
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
 * The plant's own settings that a figure needs beside its rows: the legacy platform kept both in Settings, and a
 * figure that ports its numbers reads them here. Optional, so a tenant that never set them reads the defaults.
 */
export interface EngineSettings {
  /** Machines left out of breakdown hours, MTTR, BD % and availability (they stay in the fleet totals). */
  excludedMachineIds: readonly string[];
  /** Manual problem-group fixes from the legacy App Settings, by breakdown report id (ticket 41 owns the screen). */
  problemFixes: Readonly<Record<string, string>>;
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
  figures: FigureResult[];
}
