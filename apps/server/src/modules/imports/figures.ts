import {
  figures as domainFigures,
  type FigureOverrides,
  type Figures,
  type WorkSegment,
} from '@uptimo/domain';
import type { ReconciledReport } from './reconcile.js';
import type { BhavinTicket, ImportIssue, IssueSeverity, StoredFigures } from './schema.js';
import type { ReducedTicket } from './state.js';

export interface FigureComputation {
  asOf: Date;
  figures: Figures;
  overrides: FigureOverrides;
  issues: ImportIssue[];
}

type FigureKey = keyof StoredFigures;
const FIGURE_KEYS = [
  'responseMin',
  'activeMin',
  'waitMin',
  'vendorMin',
  'handoverWaitMin',
  'downAccMin',
  'downtimeMin',
  'followMin',
  'repairMin',
] as const satisfies ReadonlyArray<FigureKey>;

const OVERRIDE_FIELDS = {
  responseMin: 'responseMin',
  handsOnOverrideMin: 'activeMin',
  waitingOverrideMin: 'waitMin',
  downtimeMin: 'downtimeMin',
  repairMin: 'repairMin',
} as const satisfies Record<keyof FigureOverrides, FigureKey>;

function issue(
  ticket: BhavinTicket,
  input: {
    field: string;
    severity: IssueSeverity;
    stored: number | null;
    computed: number | null;
    code: string;
  },
): ImportIssue {
  const { field, severity, stored, computed, code } = input;
  const delta = stored !== null && computed !== null ? computed - stored : null;
  return {
    rowNumber: 0,
    legacyId: ticket.legacyId,
    ref: ticket.ref,
    code,
    field,
    stored,
    computed,
    delta,
    severity,
    message:
      severity === 'info'
        ? `Evidenced override applied for ${field}`
        : `${severity === 'warning' ? 'Tolerated' : 'Hard'} figure mismatch for ${field}`,
  };
}

function compare(
  ticket: BhavinTicket,
  field: string,
  storedValue: unknown,
  computed: number | null,
): ImportIssue | null {
  const validStored =
    storedValue === null || (typeof storedValue === 'number' && Number.isFinite(storedValue));
  if (validStored && storedValue === computed) return null;
  const stored = validStored ? (storedValue as number | null) : null;
  if (!validStored || stored === null || computed === null) {
    return issue(ticket, {
      field,
      severity: 'error',
      stored,
      computed,
      code: 'figure_type_mismatch',
    });
  }
  const difference = Math.abs(computed - stored);
  return issue(ticket, {
    field,
    severity: difference <= 1 ? 'warning' : 'error',
    stored,
    computed,
    code: difference <= 1 ? 'figure_tolerated' : 'figure_mismatch',
  });
}

function calculationAsOf(ticket: BhavinTicket, now: Date): Date {
  if (ticket.status === 'closed') return ticket.state.closedAt as Date;
  if (ticket.status === 'cancelled') return ticket.state.cancelledAt as Date;
  return now;
}

function derivedOverrides(
  ticket: BhavinTicket,
  reduced: ReducedTicket,
  reports: ReconciledReport[],
): FigureOverrides {
  if (ticket.entryType !== 'pastBreakdown') return { ...reduced.overrides };
  const report = reports[0];
  if (!report || report.responseMin === null || report.repairMin === null) {
    throw new Error('past_breakdown_report_overrides');
  }
  return {
    responseMin: report.responseMin,
    repairMin: report.repairMin,
    downtimeMin: report.downtimeMin,
  };
}

function overrideIssues(
  ticket: BhavinTicket,
  overrides: FigureOverrides,
  baseline: Figures,
  final: Figures,
): ImportIssue[] {
  const issues: ImportIssue[] = [];
  for (const [field, figureKey] of Object.entries(OVERRIDE_FIELDS) as Array<
    [keyof FigureOverrides, FigureKey]
  >) {
    if (overrides[field] === undefined) continue;
    issues.push(
      issue(ticket, {
        field: `overrides.${field}`,
        severity: 'info',
        stored: baseline[figureKey],
        computed: final[figureKey],
        code: 'override_applied',
      }),
    );
  }
  return issues;
}

export function computeTicketFigures(input: {
  ticket: BhavinTicket;
  reduced: ReducedTicket;
  segments: WorkSegment[];
  reports: ReconciledReport[];
  now: Date;
}): FigureComputation {
  const { ticket, reduced, segments, reports, now } = input;
  const asOf = calculationAsOf(ticket, now);
  const overrides = derivedOverrides(ticket, reduced, reports);
  const domainInput = {
    reportedAt: reduced.reportedAt,
    kind: reduced.kind,
    ...(reduced.state.kindUpgradedAt ? { kindUpgradedAt: reduced.state.kindUpgradedAt } : {}),
    selfStarted: reduced.state.selfStarted,
    events: reduced.domainEvents,
    segments,
    now: asOf,
    ...(reduced.state.closedAt ? { closedAt: reduced.state.closedAt } : {}),
  };
  const final = domainFigures({ ...domainInput, overrides });
  const baseline = Object.keys(overrides).length
    ? domainFigures({ ...domainInput, overrides: {} })
    : final;
  const issues = overrideIssues(ticket, overrides, baseline, final);
  for (const key of FIGURE_KEYS) {
    const result = compare(ticket, `storedFigures.${key}`, ticket.storedFigures[key], final[key]);
    if (result) issues.push(result);
  }
  reports.forEach((report, index) => {
    for (const key of ['downtimeMin', 'responseMin', 'repairMin'] as const) {
      const result = compare(ticket, `reports[${index}].${key}`, report[key], final[key]);
      if (result) issues.push(result);
    }
  });
  return { asOf, figures: final, overrides, issues };
}
