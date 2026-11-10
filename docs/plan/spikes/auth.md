# Auth spike — hand-rolled vs better-auth

Date: 10 November 2026
Question: can better-auth express our auth model without a second schema, or do we hand-roll sessions?
Result: **hand-rolled sessions** (ADR 0003).

## Method

Both candidates ran against a real Postgres 16.15 container; better-auth also ran with its memory adapter for the sign-up/sign-in path. The scripts were throwaway and are not committed.

- Node 24.14, better-auth 1.7.19, `@node-rs/argon2` 2.2.2, `pg` 8.23.1.
- Hand-rolled: two tenants, `login` + `session`, forced RLS, `app_router` lookup function, a shared phone, a 30-day sliding session, Argon2id.
- better-auth: username + admin + multi-session + bearer plugins, Argon2id custom hasher, 30-day session, `tenantId` as an additional user field, and `tenantId` as an additional session field.

## Results

### Hand-rolled

```
{ tenantA: 1, tenantB: 1, days: '30.00', sharedActingPerson: true, tokenLength: 43 }
```

- Each tenant sees exactly its own login row; the other is invisible.
- `auth_lookup(token_hash)` returns the right tenant before `app.tenant_id` is set.
- The shared login has no person; the session carries the chosen acting person.
- The session slides to 30 days on use.
- 132 lines including the schema, functions and a two-tenant test; roughly 70 lines of auth logic.

### better-auth

```
{ status: 200, token: true, tenantId: 'tenant-a', sessionDays: 29.999999930555557 }
signup user keys: name, email, emailVerified, image, createdAt, updatedAt,
  username, displayUsername, role, banned, banReason, banExpires,
  tenantId, personId, shared, id
session keys: expiresAt, token, createdAt, updatedAt, ipAddress, userAgent,
  userId, tenantId, id
sessionTenant: null
```

- Sign-up, sign-in, Argon2id, 30-day sessions, bearer tokens and additional user fields all work.
- Core tables: `user`, `session`, `account`, `verification`; the organization plugin adds `organization`, `member`, `invitation`.
- The session table stores `token`, not a token hash.
- `session.tenantId` is accepted as an additional field but is **null after sign-in**; a custom `databaseHooks.session.create.before` or a join to `user` is needed for RLS.
- Email is required; username has a minimum length; the default session is 7 days; the default password hash is scrypt (custom Argon2id works).
- 33 lines of config with a memory adapter; no RLS, shared-phone or acting-person integration.

## What carries into M0-0.4

- `login` + `session` tables exactly as `DOMAIN.md` describes.
- Argon2id (`memoryCost` 19456, `timeCost` 2, `parallelism` 1) as the starting parameters; benchmark on the target phone/server.
- 32-byte random bearer token, SHA-256 at rest, 30-day sliding.
- `app_router.auth_lookup(token_hash)` and `app_router.tenant_by_slug(slug)` as the only cross-tenant functions.
- Shared login with `acting_person_id`; no free text.
- Tests: wrong password, disabled login, revoked session, expired session, sliding, shared acting person, cross-tenant lookup, replayed token, rate limit.
- A human security review before cutover.

## Deleted

- The two throwaway scripts and the temporary Postgres container.
- better-auth from the stack; no dependency or schema remains.

## Revisit only if

A customer requires SSO/OIDC, or the auth surface grows beyond username/password/shared phones/device revoke. Then an ADR evaluates an external IdP; it does not start from “add better-auth”.
