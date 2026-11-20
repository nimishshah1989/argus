import { formatNumber, normalizeLabel } from './format.js';
import { isProduction } from './machine-facts.js';
import { dmy } from './plant-date.js';
import { isPm, sourcedReports, type SourcedReport } from './rows.js';
import type { Computer, EngineData, FigureValue, ReportRow, WhyWhyRow } from './types.js';

/**
 * A6, the Why-Why candidate list (ticket 41, packet 41c): the production breakdowns whose recorded hours pass the
 * plant's threshold, worst first, with the platform's two action buttons. The hours are the RAW recorded column
 * (`recordedHours`, else the minutes), never the effective selector a total reads: a NO-DT row keeps its value and
 * stays a candidate (the key's sixth row, VC-23 at 59.98). A saved Why-Why record marks its ticket completed.
 */

const TITLE = 'Why-Why (Root Cause) Analysis';
const HEADER = ['Machine', 'Date', 'Problem', 'Down (Hrs)', 'Status', ''];

interface Candidate {
  row: SourcedReport;
  hours: number;
}

/** The raw recorded hours: the legacy column where the source has one, the plant's minutes otherwise. */
const rawHours = (report: ReportRow): number => report.recordedHours ?? report.downtimeMin / 60;

/** The production non-PM reports over the threshold, worst first; the sort is stable, so ties keep the log order. */
function candidatesOf(data: EngineData, threshold: number): Candidate[] {
  const production = new Set(data.machines.filter(isProduction).map((machine) => machine.id));
  const found: Candidate[] = [];
  for (const row of sourcedReports(data)) {
    if (!production.has(row.report.machineId) || isPm(row)) continue;
    const hours = rawHours(row.report);
    if (hours > threshold) found.push({ row, hours });
  }
  return found.sort((left, right) => right.hours - left.hours);
}

/** The tickets with a saved record: the latest record per ticket wins, as the ticket home appends. */
function completedTickets(data: EngineData): ReadonlySet<string> {
  const latest = new Map<string, WhyWhyRow>();
  for (const record of data.whyWhy ?? []) {
    const seen = latest.get(record.ticketId);
    if (seen === undefined || record.completedDate >= seen.completedDate) {
      latest.set(record.ticketId, record);
    }
  }
  return new Set(latest.keys());
}

/** One table row, as the platform prints it: the machine code, the plant date, the problem text and the raw hours. */
function candidateRow(candidate: Candidate, machineCode: string, completed: boolean): string[] {
  const { report } = candidate.row;
  return [
    machineCode,
    dmy(report.date),
    normalizeLabel(report.problem),
    formatNumber(candidate.hours, 2),
    completed ? 'Completed' : 'Not Started',
    completed ? 'View / EditPDF' : 'Start Why-Why',
  ];
}

/**
 * The A6 figure: the key's page with its one table. A plant with no candidate (no production breakdown over the
 * threshold) has nothing to ask why about, so the value is null rather than a fabricated empty table. The drill
 * names the candidate tickets; the engine sorts and dedupes them, so the drill's order is NOT the rows' order. The
 * table therefore carries `rowTicketIds`, one ticket id per row in row order (a ticket with two over-threshold
 * reports appears twice), and a screen pairs a row with its ticket from that, never by position in the drill.
 */
export const a6WhyWhyFigure: Computer = ({ data, asOf, profile }) => {
  const candidates = candidatesOf(data, profile.whyWhyThresholdHours);
  if (candidates.length === 0) return { value: null, drillIds: [] };
  const completed = completedTickets(data);
  const machines = new Map(data.machines.map((machine) => [machine.id, machine]));
  const rows = candidates.map((candidate) => {
    const machine = machines.get(candidate.row.report.machineId);
    const code = machine?.code ?? candidate.row.report.machineId;
    return candidateRow(candidate, code, completed.has(candidate.row.ticket.id));
  });
  const value = {
    screen: 'a6-why-why',
    asOf,
    pages: [
      {
        page: 'a6',
        title: 'Why-Why Analysis',
        kpis: [],
        tables: [
          {
            title: TITLE,
            header: HEADER,
            rows,
            rowCount: rows.length,
            rowTicketIds: candidates.map((candidate) => candidate.row.ticket.id),
          },
        ],
        charts: [],
      },
    ],
  };
  const drillIds = [...new Set(candidates.map((candidate) => candidate.row.ticket.id))];
  return { value: value as unknown as FigureValue, drillIds };
};
