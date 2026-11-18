import type { AnalyticsProfile } from '@uptimo/shared';
import type { EngineData } from '../analytics/types.js';

/**
 * The whole-data-set workbook's input (ticket 45, packet 45c-2): the plant rows the engines already read, the
 * profile's numbers, the tenant's name, and the registers the engine's `EngineData` does not shape yet (the PM plan
 * and reports, the plant's Settings lists, the per-report spare-cost slots). `workbookSheets` turns it into the
 * platform's 17 sheets; the xlsx writer (45c-1) only sees names and rows.
 */

/** One workbook cell, the writer's three kinds: text, a number, or a blank. */
export type ExportCell = string | number | null;

/** One row, in column order. */
export type ExportRow = readonly ExportCell[];

/** One sheet in the workbook's order: its tab name and every row, the header row included. */
export interface ExportSheet {
  readonly name: string;
  readonly rows: readonly ExportRow[];
}

/** One Settings team row: the plant's name and its kind (`Team` or `Vendor`). */
export interface ExportTeamMember {
  readonly name: string;
  readonly type: string;
}

/** The plant's owned Settings lists, in the order the platform's Settings sheet prints them. */
export interface ExportSettings {
  readonly segments: readonly string[];
  readonly categories: readonly string[];
  readonly conventionalCategories: readonly string[];
  readonly processCategories: readonly string[];
  readonly utilityCategories: readonly string[];
  readonly shifts: readonly string[];
  readonly locations: readonly string[];
  readonly cells: readonly string[];
  readonly breakdownCategories: readonly string[];
  readonly team: readonly ExportTeamMember[];
}

/** One planned preventive-maintenance visit (the platform's `pmPlan`). */
export interface ExportPmPlan {
  readonly id: string;
  readonly machineId: string;
  readonly date: string;
  readonly source: string;
  readonly done?: string | null;
  readonly target?: string | null;
  readonly machineShift?: boolean;
  readonly routine?: boolean;
}

/** One completed PM report (the platform's `pmReports`). */
export interface ExportPmReport {
  readonly id: string;
  readonly machineId: string;
  readonly date: string;
  readonly planDate?: string | null;
  readonly doneBy?: string | null;
  readonly total?: number | null;
  readonly undone?: readonly number[];
  readonly measurements?: Readonly<Record<string, string>>;
  readonly comments?: readonly string[];
  readonly measComment?: string | null;
  readonly remarks?: string | null;
  readonly reviewedBy?: string | null;
  readonly prodSup?: string | null;
  readonly maintSup?: string | null;
  /** The record as the platform stored it; the PM Reports sheet's last column prints its JSON. */
  readonly data?: unknown;
}

export interface ExportData {
  /** The tenant's printed name: every register sheet's first row. */
  readonly tenant: string;
  /** The plant date the whole sheet set is frozen at. */
  readonly asOf: string;
  readonly profile: AnalyticsProfile;
  readonly data: EngineData;
  readonly settings: ExportSettings;
  readonly pmPlan?: readonly ExportPmPlan[];
  readonly pmReports?: readonly ExportPmReport[];
  /** A report's three spare-cost slots by report id; a missing slot prints blank. */
  readonly spareCosts?: Readonly<Record<string, readonly (number | null)[]>>;
}
