import type { PoolClient } from 'pg';
import {
  isBreakdownChannel,
  resolveFailureCode,
  type BreakdownReportBody,
  type FailureCodeIndex,
} from '@uptimo/shared';
import { ensureFailureCodes, failureCodeIndexOf } from '../../plant/index.js';

/** The message a close gets when it records a breakdown report but names no code (R3 case 1). */
export const FAILURE_CODE_REQUIRED = 'A failure code is required';
/** The message a `kind:'report'` close gets when it sends no report body at all (R3 case 2). */
export const REPORT_REQUIRED = 'A report is required to close a breakdown';
/** The message the database's own list refusal keeps, so the caller reads it instead of "Invalid report". */
export const NOT_A_FAILURE_CODE = 'That is not a failure code of this plant';

/** The report field a database failure-code refusal names, so the reply says which code was wrong. */
export function failureCodeField(error: unknown): string | null {
  if ((error as { code?: string }).code !== '23514') return null;
  const named =
    /^breakdown_report: (failure_component|failure_mode|failure_cause|failure_action) /.exec(
      (error as Error).message,
    )?.[1];
  return named ? named.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()) : null;
}

/** A report the server refuses; `field` is the reply's field and `message` is the reply's message. */
export class ReportValidationError extends Error {
  field: string;
  constructor(field: string, message = 'Invalid report') {
    super(message);
    this.field = field;
  }
}

/**
 * A ticket is a live breakdown when it is a stopped ticket raised through one of the four breakdown
 * channels. Planned work, support work, a past breakdown (`backfill`) and imported history never are:
 * one predicate, the shared channel rule, so a fourth copy of the channel names cannot drift.
 */
export function isLiveBreakdown(kind: string, channel: string | null): boolean {
  return kind === 'stopped' && isBreakdownChannel(channel);
}

/** The four failure columns and the legacy `maint_code` mirror, as the report row stores them. */
export interface ReportCodes {
  failureComponent: string | null;
  failureMode: string | null;
  failureCause: string | null;
  failureAction: string | null;
  maintCode: string | null;
}

/** The plant's canonical spelling of one value, or the value itself when the plant does not know it. */
function canonical(index: FailureCodeIndex, value: string | undefined): string | null {
  if (value === undefined) return null;
  const raw = value.trim();
  if (raw === '') return null;
  return resolveFailureCode(index, raw) ?? raw;
}

/**
 * The close's one code, resolved through this plant's list (any case, an alias included) and mirrored into
 * `maint_code`; the other three are resolved the same way when a client sends them and stay optional.
 * A live breakdown that records a report must name one code: null throws with the field and message the
 * reply pins (Q32). An unknown value is kept as it came, so the database trigger refuses it by field.
 */
export function resolveReportCodes(
  index: FailureCodeIndex,
  body: BreakdownReportBody,
  liveBreakdown: boolean,
): ReportCodes {
  const component = canonical(index, body.failureComponent ?? body.maintCode);
  if (liveBreakdown && component === null) {
    throw new ReportValidationError('failureComponent', FAILURE_CODE_REQUIRED);
  }
  return {
    failureComponent: component,
    failureMode: canonical(index, body.failureMode),
    failureCause: canonical(index, body.failureCause),
    failureAction: canonical(index, body.failureAction),
    maintCode: component,
  };
}

/**
 * The report store's entrance to the rule: seed the list first (a close is a write, R4), then resolve through
 * it. The `has…` check inside `ensureFailureCodes` answers before any lock, so an ordinary close never queues.
 */
export async function reportCodesFor(
  client: PoolClient,
  input: {
    tenantId: string;
    loginId: string | null;
    body: BreakdownReportBody;
    liveBreakdown: boolean;
  },
): Promise<ReportCodes> {
  await ensureFailureCodes(client, {
    tenantId: input.tenantId,
    loginId: input.loginId,
  });
  return resolveReportCodes(
    await failureCodeIndexOf(client, input.tenantId),
    input.body,
    input.liveBreakdown,
  );
}
