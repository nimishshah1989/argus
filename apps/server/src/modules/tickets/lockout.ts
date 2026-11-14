import type { PoolClient } from 'pg';
import { apiError, type ErrorCode, type Lockout, type LockoutStep } from '@uptimo/shared';
import { canWork, standingLockoutConfirmations, type Role } from '@uptimo/domain';
import { ensureLockoutSteps, lockoutFlagged, lockoutSteps } from '../plant/index.js';
import type { Outcome, Tx } from './mapper.js';
import { liveTicket, lockoutHistory, reportCategory } from './repo/lockout.js';

type Who = { tenantId: string; loginId: string | null };

/** A work type or category is matched by its name as a person would read it: spaces and capitals do not count. */
const norm = (name: string) => name.trim().toLowerCase();

async function flaggedNames(client: PoolClient, tenantId: string, list: string) {
  const entry = (await lockoutFlagged(client, tenantId)).find((f) => f.list === list);
  return new Set((entry?.names ?? []).map(norm));
}

/**
 * Whether a work type, as the floor sends it, is flagged "needs lockout". A work type typed in that the plant's
 * list does not hold is never flagged.
 */
export async function workTypeNeedsLockout(
  client: PoolClient,
  tenantId: string,
  workType: string | null | undefined,
): Promise<boolean> {
  return (
    workType != null && (await flaggedNames(client, tenantId, 'work_type')).has(norm(workType))
  );
}

/**
 * Where a live ticket stands on lockout; `null` when the ticket is not live (open, working, waiting).
 * `lockout` is `null` unless it needs one: its work type, or the breakdown category of its stored report, is
 * flagged. The flag is read each time (a command, a reply), so one set after the ticket was raised counts.
 */
async function readLockout(
  client: PoolClient,
  who: Who,
  ticketId: string,
): Promise<{ status: string; lockout: Lockout | null } | null> {
  const ticket = await liveTicket(client, who.tenantId, ticketId);
  if (!ticket) return null;
  const category = await reportCategory(client, who.tenantId, ticketId);
  const needed =
    (await workTypeNeedsLockout(client, who.tenantId, ticket.workType)) ||
    (category != null &&
      (await flaggedNames(client, who.tenantId, 'breakdown_category')).has(norm(category)));
  if (!needed) return { status: ticket.status, lockout: null };
  await ensureLockoutSteps(client, who);
  const standing = standingLockoutConfirmations(await lockoutHistory(client, ticketId));
  return {
    status: ticket.status,
    lockout: {
      steps: await lockoutSteps(client, who.tenantId),
      confirmations: [...standing.values()].map((e) => ({
        at: e.at.toISOString(),
        byPersonId: e.actingPersonId ?? null,
      })),
    },
  };
}

/** What a reply says about lockout: `null` unless the ticket is live and flagged. */
export async function lockoutOf(
  client: PoolClient,
  who: Who,
  ticketId: string,
): Promise<Lockout | null> {
  return (await readLockout(client, who, ticketId))?.lockout ?? null;
}

/** The reply's `lockout` key, for a reply that spreads it in. */
export async function lockoutField(
  client: PoolClient,
  tx: { tenantId: string; auth: { loginId: string } },
  ticketId: string,
): Promise<{ lockout: Lockout | null }> {
  return {
    lockout: await lockoutOf(client, { tenantId: tx.tenantId, loginId: tx.auth.loginId }, ticketId),
  };
}

const refusal = (
  status: number,
  code: ErrorCode,
  message: string,
  extra: { field?: string; steps?: LockoutStep[] } = {},
): Outcome => ({ status, body: apiError(code, message, extra.field, extra.steps) });

/** Each of these needs the acting person's own confirmation standing, while the ticket is in one of these statuses. */
const NEEDS_OWN_CONFIRMATION: Partial<Record<Tx['action'], string[]>> = {
  start: ['open'],
  resume: ['waiting'],
  join: ['working', 'waiting'],
};

function checkConfirm(tx: Tx, lockout: Lockout | null): Outcome | null {
  if (!lockout) return refusal(409, 'conflict', 'This ticket needs no lockout');
  const { steps } = lockout;
  if (steps.length === 0) return missingSteps();
  const sent = new Set(tx.body.stepCodes as string[]);
  const known = new Set(steps.map((s) => s.code));
  if ([...sent].some((code) => !known.has(code))) {
    return refusal(422, 'steps_changed', 'The lockout steps have changed; check the current ones', {
      field: 'stepCodes',
      steps,
    });
  }
  if (sent.size !== steps.length) {
    return refusal(422, 'validation', 'Confirm every lockout step', { field: 'stepCodes', steps });
  }
  tx.body.steps = steps.map((s) => s.label);
  return null;
}

const missingSteps = () =>
  refusal(
    409,
    'lockout_steps_missing',
    'This plant has no lockout steps; ask the maintenance head',
    {
      field: 'lockout',
    },
  );

/**
 * The lockout rules a command needs the plant's lists for, run inside the command's transaction; `null` lets
 * it go on. Start, a resume and a join each need the acting person's own confirmation standing, or answer 409
 * `lockout_required` (a flagged ticket whose plant has no active step answers `lockout_steps_missing`: it fails
 * closed). A confirmation names every step. A Start dated before the confirmation is refused, so the work
 * cannot be recorded as begun before the lock was on.
 */
export async function checkLockout(client: PoolClient, tx: Tx): Promise<Outcome | null> {
  const statuses = NEEDS_OWN_CONFIRMATION[tx.action];
  if (!statuses && tx.action !== 'lockout-confirm') return null;
  const actor = {
    role: tx.auth.role as Role,
    loginId: tx.auth.loginId,
    personId: tx.actingPersonId,
    shared: tx.auth.shared,
  };
  if (!canWork(actor)) return null; // the ordinary 403 answers first
  const facts = await readLockout(
    client,
    { tenantId: tx.tenantId, loginId: tx.auth.loginId },
    tx.ticketId,
  );
  if (!facts) return null; // not a live ticket: the ordinary rules answer
  if (tx.action === 'lockout-confirm') return checkConfirm(tx, facts.lockout);
  const { lockout } = facts;
  if (!lockout || !statuses?.includes(facts.status)) return null;
  if (lockout.steps.length === 0) return missingSteps();
  const mine = lockout.confirmations.find((c) => c.byPersonId === tx.actingPersonId);
  if (!mine) {
    return refusal(409, 'lockout_required', 'Confirm the lockout steps first', {
      field: 'lockout',
      steps: lockout.steps,
    });
  }
  const startedAt = tx.body.at as Date | undefined;
  if (tx.action === 'start' && startedAt && startedAt < new Date(mine.at)) {
    return refusal(422, 'validation', 'Work cannot start before the lockout was confirmed', {
      field: 'at',
    });
  }
  return null;
}
