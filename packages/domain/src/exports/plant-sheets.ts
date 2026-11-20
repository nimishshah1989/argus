import { addMonths, dmy, endOfTerm } from '../analytics/plant-date.js';
import { effectiveHours } from '../analytics/rows.js';
import type { EngineData, ReportRow, WhyWhyRow } from '../analytics/types.js';
import {
  AMC_HEADER,
  BREAKDOWN_HEADER,
  CELL_LOG_HEADER,
  LEGAL_HEADER,
  PM_PLAN_HEADER,
  PM_REPORT_HEADER,
  WHY_HEADER,
} from './headers.js';
import { labelsOf, type Labels } from './labels.js';
import type {
  ExportCell,
  ExportData,
  ExportPmPlan,
  ExportPmReport,
  ExportRow,
  ExportSheet,
  ExportTeamMember,
} from './types.js';

/**
 * The workbook's plant sheets (ticket 45, packet 45c-2): the Breakdown Log, the cell log, Why-Why, the Settings
 * sections and the PM registers — every row read from the plant data, the headers the key's own.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A value as a workbook cell: numbers stay numbers, a blank stays blank, everything else is text. */
function cell(value: unknown): ExportCell {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return value === null || value === undefined || value === '' ? '' : String(value);
}

function text(value: string | null | undefined): string {
  return value ?? '';
}

function joinedNames(codes: readonly string[], names: ReadonlyMap<string, string>): string {
  return codes.map((code) => names.get(code) ?? code).join(', ');
}

/** Every report, oldest first by plant date, then the log's Sr No, then its id. */
function reportOrder(data: EngineData): ReportRow[] {
  return [...data.reports].sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      (left.srNo ?? Number.MAX_SAFE_INTEGER) - (right.srNo ?? Number.MAX_SAFE_INTEGER) ||
      left.id.localeCompare(right.id),
  );
}

function reportHours(report: ReportRow): number {
  return report.recordedHours ?? report.downtimeMin / 60;
}

function reportMonth(date: string): string {
  return MONTHS[Number(date.slice(5, 7)) - 1] ?? '';
}

function spareNames(report: ReportRow): string[] {
  const spares = report.spares ?? (report.spareUsed === null ? [] : [report.spareUsed]);
  return [spares[0] ?? '', spares[1] ?? '', spares[2] ?? ''];
}

interface BreakdownContext {
  labels: Labels;
  names: ReadonlyMap<string, string>;
  segments: ReadonlyMap<string, string | null>;
  sources: ReadonlyMap<string, string>;
  spareCosts: Readonly<Record<string, readonly (number | null)[]>>;
}

function breakdownRow(report: ReportRow, index: number, ctx: BreakdownContext): ExportRow {
  const costs = ctx.spareCosts[report.id] ?? [];
  const spares = spareNames(report);
  const hours = reportHours(report);
  const total = costs.reduce<number>((sum, cost) => sum + (cost ?? 0), 0);
  return [
    report.srNo ?? index + 1,
    ctx.labels.machine(report.machineId),
    dmy(report.date),
    reportMonth(report.date),
    report.shift,
    report.problem,
    text(report.observedBy),
    text(report.correctiveAction),
    joinedNames(report.doneBy, ctx.names),
    joinedNames(report.supportedBy, ctx.names),
    report.downtimeMin,
    hours,
    text(report.maintCode),
    text(report.category),
    report.maintCode === 'PM' ? hours : '',
    spares[0]!,
    cell(costs[0]),
    spares[1]!,
    cell(costs[1]),
    spares[2]!,
    cell(costs[2]),
    total,
    report.id,
    cell(report.responseMin),
    cell(report.repairMin),
    text(ctx.segments.get(report.machineId)),
    ctx.labels.ticket(report.ticketId),
    ctx.labels.ticket(report.ticketId),
    text(ctx.sources.get(report.ticketId ?? '') ?? ''),
    '',
  ];
}

