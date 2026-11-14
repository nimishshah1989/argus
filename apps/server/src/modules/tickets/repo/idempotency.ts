import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { apiError } from '@uptimo/shared';

export type IdempotencyResult = { status: number; body: unknown };

/** Everything that identifies one command replay attempt. */
export interface IdempotencyBinding {
  tenantId: string;
  loginId: string;
  key: string;
  requestHash: string;
}

export class IdempotencyKeyReusedError extends Error {
  constructor() {
    super('idempotency key reused for a different request');
    this.name = 'IdempotencyKeyReusedError';
  }
}

/** Keys the system writes itself (an escalation step is `esc:<rule>:<episode>:<attempt>`): a client may not send one. */
export const RESERVED_KEY_PREFIX = 'esc:';

/** The client's key, or null when there is none or it starts with the reserved prefix. */
export function idempotencyKey(headers: Record<string, unknown>): string | null {
  const raw = headers['idempotency-key'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const key = typeof value === 'string' ? value.trim() : '';
  return key && !key.startsWith(RESERVED_KEY_PREFIX) ? key : null;
}

/** Deterministic serialisation: stable key order, Dates as ISO, undefined keys dropped. */
function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * `actor` is the person on a shared phone: the same key from a phone that has since changed hands is a different
 * request, never the first person's stored reply. A personal login has one person for life, so it adds nothing.
 */
export function computeRequestHash(command: string, body: unknown, actor?: string | null): string {
  return createHash('sha256')
    .update(`${command}|${stableStringify(body)}${actor ? `|as:${actor}` : ''}`)
    .digest('hex');
}

/** The person a shared phone's request is made as; undefined on a personal login. */
export const phoneActor = (auth: { shared: boolean; personId: string | null }) =>
  auth.shared ? auth.personId : undefined;

export function computeBinding(
  tenantId: string,
  loginId: string,
  key: string,
  request: [command: string, body: unknown, actor?: string | null],
): IdempotencyBinding {
  const [command, body, actor] = request;
  return { tenantId, loginId, key, requestHash: computeRequestHash(command, body, actor) };
}

export function reusedKeyOutcome(): IdempotencyResult {
  return {
    status: 422,
    body: apiError(
      'validation',
      'Idempotency key was reused for a different request',
      'idempotencyKey',
    ),
  };
}

export async function getIdempotent(
  client: PoolClient,
  binding: IdempotencyBinding,
): Promise<IdempotencyResult | null> {
  const row = (
    await client.query(
      `SELECT result, request_hash FROM command_idempotency
       WHERE tenant_id = $1 AND login_id = $2 AND key = $3
         AND created_at > now() - interval '24 hours'`,
      [binding.tenantId, binding.loginId, binding.key],
    )
  ).rows[0];
  if (!row) return null;
  if (row.request_hash !== binding.requestHash) throw new IdempotencyKeyReusedError();
  return row.result as IdempotencyResult;
}

export async function storeIdempotent(
  client: PoolClient,
  binding: IdempotencyBinding & { command: string; result: IdempotencyResult },
): Promise<void> {
  await client.query(
    `INSERT INTO command_idempotency (tenant_id, login_id, key, command, request_hash, result)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      binding.tenantId,
      binding.loginId,
      binding.key,
      binding.command,
      binding.requestHash,
      JSON.stringify(binding.result),
    ],
  );
}

export function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === '23505';
}

/** Retention: replay keys created before `cutoff`. A key only protects a replay for 24 hours; the rest is history. */
export async function purgeIdempotencyKeys(
  client: PoolClient,
  tenantId: string,
  cutoff: Date,
): Promise<number> {
  const result = await client.query(
    'DELETE FROM command_idempotency WHERE tenant_id = $1 AND created_at < $2',
    [tenantId, cutoff],
  );
  return result.rowCount ?? 0;
}
