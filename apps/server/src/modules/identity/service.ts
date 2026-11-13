import { createHash, randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { apiError } from '@uptimo/shared';
import { AUTH_MESSAGES, type AuthContext } from '../../kernel/index.js';
import { findPerson, loginById, lookupSession, touchSession } from './repo.js';

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

/** Resolve a bearer token to a session context, or null when the sign-in has ended. */
export async function authenticate(pool: Pool, token: string): Promise<AuthContext | null> {
  const tokenHash = hashToken(token);
  const found = await lookupSession(pool, tokenHash);
  if (!found) return null;
  await touchSession(pool, found.tenant_id, tokenHash);
  const login = await loginById(pool, found.tenant_id, found.login_id);
  const person = found.acting_person_id
    ? await findPerson(pool, found.tenant_id, found.acting_person_id)
    : null;
  if (!login) return null;
  return {
    token,
    tenantId: found.tenant_id,
    loginId: login.id,
    username: login.username,
    role: login.role,
    shared: login.shared,
    personId: person?.id ?? null,
    personName: person?.name ?? null,
    personTitle: person?.title ?? null,
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