function breakdownRows(data: ExportData): ExportRow[] {
  const ctx: BreakdownContext = {
    labels: labelsOf(data.data),
    names: new Map(data.data.people.map((person) => [person.code, person.displayName])),
    segments: new Map(data.data.machines.map((machine) => [machine.id, machine.segment])),
    sources: new Map(data.data.tickets.map((ticket) => [ticket.id, ticket.source])),
    spareCosts: data.spareCosts ?? {},
  };
  return reportOrder(data.data).map((report, index) => breakdownRow(report, index, ctx));
}

function breakdownSheet(data: ExportData): ExportSheet {
  return {
    name: 'Breakdown Log',
    rows: [[data.tenant], ['BREAKDOWN HISTORY'], BREAKDOWN_HEADER, ...breakdownRows(data)],
  };
}

function cellLogSheet(data: ExportData): ExportSheet {
  const labels = labelsOf(data.data);
  const moves = [...data.data.moves].sort(
    (left, right) =>
      left.effectiveFrom.localeCompare(right.effectiveFrom) || left.id.localeCompare(right.id),
  );
  return {
    name: 'Cell Change Log',
    rows: [
      CELL_LOG_HEADER,
      ...moves.map((move) => [
        dmy(move.effectiveFrom),
        labels.machine(move.machineId),
        text(move.fromCell),
        text(move.toCell),
        text(move.fromLocation),
        text(move.toLocation),
        move.id,
      ]),
    ],
  };
}

function whyWhySheet(data: ExportData): ExportSheet {
  const labels = labelsOf(data.data);
  const names = new Map(data.data.people.map((person) => [person.code, person.displayName]));
  const tickets = new Map(data.data.tickets.map((ticket) => [ticket.id, ticket]));
  const reports = new Map(
    data.data.reports.flatMap((report) =>
      report.ticketId === null ? [] : [[report.ticketId, report]],
    ),
  );
  const rows = (data.data.whyWhy ?? []).map((why: WhyWhyRow) => {
    const ticket = tickets.get(why.ticketId);
    const report = reports.get(why.ticketId);
    return [
      labels.machine(ticket?.machineId),
      report ? dmy(report.date) : '',
      report ? effectiveHours(report) : '',
      text(report?.problem),
      ...why.whys,
      why.conclusion,
      names.get(why.completedBy) ?? why.completedBy,
      dmy(why.completedDate),
    ];
  });
  return { name: 'Why-Why Analysis', rows: [WHY_HEADER, ...rows] };
}

function teamRows(data: ExportData): ExportRow[] {
  const people = new Map(data.data.people.map((person) => [person.displayName, person]));
  return data.settings.team.map((member: ExportTeamMember) => {
    const person = people.get(member.name);
    const type = person === undefined ? member.type : person.team === 'vendor' ? 'Vendor' : 'Team';
    return [member.name, type, 'Active', ''];
  });
}

/** The platform's Settings sheet: its section order, its team table where the key finds its header. */
function settingsSheet(data: ExportData): ExportSheet {
  const labels = labelsOf(data.data);
  const excluded = (data.data.settings?.excludedMachineIds ?? []).map(labels.machine);
  const codes = data.data.lists.maint_code ?? [];
  const list = (title: string, values: readonly string[]): ExportRow[] => [
    [''],
    [title],
    ...values.map((value) => [value]),
  ];
  const rows: ExportRow[] = [
    ['Parameter', 'Value'],
    ['Production Hrs/Day', data.profile.prodHrsPerDay],
    ['Working Days/Year', data.profile.workDaysPerYear],
    ['Efficiency Factor (%)', data.profile.efficiencyFactor],
    ['Why-Why Threshold (Hrs)', data.profile.whyWhyThresholdHours],
    ['Excluded Machines (not in production data)', excluded.join(', ')],
    ...list('Segments', data.settings.segments),
    ...list('Categories', data.settings.categories),
    ...list('Conventional Categories', data.settings.conventionalCategories),
    ...list('Process Categories', data.settings.processCategories),
    ...list('Utility Categories', data.settings.utilityCategories),
    ...list('Shifts', data.settings.shifts),
    ...list('Locations', data.settings.locations),
    ...list('Cells', data.settings.cells),
    ...list('Breakdown Categories', data.settings.breakdownCategories),
    [],
    ['Team Members', 'Type', 'Status', 'Usual shift'],
    ...teamRows(data),
    [],
    ['Maintenance Codes', 'Description'],
    ...codes.map((code) => [code.code, code.label]),
  ];
  return { name: 'Settings', rows };
}

