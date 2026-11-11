import { describe, expect, it } from 'vitest';
import { computeTicketFigures } from '../src/import/figures.js';
import { reconcileTicket, ReconcileError, type ReconciledReport } from '../src/import/reconcile.js';
import { parseTicket, type BhavinTicket } from '../src/import/schema.js';
import { reduceTicketState } from '../src/import/state.js';
import { validateIntervals } from '../src/import/intervals.js';
import { makeOrdinaryTicket, makeReconcileReferences } from './import-fixture.js';

const NOW = new Date('2026-11-01T12:00:00Z');
const base = () => parseTicket(makeOrdinaryTicket());

function exact() {
  const ticket = base();
  const refs = makeReconcileReferences();
  const reduced = reduceTicketState(ticket, NOW);
  const intervals = validateIntervals(ticket, reduced, refs.people);
  const reconciled = reconcileTicket(base(), refs, NOW);
  return { reduced, ...intervals, reports: reconciled.reports };
}

function compute(ticket: BhavinTicket, reports?: ReconciledReport[]) {
  const setup = exact();
  return computeTicketFigures({
    ticket,
    reduced: { ...setup.reduced, ticket },
    segments: setup.segments,
    reports: reports ?? setup.reports,
    now: NOW,
  });
}

function comparisonIssues(ticket: BhavinTicket, reports?: ReconciledReport[]) {
  return compute(ticket, reports).issues.filter((issue) => issue.severity !== 'info');
}

describe('T31 stored cache tolerance and hard mismatches', () => {
  it('accepts exact values without comparison issues or overrides', () => {
    const result = compute(base());
    expect(result.issues).toEqual([]);
    expect(result.overrides).toEqual({});
  });

  it('lists a one-minute difference as a structured warning and remains batch-eligible', () => {
    const ticket = base();
    ticket.storedFigures.waitMin = 1;
    const result = compute(ticket);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      rowNumber: 0,
      legacyId: ticket.legacyId,
      ref: ticket.ref,
      field: 'storedFigures.waitMin',
      stored: 1,
      computed: 0,
      severity: 'warning',
    });
    expect(Math.abs(result.issues[0]!.delta!)).toBe(1);
    expect(result.overrides).toEqual({});
    expect(() => reconcileTicket(ticket, makeReconcileReferences(), NOW)).not.toThrow();
  });

  it('rejects an unexplained difference greater than one without deriving an override', () => {
    const ticket = base();
    ticket.storedFigures.activeMin = 60;
    const result = compute(ticket);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      field: 'storedFigures.activeMin',
      stored: 60,
      computed: 55,
      severity: 'error',
    });
    expect(result.overrides).toEqual({});
    expect(() => reconcileTicket(ticket, makeReconcileReferences(), NOW)).toThrow(ReconcileError);
  });

  it('rejects stored null versus a computed number', () => {
    const ticket = base();
    ticket.storedFigures.activeMin = null as unknown as number;
    const issue = comparisonIssues(ticket)[0];
    expect(issue).toMatchObject({
      field: 'storedFigures.activeMin',
      stored: null,
      computed: 55,
      delta: null,
      severity: 'error',
    });
    expect(compute(ticket).overrides).toEqual({});
    expect(() => reconcileTicket(ticket, makeReconcileReferences(), NOW)).toThrow(ReconcileError);
  });

  it('rejects a wrong numeric type even when its text equals the computed value', () => {
    const ticket = base();
    ticket.storedFigures.waitMin = '0' as unknown as number;
    const issue = comparisonIssues(ticket)[0];
    expect(issue).toMatchObject({
      field: 'storedFigures.waitMin',
      stored: null,
      computed: 0,
      delta: null,
      severity: 'error',
    });
    expect(compute(ticket).overrides).toEqual({});
    expect(() => reconcileTicket(ticket, makeReconcileReferences(), NOW)).toThrow(ReconcileError);
  });
});

describe('T33 report and stored-cache comparisons', () => {
  it('lists every tolerated cache and report difference independently', () => {
    const ticket = base();
    Object.assign(ticket.storedFigures, { responseMin: 6, downtimeMin: 61, repairMin: 56 });
    ticket.reports[0]!.responseMin = 6;
    ticket.reports[0]!.downtimeMin = 61;
    ticket.reports[0]!.repairMin = 56;
    const reports = structuredClone(exact().reports);
    reports[0]!.responseMin = 6;
    reports[0]!.downtimeMin = 61;
    reports[0]!.repairMin = 56;
    const issues = comparisonIssues(ticket, reports);
    expect(issues).toHaveLength(6);
    expect(issues.every((issue) => issue.severity === 'warning')).toBe(true);
    expect(issues.every((issue) => Math.abs(issue.delta!) === 1)).toBe(true);
    expect(issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining([
        'storedFigures.responseMin',
        'storedFigures.downtimeMin',
        'storedFigures.repairMin',
        'reports[0].responseMin',
        'reports[0].downtimeMin',
        'reports[0].repairMin',
      ]),
    );
    const reconciled = reconcileTicket(ticket, makeReconcileReferences(), NOW);
    expect(
      reconciled.figureResult.issues.filter((issue) => issue.severity === 'warning'),
    ).toHaveLength(6);
  });

  it('returns both cache and report errors for a hard downtime difference', () => {
    const ticket = base();
    ticket.storedFigures.downtimeMin = 62;
    ticket.reports[0]!.downtimeMin = 62;
    const reports = structuredClone(exact().reports);
    reports[0]!.downtimeMin = 62;
    const issues = comparisonIssues(ticket, reports);
    expect(issues).toHaveLength(2);
    expect(issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining(['storedFigures.downtimeMin', 'reports[0].downtimeMin']),
    );
    expect(issues.every((issue) => issue.severity === 'error')).toBe(true);
    try {
      reconcileTicket(ticket, makeReconcileReferences(), NOW);
      throw new Error('Expected reconciliation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(ReconcileError);
      const fields = (error as ReconcileError).issues.map((issue) => issue.field);
      expect(fields).toEqual(
        expect.arrayContaining(['storedFigures.downtimeMin', 'reports[0].downtimeMin']),
      );
    }
  });

  it('treats nullable report/cache response as an error whenever computed is numeric', () => {
    const ticket = base();
    ticket.storedFigures.responseMin = null;
    ticket.reports[0]!.responseMin = null;
    const reports = structuredClone(exact().reports);
    reports[0]!.responseMin = null;
    const issues = comparisonIssues(ticket, reports);
    expect(issues).toHaveLength(2);
    expect(issues.every((issue) => issue.severity === 'error' && issue.delta === null)).toBe(true);
    expect(issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining(['storedFigures.responseMin', 'reports[0].responseMin']),
    );
  });

  it('does not hide a report null when the stored cache is exact', () => {
    const ticket = base();
    ticket.reports[0]!.responseMin = null;
    const reports = structuredClone(exact().reports);
    reports[0]!.responseMin = null;
    const issues = comparisonIssues(ticket, reports);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      field: 'reports[0].responseMin',
      stored: null,
      computed: 5,
      severity: 'error',
    });
    expect(() => reconcileTicket(ticket, makeReconcileReferences(), NOW)).toThrow(ReconcileError);
  });
});
