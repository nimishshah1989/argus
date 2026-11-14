import { createHash, randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { apiError } from '@uptimo/shared';
import { AUTH_MESSAGES, type AuthContext } from '../../kernel/index.js';
import type { PasswordProblem } from '@uptimo/domain';
import { findPerson, loginById, lookupSession, resolveTenant, touchSession } from './repo.js';

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

// A slug names one customer for good, so a short memory saves a lookup on every request.
const hostTenants = new Map<string, { id: string; until: number }>();
const HOST_TENANT_MS = 30_000;

/** Whether the host names this customer. A host that names no customer (`localhost`) decides nothing. */
async function hostAllows(pool: Pool, host: string, tenantId: string): Promise<boolean> {
  const slug = tenantSlugFromHost(host);
  if (!slug) return true;
  const known = hostTenants.get(slug);
  if (known && known.until > Date.now()) return known.id === tenantId;
  const tenant = await resolveTenant(pool, slug);
  if (tenant) hostTenants.set(slug, { id: tenant.id, until: Date.now() + HOST_TENANT_MS });
  return tenant?.id === tenantId;
}

/**
 * Resolve a bearer token to a session context, or null when the sign-in has ended, belongs to another
 * customer than the host names, or acts as a person who has been switched off.
 */
export async function authenticate(
  pool: Pool,
  token: string,
  host: string,
): Promise<AuthContext | null> {
  const tokenHash = hashToken(token);
  const found = await lookupSession(pool, tokenHash);
  if (!found || !(await hostAllows(pool, host, found.tenant_id))) return null;
  await touchSession(pool, found.tenant_id, tokenHash);
  const login = await loginById(pool, found.tenant_id, found.login_id);
  const person = found.acting_person_id
    ? await findPerson(pool, found.tenant_id, found.acting_person_id)
    : null;
  if (!login || (person && !person.active)) return null;
  return contextOf(token, found.tenant_id, login, person);
}

function contextOf(
  token: string,
  tenantId: string,
  login: NonNullable<Awaited<ReturnType<typeof loginById>>>,
  person: Awaited<ReturnType<typeof findPerson>> | null,
): AuthContext {
  return {
    token,
    tenantId,
    loginId: login.id,
    username: login.username,
    role: login.role,
    shared: login.shared,
    personId: person?.id ?? null,
    personName: person?.name ?? null,
    personTitle: person?.title ?? null,
    mustChangePassword: login.must_change_password,
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
