import { setParent, ticketParents } from '../tickets/index.js';
import type { ImportCtx } from './batch.js';
import { rowIssue, type PlannedRow } from './identity.js';

function fail(row: PlannedRow, code: string, message: string): void {
  row.outcome = 'error';
  row.issues.push(
    rowIssue(
      {
        rowNumber: row.rowNumber,
        legacyId: row.ticket?.legacyId ?? null,
        ref: row.ticket?.ref ?? null,
      },
      code,
      message,
    ),
  );
}

function resolveDuplicates(plans: PlannedRow[]): void {
  const byNumber = new Map(plans.map((plan) => [plan.rowNumber, plan]));
  for (const row of plans) {
    if (!row.duplicateOf) continue;
    const first = byNumber.get(row.duplicateOf);
    if (first && first.outcome !== 'error') {
      row.outcome = 'skip';
      row.syntheticExisting = first.syntheticExisting;
      row.currentParentId = first.currentParentId;
    } else {
      fail(row, 'duplicate_of_failed_row', `Duplicate of failed input row ${row.duplicateOf}`);
    }
  }
}

function assignParent(
  row: PlannedRow,
  parentRef: string,
  byRef: Map<string, PlannedRow>,
  existing: Map<string, string>,
): boolean {
  const parent = byRef.get(parentRef);
  if (parent && parent.outcome !== 'error') {
    row.parentRowNumber = parent.rowNumber;
    return true;
  }
  const parentId = existing.get(parentRef);
  if (!parentId) {
    fail(row, 'missing_parent', `Missing parent ${parentRef}`);
    return false;
  }
  row.parentId = parentId;
  return true;
}

function validateSkippedParent(row: PlannedRow, parent: PlannedRow | undefined): void {
  const targetExisting = row.parentId ?? parent?.existingTicketId ?? null;
  if (row.currentParentId && row.currentParentId !== targetExisting) {
    fail(row, 'parent_conflict', `Parent conflicts with existing ${row.currentParentId}`);
    return;
  }
  if (!row.currentParentId && !row.syntheticExisting) {
    fail(row, 'outside_parent_mutation', 'A pre-existing non-import ticket cannot gain a parent');
  }
}

function planOneParent(
  row: PlannedRow,
  byRef: Map<string, PlannedRow>,
  existing: Map<string, string>,
): void {
  const parentRef = row.ticket?.parentRef;
  if (!parentRef || row.outcome === 'error') return;
  const parent = byRef.get(parentRef);
  if (!assignParent(row, parentRef, byRef, existing) || row.outcome !== 'skip') return;
  validateSkippedParent(row, parent);
}

function keyFor(row: PlannedRow): string {
  return `row:${row.rowNumber}`;
}

function nextKey(row: PlannedRow, byNumber: Map<number, PlannedRow>): string | null {
  if (row.parentRowNumber) return keyFor(byNumber.get(row.parentRowNumber) as PlannedRow);
  return row.parentId ? `db:${row.parentId}` : null;
}

function validateReachable(
  row: PlannedRow,
  byNumber: Map<number, PlannedRow>,
  existingParents: Map<string, string | null>,
): void {
  if (row.outcome === 'error') return;
  const seen = new Set<string>();
  let key: string | null = keyFor(row);
  while (key) {
    if (seen.has(key)) {
      fail(row, 'parent_cycle', 'Parent graph contains a cycle');
      return;
    }
    seen.add(key);
    if (key.startsWith('db:')) {
      key = existingParents.get(key.slice(3)) ? `db:${existingParents.get(key.slice(3))}` : null;
      continue;
    }
    const number = Number(key.slice(4));
    const current = byNumber.get(number);
    if (!current || current.outcome === 'error') {
      fail(row, 'parent_unavailable', `Parent row ${number} is unavailable`);
      return;
    }
    key = nextKey(current, byNumber);
  }
}

function dependencyOrder(plans: PlannedRow[]): PlannedRow[] {
  const byNumber = new Map(plans.map((plan) => [plan.rowNumber, plan]));
  const ordered: PlannedRow[] = [];
  const state = new Map<number, number>();
  const visit = (row: PlannedRow) => {
    if (state.get(row.rowNumber) === 2) return;
    if (row.outcome === 'error') {
      state.set(row.rowNumber, 2);
      ordered.push(row);
      return;
    }
    if (state.get(row.rowNumber) === 1) throw new Error('Unexpected parent dependency cycle');
    state.set(row.rowNumber, 1);
    const dependency = row.parentRowNumber ?? row.duplicateOf;
    if (dependency) visit(byNumber.get(dependency) as PlannedRow);
    state.set(row.rowNumber, 2);
    ordered.push(row);
  };
  for (const row of plans) visit(row);
  return ordered;
}

export async function planParentGraph(ctx: ImportCtx, plans: PlannedRow[]): Promise<PlannedRow[]> {
  resolveDuplicates(plans);
  const existing = await ticketParents(ctx.client, ctx.tenantId);
  const byRef = new Map<string, PlannedRow>();
  for (const row of plans) if (row.ticket) byRef.set(row.ticket.ref, row);
  const existingByRef = new Map(existing.map((row) => [row.ref as string, row.id as string]));
  const existingParents = new Map<string, string | null>(
    existing.map((row) => [row.id as string, row.parent_id as string | null]),
  );
  for (const row of plans) planOneParent(row, byRef, existingByRef);
  const byNumber = new Map(plans.map((plan) => [plan.rowNumber, plan]));
  for (const row of plans) validateReachable(row, byNumber, existingParents);
  return dependencyOrder(plans);
}

function parentTarget(
  row: PlannedRow,
  byNumber: Map<number, PlannedRow>,
): { parentId: string; childId: string; parentRef: string } | null {
  if (row.outcome === 'error' || row.duplicateOf || !row.ticket?.parentRef) return null;
  const parentRef = row.ticket.parentRef;
  const parent = row.parentRowNumber ? byNumber.get(row.parentRowNumber) : undefined;
  const parentId = row.parentId ?? parent?.existingTicketId;
  if (!parentId || !row.existingTicketId) {
    throw new Error(`Parent target unavailable for ${parentRef}`);
  }
  return { parentId, childId: row.existingTicketId, parentRef };
}

export async function applyParentLinks(
  ctx: ImportCtx,
  plans: PlannedRow[],
): Promise<Array<{ rowNumber: number; ref: string; parentRef: string }>> {
  const byNumber = new Map(plans.map((plan) => [plan.rowNumber, plan]));
  const repairs: Array<{ rowNumber: number; ref: string; parentRef: string }> = [];
  for (const row of plans) {
    const target = parentTarget(row, byNumber);
    if (!target || row.currentParentId === target.parentId) continue;
    await setParent(ctx.client, {
      tenantId: ctx.tenantId,
      childId: target.childId,
      parentId: target.parentId,
    });
    if (row.outcome === 'skip') {
      repairs.push({
        rowNumber: row.rowNumber,
        ref: row.ticket?.ref ?? '',
        parentRef: target.parentRef,
      });
    }
  }
  return repairs;
}
