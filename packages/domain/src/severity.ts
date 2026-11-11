/**
 * Severity calculation for M2‑2.1.
 *
 * Computes ticket severity (S1–S4) based on:
 * - Machine criticality (A, B, C) at report time
 * - Ticket kind (stopped, support, general)
 * - Urgent flag (for general work requests)
 * - Tenant‑configurable severity matrix
 *
 * @module
 */

import type { Criticality, Severity, SeverityMatrix } from './types.js';

export type { Criticality, Severity, SeverityMatrix } from './types.js';
export type TicketKind = 'stopped' | 'support' | 'general';

/** Default matrix from `docs/spec/DOMAIN.md` §Severity */
export const defaultSeverityMatrix: SeverityMatrix = {
  default: {
    A: { stopped: 'S1', support: 'S2' },
    B: { stopped: 'S2', support: 'S3' },
    C: { stopped: 'S3', support: 'S4' },
  },
  workRequest: 'S4',
  urgentWorkRequest: 'S3',
} as const;

/**
 * Compute severity for a ticket.
 *
 * @param matrix Tenant severity matrix
 * @param machineCriticality Criticality of the machine at report time (null for general tickets)
 * @param kind Ticket kind
 * @param urgent Whether a general work request is marked urgent
 * @returns Severity S1–S4
 */
export function computeSeverity(
  matrix: SeverityMatrix,
  machineCriticality: Criticality | null,
  kind: TicketKind,
  urgent: boolean,
): Severity {
  // General work request (no machine)
  if (kind === 'general') {
    return urgent ? matrix.urgentWorkRequest : matrix.workRequest;
  }

  // Machine‑based ticket (stopped or support)
  if (machineCriticality === null) {
    // Fallback: should not happen for stopped/support tickets with a machine,
    // but defensively treat as lowest criticality C
    return kind === 'stopped' ? matrix.default.C.stopped : matrix.default.C.support;
  }

  return matrix.default[machineCriticality][kind];
}

/** Derive severity from creation inputs, applying the shared defaults. */
export function deriveSeverity(input: {
  kind: TicketKind;
  machineCriticality?: Criticality | null;
  severityMatrix?: SeverityMatrix;
  urgent?: boolean;
}): Severity {
  return computeSeverity(
    input.severityMatrix ?? defaultSeverityMatrix,
    input.machineCriticality ?? null,
    input.kind,
    input.urgent ?? false,
  );
}