function pmPlanRows(data: ExportData): ExportRow[] {
  const plan = [...(data.pmPlan ?? [])].sort(
    (left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id),
  );
  return plan.map((row: ExportPmPlan, index) => [
    index + 1,
    row.machineId,
    row.date,
    row.source,
    row.id,
    text(row.done),
    text(row.target),
    row.machineShift === true ? 'yes' : '',
    row.routine === true ? 'yes' : '',
  ]);
}

function pmPlanSheet(data: ExportData): ExportSheet {
  return {
    name: 'PM Plan',
    rows: [[data.tenant], ['PREVENTIVE MAINTENANCE PLAN'], PM_PLAN_HEADER, ...pmPlanRows(data)],
  };
}

function amcSheet(data: ExportData): ExportSheet {
  const labels = labelsOf(data.data);
  const rows = (data.data.amc ?? []).map((line, index) => {
    const months = Number(line.months);
    // The register stores the end, not a tenure (51c): the stored day wins and a tenure row derives as before.
    const derived = line.start !== null && months > 0 ? endOfTerm(line.start, months) : null;
    const end = line.endsOn ?? derived;
    return [
      index + 1,
      labels.machine(line.machineId),
      text(line.type),
      text(line.start),
      months > 0 ? line.months : '',
      end === null ? '' : dmy(end),
      text(line.vendor),
      line.noRenew ? 'yes' : '',
    ];
  });
  return {
    name: 'AMC & Warranty',
    rows: [[data.tenant], ['AMC / EXTENDED WARRANTY'], AMC_HEADER, ...rows],
  };
}

function legalSheet(data: ExportData): ExportSheet {
  const labels = labelsOf(data.data);
  const rows = (data.data.legal ?? []).map((line, index) => {
    const months = Number(line.months);
    // The register stores the next due day (51c): the stored day wins and a last-plus-validity row derives as before.
    const derived = line.last !== null && months > 0 ? addMonths(line.last, months) : null;
    const due = line.dueOn ?? derived;
    return [
      index + 1,
      labels.machine(line.machineId),
      line.name,
      text(line.form),
      text(line.last),
      months > 0 ? line.months : '',
      due ?? '',
      text(line.cert),
    ];
  });
  return {
    name: 'Legal Compliance',
    rows: [[data.tenant], ['LEGAL COMPLIANCE (TESTS AND CALIBRATIONS)'], LEGAL_HEADER, ...rows],
  };
}

function pmReportRows(data: ExportData): ExportRow[] {
  const reports = [...(data.pmReports ?? [])].sort(
    (left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id),
  );
  return reports.map((report: ExportPmReport, index) => {
    const measurements = Object.entries(report.measurements ?? {})
      .map(([key, value]) => `${key} ${value}`)
      .join('; ');
    const comments = [...(report.comments ?? []), report.measComment ?? '']
      .filter((comment) => comment !== '')
      .join(' | ');
    return [
      index + 1,
      report.machineId,
      report.date,
      text(report.planDate),
      text(report.doneBy),
      cell(report.total),
      (report.undone ?? []).join(', '),
      measurements,
      comments,
      text(report.remarks),
      text(report.reviewedBy),
      text(report.prodSup),
      text(report.maintSup),
      report.id,
      JSON.stringify(report.data ?? {}),
    ];
  });
}

function pmReportsSheet(data: ExportData): ExportSheet {
  return { name: 'PM Reports', rows: [PM_REPORT_HEADER, ...pmReportRows(data)] };
}

/** The eight plant sheets, in the key's order. */
export function plantSheets(data: ExportData): ExportSheet[] {
  return [
    breakdownSheet(data),
    cellLogSheet(data),
    whyWhySheet(data),
    settingsSheet(data),
    pmPlanSheet(data),
    amcSheet(data),
    legalSheet(data),
    pmReportsSheet(data),
  ];
}
