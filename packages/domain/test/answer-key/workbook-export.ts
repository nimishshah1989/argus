import { DEFAULT_PROFILE } from '@uptimo/shared';
import type { ExportData, ExportPmPlan, ExportPmReport } from '../../src/index.js';
import { ENGINE_DATA, read } from './fixture.js';
import type { Workbook } from './workbook.js';

/**
 * The whole-data-set workbook (ticket 45, packet 45c-2): the frozen key beside the 11 November workbook mapped into
 * the export's own input. The key pins every sheet's name, header row and data-row count; the rows below it come from
 * the plant data through the domain's own figures, never from literals. `App Settings` is not written (open question
 * 4): our settings live in typed tables, and nothing reads that sheet back.
 */

export interface WorkbookKeySheet {
  name: string;
  header: string[];
  dataRows: number;
}

export interface WorkbookKey {
  screen: string;
  asOf: string;
  sheets: WorkbookKeySheet[];
}

/** The platform's 18 sheets, frozen on 2026-11-11; 17 are ours (all but `App Settings`). */
export const WORKBOOK_KEY: WorkbookKey = read<WorkbookKey>('workbook-export.json');

interface PmPlanInput {
  id: string;
  machineId: string;
  date: string;
  source: string;
  done?: string;
  target?: string;
  viaMove?: boolean;
  routine?: boolean;
}

interface PmReportInput {
  id: string;
  machineId: string;
  date: string;
  planDate?: string;
  doneBy?: string;
  total?: number;
  undone?: number[];
  meas?: Record<string, string>;
  comments?: string[];
  measComment?: string;
  remarks?: string;
  reviewedBy?: string;
  prodSup?: string;
  maintSup?: string;
}

/** `input.json` carries more settings lists and the PM plan/reports than the engine's fixture maps (ticket 45). */
interface ExportInput extends Omit<Workbook, 'settings'> {
  settings: Workbook['settings'] & {
    segments: string[];
    categories: string[];
    convCategories: string[];
    procCategories: string[];
    utilCategories: string[];
    shifts: string[];
    locations: string[];
    cells: Array<string | number>;
    breakdownCategories: string[];
  };
  pmPlan: PmPlanInput[];
  pmReports: PmReportInput[];
}

const workbook = read<ExportInput>('input.json');

const number = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** The platform's three spare-cost slots for a report, by report id. */
function spareCosts(): Record<string, Array<number | null>> {
  const rows = [...workbook.breakdowns, ...workbook.otherBD];
  return Object.fromEntries(
    rows.map((row) => [row.id, [number(row.cost1), number(row.cost2), number(row.cost3)]]),
  );
}

const PM_PLAN: ExportPmPlan[] = workbook.pmPlan.map((row) => ({
  id: row.id,
  machineId: row.machineId,
  date: row.date,
  source: row.source,
  done: row.done ?? null,
  target: row.target ?? null,
  machineShift: row.viaMove === true,
  routine: row.routine === true,
}));

const PM_REPORTS: ExportPmReport[] = workbook.pmReports.map((row) => ({
  id: row.id,
  machineId: row.machineId,
  date: row.date,
  planDate: row.planDate ?? null,
  doneBy: row.doneBy ?? null,
  total: row.total ?? null,
  undone: row.undone ?? [],
  measurements: row.meas ?? {},
  comments: row.comments ?? [],
  measComment: row.measComment ?? null,
  remarks: row.remarks ?? null,
  reviewedBy: row.reviewedBy ?? null,
  prodSup: row.prodSup ?? null,
  maintSup: row.maintSup ?? null,
  data: row,
}));

/** The plant's own Settings lists, in the order the platform's Settings sheet prints them. */
export const EXPORT_DATA: ExportData = {
  tenant: 'COSMOS ENGITECH PVT. LTD.',
  asOf: WORKBOOK_KEY.asOf,
  profile: DEFAULT_PROFILE,
  data: ENGINE_DATA,
  spareCosts: spareCosts(),
  settings: {
    segments: workbook.settings.segments,
    categories: workbook.settings.categories,
    conventionalCategories: workbook.settings.convCategories,
    processCategories: workbook.settings.procCategories,
    utilityCategories: workbook.settings.utilCategories,
    shifts: workbook.settings.shifts,
    locations: workbook.settings.locations.map(String),
    cells: workbook.settings.cells.map(String),
    breakdownCategories: workbook.settings.breakdownCategories,
    team: workbook.settings.team.map((member) => ({ name: member.name, type: member.type })),
  },
  pmPlan: PM_PLAN,
  pmReports: PM_REPORTS,
};
