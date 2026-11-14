import { timingSafeEqual } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { LIST_NAMES, isUuid } from '@uptimo/shared';
import {
  refuse,
  withTenant,
  type AuthContext,
  type Refusal,
  type SupportCall,
} from '../../kernel/index.js';
import { audit } from '../ops/index.js';
import { createLoginGuard } from './login-guard.js';
import { resolveTenant } from './repo.js';
import { grantById } from './repo/support.js';
import { SUPPORT_NOT_ALLOWED, hashToken, tenantSlugFromHost } from './service.js';

/**
 * How one of our own staff gets into a customer's data (D29). A call carries that person's key as the bearer
 * token and names a grant in `X-Support-Grant`. The key says who is calling; the grant, which only the
 * customer's admin can create, says whether they may. Every call is written to the customer's audit trail
 * before it runs, and a call that cannot be written down does not run.
 */

/** Platform user → SHA-256 (hex) of their key. The key itself is never configured, stored or logged. */
export type SupportKeys = ReadonlyMap<string, string>;

const ENTRY = /^([^:,]{1,80}):([0-9a-f]{64})$/i;

/** Reads `SUPPORT_KEYS` (`name:sha256hex,name2:sha256hex`). A value that cannot be read stops the server. */
export function parseSupportKeys(raw: string | undefined): SupportKeys {
  const keys = new Map<string, string>();
  for (const part of (raw ?? '').split(',').filter((p) => p.trim())) {
    const [, name, hash] = ENTRY.exec(part.trim()) ?? [];
    const user = name?.trim();
    const digest = hash?.toLowerCase();
    if (!user || !digest || keys.has(user) || [...keys.values()].includes(digest))
      throw new Error('SUPPORT_KEYS: each entry is name:sha256-hex; no name or key may repeat');
    keys.set(user, digest);
  }
  return keys;
}

/** 32 random bytes in base64url. A shorter key is refused unread, so a guessable one can never be issued. */
const MIN_KEY_LENGTH = 43;

/** Whose key this is. Every configured key is compared, in constant time, whichever one matches. */
function platformUserOf(keys: SupportKeys, key: string): string | null {
  if (key.length < MIN_KEY_LENGTH) return null;
  const presented = Buffer.from(hashToken(key), 'hex');
  let found: string | null = null;
  for (const [user, hash] of keys)
    if (timingSafeEqual(presented, Buffer.from(hash, 'hex'))) found = user;
  return found;
}

const ENDED = refuse(403, 'forbidden', 'Support access is not approved or has ended');
const TOO_MANY = refuse(429, 'rate_limited', 'Too many attempts. Try again in a few minutes');

/**
 * The only routes a support person may write to: plant settings and lists. Any other write is refused, so a
 * route added later is closed until it is listed here. Tickets, people and logins are never listed: under a
 * grant nobody raises, works, closes or corrects a ticket, or changes who can sign in.
 */
export const SUPPORT_WRITES: ReadonlySet<string> = new Set([
  'PUT /api/v1/settings/:key',
  'PUT /api/v1/settings/sla-policies',
  'PUT /api/v1/lists/:list/:code',
  'DELETE /api/v1/lists/:list/:id',
  'PUT /api/v1/translations/:id',
  'POST /api/v1/settings/glossary',
  'PUT /api/v1/settings/glossary/:id',
  ...LIST_NAMES.flatMap((list) => [
    `POST /api/v1/settings/lists/${list}`,
    `PUT /api/v1/settings/lists/${list}/:id`,
  ]),
]);

const isRead = (method: string): boolean => method === 'GET' || method === 'HEAD';

interface Attempt {
  tenantId: string;
  platformUser: string;
  key: string;
  call: SupportCall;
}

/** `grantKnown`: the refusal is about a grant of this customer, so it is written to that grant's trail. */
interface Refused {
  refusal: Refusal;
  grantKnown: boolean;
}

const lineOf = ({ tenantId, call }: Attempt, kind: 'request' | 'refused') => ({
  tenantId,
  grantId: call.grantId,
  kind,
  method: call.method,
  route: call.route,
  ip: call.ip,
});

/**
 * Judges one call against the grant it names. A call that is let in is written to the audit trail here, in
 * the transaction that read the grant: if that line cannot be written this throws, the guard answers 500 and
 * the route never runs.
 */
async function judge(tx: PoolClient, attempt: Attempt): Promise<AuthContext | Refused> {
  const { tenantId, platformUser, call } = attempt;
  const grant = await grantById(tx, tenantId, call.grantId);
  if (!grant) return { refusal: ENDED, grantKnown: false };
  const approver = grant.approved_by_login_id;
  if (!approver || !grant.live || grant.platform_user !== platformUser)
    return { refusal: ENDED, grantKnown: true };
  if (!isRead(call.method) && !SUPPORT_WRITES.has(`${call.method} ${call.route}`))
    return { refusal: SUPPORT_NOT_ALLOWED, grantKnown: true };
  await audit.supportCall(tx, lineOf(attempt, 'request'));
  return {
    token: attempt.key,
    tenantId,
    // Rows need a login; the grant has exactly one, the admin who approved it. `supportGrantId` says who called.
    loginId: approver,
    username: `support:${platformUser}`,
    role: 'admin',
    shared: false,
    personId: null,
    personName: `${platformUser} (support)`,
    personTitle: null,
    mustChangePassword: false,
    supportGrantId: grant.id,
  };
}

/** A refused call is written down too, on its own, and the refusal stands whether or not that worked. */
async function useGrant(pool: Pool, attempt: Attempt): Promise<AuthContext | Refusal> {
  const verdict = await withTenant(pool, attempt.tenantId, (tx) => judge(tx, attempt));
  if (!('refusal' in verdict)) return verdict;
  if (verdict.grantKnown)
    await withTenant(pool, attempt.tenantId, (tx) =>
      audit.supportCall(tx, lineOf(attempt, 'refused')),
    ).catch((error: Error) =>
      console.error('support access: a refused call could not be audited:', error.message),
    );
  return verdict.refusal;
}

const ATTEMPTS = 'support-key';

/**
 * Builds the guard's way in for support calls. Wrong keys from one address are limited like wrong passwords
 * (about 20 in 5 minutes, then 429); a right key gives its attempt back.
 */
export function supportAuthenticator(pool: Pool, keys: SupportKeys = new Map()) {
  const attempts = createLoginGuard();
  return async (
    key: string,
    host: string,
    call: SupportCall,
  ): Promise<AuthContext | Refusal | null> => {
    if (attempts.take(call.ip, ATTEMPTS, ATTEMPTS) > 0) return TOO_MANY;
    const platformUser = platformUserOf(keys, key);
    if (!platformUser) return null;
    attempts.refund(call.ip, ATTEMPTS, ATTEMPTS);
    if (!isUuid(call.grantId)) return null;
    const slug = tenantSlugFromHost(host);
    const tenant = slug ? await resolveTenant(pool, slug) : null;
    if (!tenant) return null;
    return useGrant(pool, { tenantId: tenant.id, platformUser, key, call });
  };
}
