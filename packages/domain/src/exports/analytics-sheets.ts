import { a1BdPmFigure } from '../analytics/a1-bd-pm.js';
import { a2CategoryCellFigure } from '../analytics/a2-category-cell.js';
import { a3MttrMtbfFigure } from '../analytics/a3-mttr-mtbf.js';
import { a4ManpowerFigure } from '../analytics/a4-manpower.js';
import type { Computed } from '../analytics/types.js';
import {
  ANALYTICS1_HEADER,
  ANALYTICS2_HEADER,
  ANALYTICS3_HEADER,
  ANALYTICS4_HEADER,
} from './headers.js';
import type { ExportData, ExportRow, ExportSheet } from './types.js';

/**
 * The four Analytics sheets (ticket 45, packet 45c-2): the platform's own layout, filled from the domain's A1-A4
 * figures for the run date. Their values are the A1-A4 keys' rows, projected onto the workbook's narrower columns.
 */

interface FigureTable {
  title: string;
  rows: readonly (readonly string[])[];
}
interface FigurePage {
  kpis: readonly { label: string; value: string; sub: string }[];
  tables: readonly FigureTable[];
}

/** A computed figure as the pages the workbook prints; a not-computed figure has no page. */
function figureOf(computed: Computed): FigurePage | null {
  const value = computed.value;
  if (value === null || typeof value !== 'object' || !('pages' in value)) return null;
  const page = (value as unknown as { pages: readonly FigurePage[] }).pages[0];
  return page ?? null;
}

function figureRows(page: FigurePage | null, title: string): readonly (readonly string[])[] {
  return page?.tables.find((table) => table.title === title)?.rows ?? [];
}

function kpiValue(page: FigurePage | null, label: string): string {
  return page?.kpis.find((entry) => entry.label === label)?.value ?? '';
}

function kpiShare(page: FigurePage | null, label: string): string {
  return (page?.kpis.find((entry) => entry.label === label)?.sub ?? '').split(' ')[0] ?? '';
}

/** A figure's printed row without the columns the workbook's layout drops. */
function project(rows: readonly (readonly string[])[], keep: readonly number[]): ExportRow[] {
  return rows.map((row) => keep.map((column) => row[column] ?? ''));
}

function analytics1Sheet(data: ExportData): ExportSheet {
  const page = figureOf(a1BdPmFigure(data));
  const annual = data.profile.prodHrsPerDay * data.profile.workDaysPerYear;
  const summary: ExportRow[] = [
    ['Annual Hrs/Machine', annual],
    ['Total Machines', kpiValue(page, 'Total Machines')],
    ['Total Available Hrs', kpiValue(page, 'Total Available Hrs')],
    ['Actual Breakdown Hours', kpiValue(page, 'Actual Breakdown').replace(' hrs', '')],
    ['Breakdown %', kpiShare(page, 'Actual Breakdown')],
    ['PM Hours', kpiValue(page, 'PM Downtime').replace(' hrs', '')],
    ['PM %', kpiShare(page, 'PM Downtime')],
  ];
  const byCell = project(figureRows(page, 'By Cell — Detail'), [0, 1, 2, 3, 4, 5, 6]);
  return {
    name: 'Analytics 1 - BD%',
    rows: [['ANALYTICS 1 — BD % & PM SPLIT'], [], ...summary, [], ANALYTICS1_HEADER, ...byCell],
  };
}

function analytics2Sheet(data: ExportData): ExportSheet {
  const page = figureOf(a2CategoryCellFigure(data));
  const keep = [0, 1, 2, 3, 5, 6];
  return {
    name: 'Analytics 2 - Category-Cell',
    rows: [
      ['ANALYTICS 2 — BY CATEGORY & CELL'],
      [],
      ANALYTICS2_HEADER,
      ...project(figureRows(page, 'By Category — Detail'), keep),
      [],
      ['Cell', ...ANALYTICS2_HEADER.slice(1)],
      ...project(figureRows(page, 'By Cell — Detail'), keep),
    ],
  };
}

function analytics3Sheet(data: ExportData): ExportSheet {
  const page = figureOf(a3MttrMtbfFigure(data));
  return {
    name: 'Analytics 3 - MTTR-MTBF',
    rows: [
      ['ANALYTICS 3 — MTTR & MTBF'],
      [],
      ANALYTICS3_HEADER,
      ...figureRows(page, 'By Category'),
      [],
      ['Cell', ...ANALYTICS3_HEADER.slice(1)],
      ...figureRows(page, 'By Cell'),
      [],
      ['Age Band', ...ANALYTICS3_HEADER.slice(1)],
      ...figureRows(page, 'By Machine Age Band'),
      [],
      ['Machine ID', 'Category', 'Cell', '# Breakdowns', 'BD Hours', 'MTTR', 'MTBF'],
      ...figureRows(page, 'By Individual Machine'),
    ],
  };
}

function analytics4Sheet(data: ExportData): ExportSheet {
  const page = figureOf(a4ManpowerFigure(data));
  return {
    name: 'Analytics 4 - Manpower',
    rows: [
      ['ANALYTICS 4 — MANPOWER'],
      [],
      ANALYTICS4_HEADER,
      ...figureRows(page, 'Manpower Table'),
    ],
  };
}

/** The four Analytics sheets, A1 to A4. */
export function analyticsSheets(data: ExportData): ExportSheet[] {
  return [
    analytics1Sheet(data),
    analytics2Sheet(data),
    analytics3Sheet(data),
    analytics4Sheet(data),
  ];
}
