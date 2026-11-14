import type { PoolClient } from 'pg';
import { passwordProblem } from '@uptimo/domain';
import { apiError, type ErrorBody, type ErrorCode } from '@uptimo/shared';
import {
  lockPeopleWrites,
  loginAdminById,
  passwordMessage,
  personAdminById,
} from '../identity/index.js';

export type Tx = Pick<PoolClient, 'query'>;
export interface Actor {
  tenantId: string;
  loginId: string;
}
export type Outcome<T> =
  { ok: true; status: 200 | 201; value: T } | { ok: false; status: number; error: ErrorBody };

export const done = <T>(value: T, status: 200 | 201 = 200): Outcome<T> => ({
  ok: true,
  status,
  value,
});

export const fail = (
  status: number,
  code: ErrorCode,
  message: string,
  field?: string,
): Outcome<never> => ({ ok: false, status, error: apiError(code, message, field) });

export const lastAdmin = () =>
  fail(409, 'conflict', 'At least one admin login must stay switched on', 'role');

export function weakPassword(
  password: string,
  username: string,
  field: string,
): Outcome<never> | null {
  const problem = passwordProblem(password, username);
  return problem ? fail(422, 'validation', passwordMessage(problem), field) : null;
}

/**
 * Takes the one-writer-at-a-time lock for the customer, then checks that the admin who asked is still an admin:
 * the sign-in was checked before the lock, and the admin may have been switched off or demoted while waiting.
 */
export async function lockAsAdmin(tx: Tx, actor: Actor): Promise<Outcome<never> | null> {
  await lockPeopleWrites(tx, actor.tenantId);
  const me = await loginAdminById(tx, actor.loginId);
  const person = me?.personId ? await personAdminById(tx, me.personId) : undefined;
  const stillAdmin = me && me.active && !me.shared && me.role === 'admin' && person?.active;
  return stillAdmin ? null : fail(403, 'forbidden', 'You do not have permission for this action');
}
