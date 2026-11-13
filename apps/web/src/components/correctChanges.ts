import type { CorrectChanges } from '../api.js';

export interface CorrectChangeValues {
  reportedAt?: string;
  startedAt?: string;
  closedAt?: string;
  problem?: string;
  machineId?: string;
  kind?: string;
}

function filled(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text ? text : undefined;
}

/** Only the fields the admin actually filled become a correction (DOMAIN.md §4 `correct`). */
export function buildCorrectChanges(values: CorrectChangeValues): CorrectChanges {
  const changes: CorrectChanges = {};
  const reportedAt = filled(values.reportedAt);
  if (reportedAt) changes.reportedAt = reportedAt;
  const startedAt = filled(values.startedAt);
  if (startedAt) changes.startedAt = startedAt;
  const closedAt = filled(values.closedAt);
  if (closedAt) changes.closedAt = closedAt;
  const problem = filled(values.problem);
  if (problem) changes.problem = problem;
  if (values.machineId) changes.machineId = values.machineId;
  if (values.kind === 'stopped' || values.kind === 'support' || values.kind === 'general') {
    changes.kind = values.kind;
  }
  return changes;
}

export function hasCorrectChanges(changes: CorrectChanges): boolean {
  return Object.keys(changes).length > 0;
}
