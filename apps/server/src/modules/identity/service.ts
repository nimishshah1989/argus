import { createHash, randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { apiError } from '@uptimo/shared';
import { AUTH_MESSAGES, refuse, type AuthContext } from '../../kernel/index.js';
import type { PasswordProblem } from '@uptimo/domain';
import { actingTeams } from './repo/acting.js';
import { lookupSession, readAuthRows, touchSession, type AuthRows } from './repo.js';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

// The no-domain stage: a bare IP (the Elastic IP) has no subdomain to resolve, so it
// maps to the default tenant. Overridable, not a plant-specific value baked into logic.
const DEFAULT_TENANT_SLUG = process.env.DEFAULT_TENANT_SLUG ?? 'cosmos';

function isIpLiteral(host: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true; // IPv4
  return host.startsWith('[') && host.includes(':'); // IPv6 literal
}

export function tenantSlugFromHost(host: string): string | null {
  const clean = host.replace(/:\d+$/, '').toLowerCase();
  if (isIpLiteral(clean)) return DEFAULT_TENANT_SLUG;
  const dot = clean.indexOf('.');
  if (dot <= 0) return null;
  return clean.slice(0, dot) || null;
}

const PASSWORD_MESSAGES: Record<PasswordProblem, string> = {
  too_short: 'The password needs at least 8 characters',
  common: 'That password is too common. Choose one that is harder to guess',
  same_as_username: 'The password cannot be the same as the username',
};

export function passwordMessage(problem: PasswordProblem): string {
  return PASSWORD_MESSAGES[problem];
}

const stillAllowed = (rows: AuthRows): boolean =>
  rows.person_active === true && actingTeams(rows.role).includes(rows.person_team ?? '');

/**
 * Resolve a bearer token to a session context, or null when the sign-in has ended, belongs to another
 * customer than the host names (a host that names none, like `localhost`, decides nothing), or acts as a
 * person who has been switched off. One lookup by token, one transaction for the rest, and a write only when
 * the session is due to slide.
 */
export async function authenticate(
  pool: Pool,
  token: string,
  host: string,
): Promise<AuthContext | null> {
  const tokenHash = hashToken(token);
  const found = await lookupSession(pool, tokenHash);
  if (!found) return null;
  const slug = tenantSlugFromHost(host);
  const rows = await readAuthRows(pool, {
    tenantId: found.tenant_id,
    tokenHash,
    loginId: found.login_id,
    actingPersonId: found.acting_person_id,
    slug,
  });
  if (!rows || (slug && rows.host_tenant_id !== found.tenant_id)) return null;
  // A shared phone whose person is off, or no longer of a team its role serves, is a phone with nobody chosen: the
  // app asks again. A personal login whose person is off has ended.
  const lost = rows.shared && rows.person_id !== null && !stillAllowed(rows);
  if (rows.person_id && !rows.person_active && !lost) return null;
  // Only a call that passed every check slides the session; a refused one writes nothing.
  if (rows.stale) await touchSession(pool, found.tenant_id, tokenHash);
  const kept = lost ? { ...rows, person_id: null, person_name: null, person_title: null } : rows;
  return contextOf(token, found.tenant_id, kept);
}

function contextOf(token: string, tenantId: string, rows: AuthRows): AuthContext {
  return {
    token,
    tenantId,
    loginId: rows.login_id,
    username: rows.username,
    role: rows.role,
    shared: rows.shared,
    personId: rows.person_id,
    personName: rows.person_name,
    personTitle: rows.person_title,
    mustChangePassword: rows.must_change_password,
  };
}

/** The guard has already authenticated; this returns what it set. */
export async function requireAuth(
  _pool: Pool,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<AuthContext | null> {
  if (request.auth) return request.auth;
  reply.code(401).send(apiError('unauthenticated', AUTH_MESSAGES.missing));
  return null;
}

export const SUPPORT_NOT_ALLOWED = refuse(403, 'forbidden', 'Not allowed under support access');

/**
 * For a route our own support staff must never use, read or write (D29): who has access, the sign-ins of the
 * admin who approved it. Answers 403 and returns true when the caller is under a support grant.
 */
export function refuseSupport(ctx: AuthContext, reply: FastifyReply): boolean {
  if (!ctx.supportGrantId) return false;
  reply.code(SUPPORT_NOT_ALLOWED.status).send(SUPPORT_NOT_ALLOWED.body);
  return true;
}
