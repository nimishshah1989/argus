# 02 — Module boundaries: expand

Issue: [#77](https://github.com/nimishshah1989/argus/issues/77) · Milestone M0 · Blocked by: 01 (done, #145) · Branch
`claude/t02-module-boundaries-expand`. One PR, body contains `Closes #77`, labels `no-parity` (no parity row
changes) and `size:large` (reason: wide refactor, mostly moved lines; expected > 800 changed lines). One commit
per task in §6.

## 1. Goal

The server checks "are you signed in?" in one place for every route, and its operations, identity and plant code
live in module folders whose only SQL file is `repo.ts`, with a check that fails when SQL on those tables shows up
anywhere else. Nothing a user sees changes.

## 2. Decisions (technical; the orchestrator's rulings are applied, deviations are marked **D**)

1. **Expand step.** New code lives in `apps/server/src/kernel/` and `apps/server/src/modules/{ops,identity,plant}/`.
   Old paths that tests or unmoved files import become one-line **named** re-export shims (named, not `export *`,
   so a shim cannot widen the surface). Ticket 03 deletes the shims. Unmoved files (`tickets.ts`, `push.ts`,
   `reports.ts`, `tags.ts`, `ticket-list.ts`, `index.ts`, `import/cli.ts`, `jobs/sla-timer.ts`) are **not edited**:
   they keep importing the old paths through the shims (the smallest diff).
2. **Guard hook = route-level `preParsing`, attached in an `onRoute` hook** (refines "an `onRequest` hook").
   Measured on the installed Fastify 5.12.8 and `@fastify/rate-limit` 10.3.0:
   - rate-limit attaches its own route-level `onRequest` hook in `onRoute`. A global `onRequest` guard would run
     **before** it, so an unauthenticated flood would get 401 instead of 429 (a behaviour change). `preParsing`
     always runs after every `onRequest` hook, so the order is right whatever the registration order;
   - a route-level hook never runs for an unmatched URL, so 404s skip the guard with no extra code;
   - Fastify reports the auto-created `HEAD` route to `onRoute` separately; the guard is added once per route
     (an `includes` check), so a `HEAD` request authenticates once (measured: 3 requests, 3 calls);
   - the same `onRoute` hook records the route table that the guard test is generated from (`printRoutes` is a
     text tree and there is no public route list).
3. **Public allowlist** = `GET /api/v1/health`, `GET /api/v1/brand`, `POST /api/v1/auth/login`. `HEAD` counts as
   its `GET` (today `HEAD /api/v1/health` answers 200; uptime pings may use it).
4. **Intended behaviour changes (the guard's purpose; no existing test asserts the old answers):**
   `POST /api/v1/auth/password` without a session and with a bad body answered 422 (body checked before auth);
   it now answers 401. Any protected route called without a session and with malformed JSON answered 400; it now
   answers 401. Every other answer is unchanged: same 401 bodies and messages, same queries in the same order,
   one authentication per request (the guard authenticates; `requireAuth` returns what the guard set).
5. **Kernel imports no module.** `registerAuthGuard(app, authenticate)` takes identity's `authenticate` as a
   parameter; `app.ts` wires it. `bearerToken` (HTTP header parsing) moves to the kernel; it is used only by the
   guard, so `src/session.ts` stops exporting it (no test or file imports it).
6. **Request context.** The existing `AuthContext` shape (`token, tenantId, loginId, username, role, shared,
personId, personName, personTitle`) moves to `kernel/context.ts` unchanged, and `request.auth` carries it.
   ARCHITECTURE rule 7's `{tenantId, login, actingPersonId, now}` maps onto it (`login` = `loginId/username/role/shared`,
   `actingPersonId` = `personId`); `now` is not added because no handler needs it (Karpathy 2). Renaming fields
   would edit every handler: not this slice.
7. **Jobs.** `jobs/index.ts` (`startJobs`) imports the SLA handlers (future `accountability`), so it **stays where it
   is**. Only the generic parts move to `kernel/jobs.ts`: `jobDb` (from `jobs/adapter.ts`, which becomes a shim),
   and the `JobRole` and `JobsHandle` types (re-exported from `jobs/index.ts`).
8. **`AppConfig`** moves to `kernel/module.ts` (a module's `register(app, config)` needs it and the kernel imports no
   legacy file); `src/config.ts` becomes the one-line shim `export type { AppConfig } …`, so every importer is unchanged.
9. **identity.** All SQL on `tenant`, `person`, `login`, `session`, `platform_access` and the functions `auth_lookup`,
   `tenant_by_slug`, `tenant_info` moves into `modules/identity/repo.ts`. `loadConfig`'s `person` and `tenant_info`
   reads become identity's published `listPeople(tx)` and `tenantInfo(tx, tenantId)`; plant calls them on its open
   transaction (ARCHITECTURE rule 2). Repo functions keep today's transaction boundaries exactly (a function that
   wrapped its own `withTenant` still does; the password change keeps its one transaction in `routes.ts`).
10. **plant.** Owns `/config`, `/settings`, `/settings/:key`, `/lists/*`, `/translations/*`.
    **D:** `PUT /settings/sla-policies` and `PUT /machines/:id/criticality` **stay in `src/settings.ts`** (still
    registered by `registerSettings` in `app.ts`). Both write `ticket` and `sla_policy` and reconcile SLA timers
    (tables of `tickets` and `accountability`, which plant may not call). Their plant-table SQL moves out: the
    `UPDATE machine` becomes plant's `setMachineCriticality(tx, id, criticality)` and `SELECT 1 FROM shift` becomes
    plant's `hasShifts(tx)`. Ticket 03 moves the two routes into `accountability`/`tickets`.
    The role rule `canWrite` and the 403 helper `forbidden` move to `plant/routes.ts` and are published by plant's
    index for `settings.ts` (no duplicate); ticket 03 makes permissions one file.
11. **`sla_policy` (accountability's table).** No `sla_policy` SQL enters `modules/`. `loadSlaPolicies` and its
    mapper move verbatim from `config.ts` to `src/ticket/sla.ts` (the future `accountability`); plant's `loadConfig`
    imports it from there. This is the one upward import from a module to a legacy file, named here for 04
    (SLA becomes a reply part). The tool does not track `sla_policy` yet (not a moved module's table), so nothing is
    baselined for it.
12. **ops.** Owns `audit_log` only. The two `INSERT INTO audit_log` (settings, import undo) become
    `audit.record(tx, entry)`, one SQL statement that names `entity_id` explicitly (NULL for settings, the batch id
    for undo) and leaves `ip` out (NULL in both today; the column has no default). ops registers **no route** this
    ticket: `/health` stays textually in `app.ts` for ticket 13.
13. **Boundary check** `tools/check-boundaries.ts`, DB-free, in the style of `check-docs.ts`:
    - scans every non-`.test.ts` `.ts` file under `apps/server/src`;
    - SQL = the text of string literals, no-substitution templates and template literals (their static parts),
      taken from the TypeScript AST (`typescript` is already a root devDependency, so no new dependency). Comments
      and identifiers are never read;
    - a table is the word after `from`, `join`, `into` or `update` (case-insensitive; covers `DELETE FROM` and
      `FROM fn(...)`);
    - an owned table named outside its owner's `apps/server/src/modules/<owner>/repo.ts` fails, unless the
      in-tool `LEGACY` baseline lists that table for that file;
    - a `LEGACY` entry the file no longer needs also fails ("stale"), so the baseline only shrinks; ticket 03 empties it.
      **D (to note, not blocking):** ARCHITECTURE §2 has the tool read `modules/manifest.ts`. Per the ruling, the
      ownership table and `LEGACY` live in the tool this ticket; 03 can move them into the manifest when it adds
      "modules callable".
14. **CI wiring.** The sibling tools run through `audit:lean` (`pnpm size && pnpm deps && pnpm shortcuts`), which the
    `static` job runs. `boundaries` is appended there; `.github/workflows/ci.yml` is not edited.
    `tools/boundaries.test.ts` runs in the stop hook's fast tests (`tools`) and in the `api` shards.
15. **Merge-conflict care with ticket 13.** In `app.ts` the lines `const app = Fastify({ logger: config.logger ?? false });`
    and `app.get('/api/v1/health', async () => ({ status: 'ok' }));` stay byte-identical. The guard line goes
    between `app.addHook('onClose', …)` and `await app.register(rateLimit, …)`, which touches neither. Replacing
    `registerAuth(app, config);` (the line after `/health`) cannot be avoided; a conflict there is trivial.

## 3. Files

All paths under `apps/server/src/` unless stated. "Verbatim" means the body moves unchanged except imports and the
named SQL extraction.

### Kernel (new)

| File                | Content                                                                                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kernel/context.ts` | `AuthContext` interface (verbatim from `auth.ts:17-27`, now exported) and the Fastify augmentation `declare module 'fastify' { interface FastifyRequest { auth: AuthContext \| null } }`. |
| `kernel/jobs.ts`    | `jobDb` (verbatim from `jobs/adapter.ts`), `JobRole` and `JobsHandle` (verbatim from `jobs/index.ts:10, 27-30`).                                                                          |
| `kernel/module.ts`  | `AppConfig` (verbatim from `config.ts:123-135`, its `JobsHandle` import now `./jobs.js`), `ModuleDefinition`, `defineModule`.                                                             |
| `kernel/guard.ts`   | `AUTH_MESSAGES`, `PUBLIC_ROUTES`, `isPublicRoute`, `bearerToken` (verbatim from `session.ts:11-15`), `registerAuthGuard`, `routeTable` (§4).                                              |
| `kernel/index.ts`   | The kernel's published interface: `export { withTenant } from '@uptimo/db';` plus the re-exports listed in §4. Nothing else.                                                              |

### Modules (new)

| File                          | Content                                                                                                                                                                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modules/index.ts`            | The manifest: `export const modules: readonly ModuleDefinition[] = [opsModule, identityModule, plantModule];`                                                                                                                                                                               |
| `modules/ops/repo.ts`         | `AuditEntry`, `recordAudit` (§4). The only `audit_log` SQL.                                                                                                                                                                                                                                 |
| `modules/ops/index.ts`        | `audit`, `AuditEntry`, `opsModule` (register is a no-op).                                                                                                                                                                                                                                   |
| `modules/identity/repo.ts`    | Every identity SQL statement (§4): from `auth.ts` (`auth_lookup`, the session touch, login by id, person by id, `findLogin`, `insertSession`, logout revoke, the three password-change statements), `tenant.ts` (`resolveTenant`, `TenantRow`), `config.ts` (`person` list, `tenant_info`). |
| `modules/identity/service.ts` | `hashToken`, `newToken` (verbatim from `session.ts`), `tenantSlugFromHost` with `isIpLiteral` and `DEFAULT_TENANT_SLUG` (verbatim from `tenant.ts`), `authenticate`, `requireAuth` (§4).                                                                                                    |
| `modules/identity/routes.ts`  | `PASSWORD_OPTS`, `userFrom`, `login`, `me`, `logout`, `changePassword`, `brand` (verbatim from `auth.ts`, SQL replaced by repo calls), `registerIdentityRoutes` (the five routes of `registerAuth`, same paths and methods).                                                                |
| `modules/identity/index.ts`   | Published: `authenticate`, `requireAuth`, `tenantSlugFromHost`, `hashToken`, `resolveTenant`, `TenantRow`, `listPeople`, `tenantInfo`, `identityModule`.                                                                                                                                    |
| `modules/plant/repo.ts`       | Every plant SQL statement (§4): the six plant reads of `loadConfig`, and the SQL of `listSettings`, `putSetting`, `listItems`, `upsertListItem`, `deleteListItem`, `missingTranslations`, `putTranslation`, the criticality `UPDATE machine`, the `shift` probe.                            |
| `modules/plant/service.ts`    | `ConfigPayload`, `listItem` mapper, `fingerprint` (verbatim from `config.ts`), `loadConfig` (§4).                                                                                                                                                                                           |
| `modules/plant/routes.ts`     | `canWrite`, `forbidden` (exported), `handleConfig`, `listSettings`, `putSetting`, `listItems`, `upsertListItem`, `deleteListItem`, `missingTranslations`, `putTranslation` (verbatim from `settings.ts:23-178`, SQL replaced by repo calls), `registerPlantRoutes` (§4).                    |
| `modules/plant/index.ts`      | Published: `hasShifts`, `setMachineCriticality`, `canWrite`, `forbidden`, `plantModule`.                                                                                                                                                                                                    |

Every module file imports `withTenant` from `../../kernel/index.js` (never `@uptimo/db` directly) and another
module only through its `index.js`.

### Old paths (edited)

| File              | After this slice                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `auth.ts`         | One line: `export { requireAuth } from './modules/identity/index.js';`                                                                                                                                                                                                                                                                                                               |
| `session.ts`      | One line: `export { hashToken } from './modules/identity/index.js';`                                                                                                                                                                                                                                                                                                                 |
| `tenant.ts`       | One line: `export { resolveTenant, tenantSlugFromHost, type TenantRow } from './modules/identity/index.js';`                                                                                                                                                                                                                                                                         |
| `config.ts`       | One line: `export type { AppConfig } from './kernel/index.js';`                                                                                                                                                                                                                                                                                                                      |
| `jobs/adapter.ts` | One line: `export { jobDb } from '../kernel/index.js';`                                                                                                                                                                                                                                                                                                                              |
| `jobs/index.ts`   | Delete `export type JobRole = …` (line 10) and `export interface JobsHandle {…}` (lines 27-30). Add after the existing imports: `import type { JobRole, JobsHandle } from '../kernel/index.js';` and `export type { JobRole, JobsHandle };`. Nothing else.                                                                                                                           |
| `settings.ts`     | Keeps only `unchangedPolicies`, `upsertSlaPolicies`, `putSlaPolicies`, `putMachineCriticality`, `registerSettings` (now registering only `PUT /api/v1/settings/sla-policies` and `PUT /api/v1/machines/:id/criticality`). Edits in §3a.                                                                                                                                              |
| `ticket/sla.ts`   | Gains `slaPolicyDto` and `loadSlaPolicies` (verbatim from `config.ts:22-37`; `loadSlaPolicies` exported). Line 4 becomes `import type { SlaPolicy as SlaPolicyReply, SlaProjection, SlaTimer } from '@uptimo/shared';` and the moved code uses `SlaPolicyReply` (the file already imports `SlaPolicy` from `@uptimo/domain`). The existing policy query near line 93 is not touched. |
| `import/undo.ts`  | In `finishUndo`, the `INSERT INTO audit_log …` call becomes `await audit.record(client, { tenantId: batch.tenantId, loginId: null, action: 'import.undo', entity: 'import_batch', entityId: batchId, before, after });`. Add `import { audit } from '../modules/ops/index.js';`.                                                                                                     |
| `app.ts`          | §3b.                                                                                                                                                                                                                                                                                                                                                                                 |

**§3a `settings.ts` edits.**

- Delete `canWrite`, `forbidden`, `handleConfig`, `listSettings`, `putSetting`, `listItems`, `upsertListItem`,
  `deleteListItem`, `missingTranslations`, `putTranslation` (now in `plant/routes.ts`).
- `upsertSlaPolicies`: the `INSERT INTO audit_log` call becomes
  `await audit.record(client, { tenantId, loginId, action: 'sla_policy.update', entity: 'sla_policy', before, after: policies });`.
- `putSlaPolicies`: `const shifts = await client.query('SELECT 1 FROM shift LIMIT 1'); if (shifts.rowCount === 0) {`
  becomes `if (!(await hasShifts(client))) {` (the 422 reply inside is unchanged).
- `putMachineCriticality`: inside the transaction, the `UPDATE machine …` query becomes
  `const count = await setMachineCriticality(client, id, criticality); if (count === 0) return 0;`; the callback ends
  `return count;`; after it, `if (updated.rowCount === 0)` becomes `if (updated === 0)`. Everything else unchanged.
- `registerSettings` keeps only the two routes above; `handleConfig`'s import of `fingerprint, loadConfig` goes.
- Imports become: `fastify` types, `pg` types (`Pool`, `PoolClient`), `PgBoss` type, from `@uptimo/shared` only
  `apiError, machineCriticalitySchema, slaPoliciesUpdateSchema`, `withTenant` from `@uptimo/db` (unchanged; legacy
  file), `computeSeverity`, `loadSeverityMatrix`, `reconcileSlaPolicies`, `lockRefCounter`, `requireAuth` from
  `./auth.js`, `type AppConfig` from `./config.js`, `audit` from `./modules/ops/index.js`, and
  `canWrite, forbidden, hasShifts, setMachineCriticality` from `./modules/plant/index.js`.

**§3b `app.ts` edits (exactly these).**

- Delete line 5 `import { registerAuth } from './auth.js';`.
- After the last import add: `import { registerAuthGuard } from './kernel/index.js';`,
  `import { modules } from './modules/index.js';`, `import { authenticate } from './modules/identity/index.js';`.
- Between `app.addHook('onClose', async () => jobs.close());` and `await app.register(rateLimit, …);` insert
  `registerAuthGuard(app, (token) => authenticate(config.pool, token));`.
- Replace `registerAuth(app, config);` with `for (const mod of modules) mod.register(app, config);`.
- `const app = Fastify({ logger: config.logger ?? false });`, `app.get('/api/v1/health', …)`, `registerSettings`,
  the other register calls and the error handler are untouched.

### Tools, scripts, tests, docs

| File                                         | Change                                                                                                                                   |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `tools/check-boundaries.ts` (new)            | §4.                                                                                                                                      |
| `tools/boundaries.test.ts` (new)             | B1–B7.                                                                                                                                   |
| `apps/server/test/guard.test.ts` (new)       | G1–G6.                                                                                                                                   |
| `package.json`                               | Add `"boundaries": "tsx tools/check-boundaries.ts"`; `audit:lean` becomes `pnpm size && pnpm deps && pnpm shortcuts && pnpm boundaries`. |
| `changes/77-module-boundaries-expand.md`     | New fragment, text in §6.                                                                                                                |
| `docs/plan/MILESTONES.md`                    | Row 02 becomes `\| 02  \| Module boundaries: expand \| M0 \| done \| #<n> \|` (prettier aligns).                                         |
| `wiki/log.md`                                | Append one line (§6).                                                                                                                    |
| `docs/HANDOFF.md`                            | The "Guards" bullet and the "Next" bullet (§6).                                                                                          |
| `docs/slices/02-module-boundaries-expand.md` | §8 Evidence, filled by the builder.                                                                                                      |

Not touched: `apps/web`, `infra/`, `.github/`, any migration, `apps/server/test/*` other than the new
`guard.test.ts`, `packages/*`.

## 4. Interfaces

```ts
// kernel/context.ts
export interface AuthContext {
  token: string;
  tenantId: string;
  loginId: string;
  username: string;
  role: string;
  shared: boolean;
  personId: string | null;
  personName: string | null;
  personTitle: string | null;
}
declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}

// kernel/jobs.ts
export type JobRole = 'all' | 'api' | 'worker';
export interface JobsHandle {
  boss: PgBoss;
  close: () => Promise<void>;
}
export function jobDb(client: PoolClient): Db; // verbatim

// kernel/module.ts
export interface AppConfig {
  /* verbatim from config.ts */
}
export interface ModuleDefinition {
  readonly name: string;
  readonly register: (app: FastifyInstance, config: AppConfig) => void;
}
export function defineModule(definition: ModuleDefinition): ModuleDefinition; // returns its argument

// kernel/guard.ts
export const AUTH_MESSAGES: {
  readonly missing: 'Missing bearer token';
  readonly ended: 'Your sign-in has ended. Please sign in again.';
};
export const PUBLIC_ROUTES: ReadonlySet<string>; // 'GET /api/v1/health', 'GET /api/v1/brand', 'POST /api/v1/auth/login'
export interface RouteKey {
  method: string;
  url: string;
}
export type Authenticate = (token: string) => Promise<AuthContext | null>;
export function isPublicRoute(method: string, url: string): boolean; // HEAD is looked up as GET
export function bearerToken(authorization?: string): string | null; // verbatim; not re-exported by kernel/index
export function registerAuthGuard(app: FastifyInstance, authenticate: Authenticate): void;
export function routeTable(app: FastifyInstance): readonly RouteKey[]; // tables.get(app) ?? []
```

`registerAuthGuard` (≈ 25 lines):

- create `table: RouteKey[]`, store it in a module-level `WeakMap<FastifyInstance, RouteKey[]>` under `app`;
- `app.decorateRequest('auth', null)`;
- define one `guard` (async `preParsing` handler `(request, reply, payload)`):
  - `token = bearerToken(request.headers.authorization)`; none → `return reply.code(401).send(apiError('unauthenticated', AUTH_MESSAGES.missing))`;
  - `auth = await authenticate(token)`; null → `return reply.code(401).send(apiError('unauthenticated', AUTH_MESSAGES.ended))`;
  - `request.auth = auth; return payload;`
- `app.addHook('onRoute', (route) => …)`:
  - for each method of `[route.method].flat()`, push `{ method, url: route.url }` to `table`;
  - if some method is not public (`isPublicRoute`), set `route.preParsing` to the existing hooks
    (`[route.preParsing ?? []].flat()`) plus `guard`, unless they already include `guard`.

Measured with a probe on the installed versions: 401 without a header; the handler sees `request.auth`; 429 still
wins over 401; an unknown URL answers 404; `HEAD` authenticates once.

```ts
// kernel/index.ts — re-exports only
export { withTenant } from '@uptimo/db';
export type { AuthContext } from './context.js';
export { AUTH_MESSAGES, PUBLIC_ROUTES, isPublicRoute, registerAuthGuard, routeTable,
  type Authenticate, type RouteKey } from './guard.js';
export { defineModule, type AppConfig, type ModuleDefinition } from './module.js';
export { jobDb, type JobRole, type JobsHandle } from './jobs.js';

// modules/ops/repo.ts
export interface AuditEntry {
  tenantId: string; loginId: string | null; action: string; entity: string;
  entityId?: string | null; before: unknown; after: unknown;
}
/** INSERT INTO audit_log (tenant_id, login_id, action, entity, entity_id, before, after) VALUES ($1..$7);
 *  values [tenantId, loginId, action, entity, entityId ?? null, JSON.stringify(before), JSON.stringify(after)] */
export function recordAudit(tx: Pick<PoolClient, 'query'>, entry: AuditEntry): Promise<void>;
// modules/ops/index.ts
export const audit: { record: typeof recordAudit };
export type { AuditEntry };
export const opsModule: ModuleDefinition; // defineModule({ name: 'ops', register: () => undefined })

// modules/identity/repo.ts — Db = Pick<PoolClient, 'query'>; SQL text of each is today's, unchanged
export interface TenantRow { id: string; slug: string; name: string; language: string; time_zone: string }
export interface SessionLookup { tenant_id: string; login_id: string; acting_person_id: string | null }
export function resolveTenant(pool: Pool, slug: string): Promise<TenantRow | null>;              // pool.query tenant_by_slug
export function lookupSession(pool: Pool, tokenHash: string): Promise<SessionLookup | undefined>;  // pool.query auth_lookup
export function touchSession(pool: Pool, tenantId: string, tokenHash: string): Promise<void>;     // own withTenant
export function loginById(pool: Pool, tenantId: string, loginId: string):
  Promise<{ id: string; username: string; role: string; shared: boolean } | undefined>;          // own withTenant
export function findPerson(pool: Pool, tenantId: string, personId: string):
  Promise<{ id: string; name: string; title: string | null } | undefined>;                       // own withTenant (verbatim)
export async function findLogin(pool: Pool, tenantId: string, username: string); // verbatim; no return annotation (pg's row type as today, no explicit `any`)
export function insertSession(pool: Pool, args: { tenantId: string; loginId: string; device?: string;
  actingPersonId: string; tokenHash: string }): Promise<void>; // own withTenant; caller makes the token
export function revokeSession(pool: Pool, tenantId: string, tokenHash: string): Promise<void>;    // own withTenant (logout)
export function passwordHashOf(tx: Db, loginId: string): Promise<string>;                          // in caller's tx
export function setPasswordHash(tx: Db, loginId: string, hash: string): Promise<void>;             // in caller's tx
export function revokeOtherSessions(tx: Db, loginId: string, keepTokenHash: string): Promise<void>; // in caller's tx
export function listPeople(tx: Db): Promise<Record<string, unknown>[]>;   // SELECT id, name, team, title, active, phone FROM person ORDER BY name
export function tenantInfo(tx: Db, tenantId: string): Promise<{ language: string; time_zone: string }>; // tenant_info($1) row 0

// modules/identity/service.ts
export function hashToken(token: string): string;  // verbatim
export function newToken(): string;                // verbatim
export function tenantSlugFromHost(host: string): string | null; // verbatim
/** Today's requireAuth lookups, same order: lookupSession → touchSession → loginById → findPerson (if acting)
 *  → null if no session row or no login; else the AuthContext built exactly as today. */
export function authenticate(pool: Pool, token: string): Promise<AuthContext | null>;
/** Same signature as today. Returns request.auth (set by the guard). If it is null (unreachable on a guarded
 *  route), replies 401 apiError('unauthenticated', AUTH_MESSAGES.missing) and returns null. */
export function requireAuth(_pool: Pool, request: FastifyRequest, reply: FastifyReply): Promise<AuthContext | null>;

// modules/identity/routes.ts
export function registerIdentityRoutes(app: FastifyInstance, config: AppConfig): void;
//   GET /api/v1/brand, POST /api/v1/auth/login, GET /api/v1/auth/me, POST /api/v1/auth/logout, POST /api/v1/auth/password
//   login: const token = newToken(); await insertSession(pool, { …, tokenHash: hashToken(token) }); reply as today.
//   changePassword: the same single withTenant transaction; its three queries become
//   passwordHashOf / setPasswordHash / revokeOtherSessions; verify and hash stay in the transaction as today.
// modules/identity/index.ts
export const identityModule: ModuleDefinition; // defineModule({ name: 'identity', register: registerIdentityRoutes })

// modules/plant/repo.ts — Db = Pick<PoolClient, 'query'>; every function runs in the caller's tx; SQL text unchanged
export function loadPlantRows(tx: Db): Promise<{ lists: Record<string, unknown>[]; segments: …; groups: …;
  machines: …; shifts: …; settings: { key: string; value: unknown }[] }>; // the six plant queries of loadConfig, in today's order
export function selectSettings(tx: Db): Promise<Record<string, unknown>[]>;            // listSettings
export function upsertSetting(tx: Db, tenantId: string, key: string, value: unknown): Promise<void>; // JSON.stringify(value) inside
export function selectListItems(tx: Db, list: string): Promise<Record<string, unknown>[]>;
export function saveListItem(tx: Db, item: { tenantId: string; list: string; code: string; body: ListUpsertBody }): Promise<void>;
export function removeListItem(tx: Db, id: string): Promise<void>;
export function selectMissingTranslations(tx: Db): Promise<Record<string, unknown>[]>;
export function updateTranslation(tx: Db, id: string, labelGu: string | null, labelHi: string | null): Promise<void>;
export function setMachineCriticality(tx: Db, id: string, criticality: Criticality | null): Promise<number>; // rowCount ?? 0
export function hasShifts(tx: Db): Promise<boolean>; // SELECT 1 FROM shift LIMIT 1 → (rowCount ?? 0) > 0
// (ListUpsertBody, Criticality: existing types in @uptimo/shared)

// modules/plant/service.ts
export interface ConfigPayload { /* verbatim */ }
export function fingerprint(payload: unknown): string; // verbatim
/** One withTenant transaction: loadPlantRows(tx), listPeople(tx), loadSlaPolicies(tx), tenantInfo(tx, tenantId);
 *  returns the object with keys in today's order: features, language, timeZone, lists, segments, groups,
 *  machines, people, shifts, severityMatrix, slaPolicies (the fingerprint depends on it). Defaults verbatim. */
export function loadConfig(pool: Pool, tenantId: string): Promise<ConfigPayload>;

// modules/plant/routes.ts
export function canWrite(role: string): boolean;     // verbatim
export function forbidden(reply: FastifyReply): void; // verbatim
export function registerPlantRoutes(app: FastifyInstance, config: AppConfig): void;
//   GET /api/v1/config, GET /api/v1/settings, PUT /api/v1/settings/:key, GET /api/v1/lists/:list,
//   PUT /api/v1/lists/:list/:code, DELETE /api/v1/lists/:list/:id, GET /api/v1/translations/missing,
//   PUT /api/v1/translations/:id — handlers verbatim; each `withTenant(pool, id, (client) => client.query(…))`
//   becomes `withTenant(pool, id, (client) => <repo fn>(client, …))`, same status codes and bodies.
// modules/plant/index.ts
export const plantModule: ModuleDefinition; // defineModule({ name: 'plant', register: registerPlantRoutes })
```

```ts
// tools/check-boundaries.ts
export const SERVER_SRC = 'apps/server/src';
export const OWNERS: Readonly<Record<string, readonly string[]>> = {
  ops: ['audit_log'],
  identity: [
    'tenant',
    'person',
    'login',
    'session',
    'platform_access',
    'auth_lookup',
    'tenant_by_slug',
    'tenant_info',
  ],
  plant: [
    'segment',
    'machine_group',
    'machine',
    'machine_move',
    'list_item',
    'shift',
    'setting',
    'glossary_term',
    'ui_translation',
  ],
};
export type Baseline = Readonly<Record<string, readonly string[]>>;
export const LEGACY: Baseline; // final value below; ticket 03 empties it
export function sqlLiterals(source: string): string[];
//   ts.createSourceFile('x.ts', source, ts.ScriptTarget.Latest); walk with ts.forEachChild; collect
//   StringLiteral.text, NoSubstitutionTemplateLiteral.text, and for TemplateExpression
//   [head.text, ...templateSpans.map(s => s.literal.text)].join(' ').
export function tablesNamed(sql: string): string[];
//   matches of /\b(?:from|join|into|update)\s+([a-z_][a-z0-9_]*)/gi, lower-cased, unique, sorted.
export function serverFiles(root: string): string[];
//   repo-relative '/'-separated paths of every *.ts (not *.test.ts) under join(root, SERVER_SRC), sorted.
export function boundaryErrors(root: string, legacy: Baseline = LEGACY): string[];
//   For each file (sorted), each owned table it names (sorted), with owner m and repo
//   `${SERVER_SRC}/modules/${m}/repo.ts`: allowed if file === repo or legacy[file] includes the table; else
//   `${file}: SQL names ${table} (owned by ${m}); only ${repo} may`.
//   Then for each legacy key (insertion order) and table (listed order) the file does not name (or the file is
//   missing): `${file}: LEGACY lists ${table} but the file no longer names it; remove it`.
// main(): errors = boundaryErrors(process.cwd());
//   console.log(`boundaries: ${n} files scanned, ${errors.length} problem(s)`);
//   each error → console.error(`boundaries: ${error}`); process.exitCode = 1 if any.
//   Guarded: `if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();`
//   `import ts from 'typescript';`
```

`LEGACY` **at the end of the slice** (10 files; computed by a probe of exactly this algorithm on today's tree, minus
the files this slice cleans):

```ts
{
  'apps/server/src/day-report.ts': ['machine', 'person', 'tenant_info'],
  'apps/server/src/import/references.ts': ['list_item', 'machine', 'person', 'shift'],
  'apps/server/src/push.ts': ['person'],
  'apps/server/src/reports.ts': ['machine', 'person', 'tenant_info'],
  'apps/server/src/tag-sql.ts': ['list_item'],
  'apps/server/src/ticket-report.ts': ['person', 'shift', 'tenant_info'],
  'apps/server/src/ticket-sql.ts': ['list_item', 'person'],
  'apps/server/src/ticket/severity.ts': ['machine', 'setting'],
  'apps/server/src/ticket/sla.ts': ['shift', 'tenant_info'],
  'apps/server/src/tickets.ts': ['machine'],
}
```

Task 1 starts with today's baseline, these 10 plus:
`'apps/server/src/auth.ts': ['auth_lookup', 'login', 'person', 'session']`,
`'apps/server/src/config.ts': ['list_item', 'machine', 'machine_group', 'person', 'segment', 'setting', 'shift', 'tenant_info']`,
`'apps/server/src/import/undo.ts': ['audit_log']`,
`'apps/server/src/settings.ts': ['audit_log', 'list_item', 'machine', 'setting', 'shift']`,
`'apps/server/src/tenant.ts': ['tenant_by_slug']`.
Each task removes the entries it cleans, in the same commit; B1 and the stale rule force it.

## 5. Data

No schema change, no migration, no new table, no new dependency. No field changes owner in the database.

| Field                                                                                                                                   | Type                                         | Where                              | Use in this slice                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `request.auth`                                                                                                                          | `AuthContext \| null`                        | in memory, per request (decorator) | written by the guard, read by `requireAuth`                                                                      |
| `Authorization: Bearer <token>`                                                                                                         | header `string`                              | request                            | read by the guard; only its SHA-256 reaches the database (unchanged)                                             |
| `auth_lookup(token_hash)` → `tenant_id, login_id, acting_person_id`                                                                     | uuid, uuid, uuid \| null                     | Postgres definer function          | read (moved into identity repo)                                                                                  |
| `session.last_seen_at`, `expires_at`, `revoked_at`; `login.password_hash`                                                               | timestamptz; text                            | Postgres                           | written exactly as today (moved)                                                                                 |
| `audit_log.tenant_id, login_id, action, entity, entity_id, before, after`                                                               | uuid, uuid?, text, text, uuid?, jsonb, jsonb | Postgres                           | written through `audit.record`; same rows as today (`entity_id` NULL for SLA policy changes, `ip` NULL as today) |
| `person`, `tenant_info(...)`, `list_item`, `segment`, `machine_group`, `machine`, `shift`, `setting`, `sla_policy` columns of `/config` | existing                                     | Postgres                           | read as today; `ConfigPayload` keys and order unchanged                                                          |
| `OWNERS`, `LEGACY`                                                                                                                      | in-tool constants                            | `tools/check-boundaries.ts`        | read by the check                                                                                                |

## 6. Test cases and tasks

### Guard (`apps/server/test/guard.test.ts`, DB-free)

Setup (`beforeAll`): `queries: string[] = []`; `pool = { query: async (text: string) => { queries.push(text); return { rows: [], rowCount: 0 }; } } as unknown as Pool`;
`app = await buildApp({ pool, logger: false, jobBoss: {} as PgBoss, rateLimitMax: 100000 })`; `await app.ready()`;
`afterAll(() => app.close())`. `fill(url)` replaces every `:param` with `00000000-0000-4000-8000-000000000000`.
`protectedRoutes = routeTable(app).filter((r) => !isPublicRoute(r.method, r.url))`.

1. **G1 — "every route not on the public allowlist answers 401 without a session"** (generated from the route table).
   - **Given** the app above and `protectedRoutes`.
   - **When** each is injected with its method and `fill(url)`, no `Authorization`, no body.
   - **Then** collect `${method} ${url} → ${status}` for every reply that is not 401, or (for non-`HEAD`) whose
     `json().error.code` is not `'unauthenticated'`; the list equals `[]`. Also `queries` equals `[]` (no handler and
     no lookup ran).
   - Red today: `POST /api/v1/auth/password` answers 422; and before the guard exists `routeTable` is empty (G2).
2. **G2 — "the route table sees every registrar"**.
   - **Then** `routeTable(app)` contains (`method url`): `GET /api/v1/auth/me`, `GET /api/v1/config`,
     `PUT /api/v1/settings/sla-policies`, `GET /api/v1/state`, `POST /api/v1/tickets`, `GET /api/v1/reports/day.pdf`,
     `GET /api/v1/push/key`, `GET /api/v1/tags`, `HEAD /api/v1/auth/me`; and `protectedRoutes.length > 0`.
3. **G3 — "a token with no session answers 401 'Your sign-in has ended'"**.
   - **Given** the app above.
   - **When** `GET /api/v1/auth/me` with `authorization: 'Bearer fake-token'`.
   - **Then** 401 and the body equals `{ error: { code: 'unauthenticated', message: 'Your sign-in has ended. Please sign in again.' } }`;
     `queries` gained exactly one entry, `'SELECT * FROM auth_lookup($1)'`.
4. **G4 — "public routes are not stopped by the guard"**.
   - **Then** `PUBLIC_ROUTES` equals exactly the set `{'GET /api/v1/health', 'GET /api/v1/brand', 'POST /api/v1/auth/login'}`.
   - **When/Then** with no `Authorization`: `GET /api/v1/health` → 200 `{status:'ok'}`; `HEAD /api/v1/health` → 200;
     `GET /api/v1/brand` with `host: 'cosmos.localhost'` → 404 `not_found` (the stub finds no tenant);
     `POST /api/v1/auth/login` with payload `{}` → 422 `validation`.
5. **G5 — "an unknown route answers 404, not 401"**: `GET /api/v1/nope` without `Authorization` → 404.
6. **G6 — "rate limiting still answers before the guard"**.
   - **Given** a second app built the same way with `rateLimitMax: 1`.
   - **When** `GET /api/v1/auth/me` twice without `Authorization`.
   - **Then** the first is 401 and the second is 429 with `error.code === 'rate_limited'`. (Over-rejection guard:
     green before and after; it fails if the guard ever moves to a global `onRequest`.)

### Boundaries (`tools/boundaries.test.ts`, DB-free; runs in the fast tests)

Fixture helper: `plant(files: Record<string, string>)` writes each repo-relative path under a fresh
`mkdtempSync(join(tmpdir(), 'boundaries-'))` and returns the root.

7. **B1 — "the server tree passes"**: `boundaryErrors(process.cwd())` equals `[]`.
8. **B2 — "fails a planted SQL call outside a moved module's repo.ts"** (`it.each`), each with `legacy = {}`:
   - `apps/server/src/modules/plant/routes.ts` = `client.query('SELECT id FROM machine WHERE id = $1', [id]);` →
     `['apps/server/src/modules/plant/routes.ts: SQL names machine (owned by plant); only apps/server/src/modules/plant/repo.ts may']`;
   - `apps/server/src/new-file.ts` = ``client.query(`select * from audit_log where id = ${id}`);`` →
     `['apps/server/src/new-file.ts: SQL names audit_log (owned by ops); only apps/server/src/modules/ops/repo.ts may']`;
   - `apps/server/src/modules/plant/repo.ts` = `"SELECT name FROM person"` →
     `['apps/server/src/modules/plant/repo.ts: SQL names person (owned by identity); only apps/server/src/modules/identity/repo.ts may']`.
9. **B3 — "passes SQL inside the owner's repo.ts"**: `modules/plant/repo.ts` with `'SELECT id FROM machine'` and
   `'INSERT INTO list_item (code) VALUES ($1)'`, `modules/identity/repo.ts` with `'SELECT * FROM auth_lookup($1)'`,
   `modules/ops/repo.ts` with `'INSERT INTO audit_log (action) VALUES ($1)'` → `[]` (`legacy = {}`).
10. **B4 — "ignores comments, unowned tables and test files"**: `apps/server/src/a.ts` =
    `// read from person\nconst fromPerson = 1;\nq('SELECT * FROM ticket');` and `apps/server/src/a.test.ts` =
    `q('SELECT * FROM person');` → `[]` (`legacy = {}`).
11. **B5 — "a baselined file passes for its tables and fails for a new one"**: `apps/server/src/push.ts` =
    `q('SELECT 1 FROM person'); q('UPDATE machine SET code = $1');` with `legacy = { 'apps/server/src/push.ts': ['person'] }` →
    `['apps/server/src/push.ts: SQL names machine (owned by plant); only apps/server/src/modules/plant/repo.ts may']`.
12. **B6 — "reads every literal kind"**: `tablesNamed(sqlLiterals("a('FROM login'); b(\"JOIN session s\"); c(`UPDATE setting SET v = ${v} FROM shift`);"))`
    equals `['login', 'session', 'setting', 'shift']`.
13. **B7 — "a stale baseline entry fails"**: `apps/server/src/push.ts` = `q('SELECT 1 FROM person');` with
    `legacy = { 'apps/server/src/push.ts': ['person', 'machine'] }` →
    `['apps/server/src/push.ts: LEGACY lists machine but the file no longer names it; remove it']`.

### Regression (runs, not new tests)

14. **R1 — the whole API suite passes unchanged.** `git diff --name-status origin/main -- apps/server/test` shows only
    `A apps/server/test/guard.test.ts`; `pnpm exec vitest run` (Docker) is green. Run after each of tasks 2–5.
15. **R2 — the planted violation turns the CI step red.** Temporarily add
    `export const x = 'SELECT 1 FROM person';` to `apps/server/src/modules/plant/routes.ts`; `pnpm boundaries` exits 1
    with that file named; revert. Paste both outputs in §8.
16. **R3 — `pnpm verify`** green (format, lint incl. 60-line functions, typecheck, size ≤ 400, `audit:lean` with
    `boundaries`), and `pnpm test:e2e` green (the browser stack starts `apps/server/src/index.ts`, unchanged).

### Tasks (in order; the suite is green at the end of each)

| #   | Files                                                                                                                                                                                                                                                                                                                                                                                                         | Red → green                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | `tools/boundaries.test.ts` (B1–B7), then `tools/check-boundaries.ts` with the **task-1 baseline** (15 files), `package.json`                                                                                                                                                                                                                                                                                  | B1–B7 red (no module) → green; `pnpm boundaries` exit 0                                          |
| 2   | `kernel/context.ts`, `kernel/jobs.ts`, `kernel/module.ts`, `kernel/index.ts` (without the guard exports); `jobs/adapter.ts` → shim; `jobs/index.ts` types; `config.ts` drops `AppConfig` for `export type { AppConfig } from './kernel/index.js';` (its other code stays until task 5)                                                                                                                        | pure move: typecheck + R1                                                                        |
| 3   | `modules/ops/repo.ts`, `modules/ops/index.ts`; `settings.ts` and `import/undo.ts` call `audit.record`; LEGACY drops `import/undo.ts` and `audit_log` from `settings.ts`                                                                                                                                                                                                                                       | B1 + R1 (`sla-policies`, `import-undo`, `import-cli` tests assert the audit rows)                |
| 4   | `guard.test.ts` (G1–G6) first; then `kernel/guard.ts` (+ its `kernel/index.ts` exports), `modules/identity/*`, `modules/index.ts` (`[opsModule, identityModule]`), `auth.ts`, `session.ts`, `tenant.ts` → shims, `app.ts` (§3b); `config.ts` `loadConfig` calls identity's `listPeople` and `tenantInfo` (moved there now); LEGACY drops `auth.ts`, `tenant.ts`, and `person`, `tenant_info` from `config.ts` | G1, G2 red (422 on password; empty table) → G1–G6 green; B1; R1                                  |
| 5   | `modules/plant/*`; manifest gains `plantModule`; `settings.ts` §3a; `loadSlaPolicies` → `ticket/sla.ts`; `config.ts` → final one-line shim; LEGACY drops `config.ts` and `settings.ts` (final 10)                                                                                                                                                                                                             | B1; R1 (`settings`, `sla-policies`, `ticket-severity` tests); G2 still sees `GET /api/v1/config` |
| 6   | `changes/77-module-boundaries-expand.md`, `MILESTONES.md`, `wiki/log.md`, `HANDOFF.md`, §8                                                                                                                                                                                                                                                                                                                    | R2, R3; `pnpm changelog:check`, `pnpm docs:check` exit 0                                         |

**Task 6 text.**

- `changes/77-module-boundaries-expand.md`, three bullets:
  - Every API route except health, brand and sign-in needs a session, checked in one place.
  - Operations, identity and plant code live in server module folders, with SQL only in each `repo.ts`.
  - `pnpm boundaries` fails SQL on those modules' tables outside their `repo.ts`.
- `wiki/log.md`, append:
  `2026-11-13 — Ticket 02 Module boundaries: expand (#<n>): one kernel auth guard (public: health, brand, login); kernel plus ops/identity/plant module folders with repo.ts and the manifest; old paths are one-line shims until 03; pnpm boundaries guards the moved tables (LEGACY baseline: 10 files).`
- `docs/HANDOFF.md`: the Guards bullet becomes
  `- Guards: \`pnpm docs:check\`, \`pnpm pii:scan\`, \`pnpm changelog:check\` (one \`changes/\` fragment per PR), \`pnpm boundaries\` (SQL on ops/identity/plant tables only in that module's \`repo.ts\`; its LEGACY list is emptied by 03).`;
the Next bullet becomes `- The M0 frontier: 03 (after 02), 08, 10, 13 (MILESTONES "What can run at the same time").`

## 7. Out of scope and regression risk

**Out of scope:** moving `tickets`, `accountability`, `notifications`, `reports`, `files`, `imports` (03); deleting
the shims and emptying `LEGACY` (03); ESLint `no-restricted-imports` and workspace `exports` (03); `route()`, the
shared reply schemas and reply parts (04); `/health` checks and logger fields (13); `/audit`, `/ops/jobs`,
`defineJob`, `publish`, `session.purge` (later tickets); ARCHITECTURE rule 7's `now` in the request context; any
schema, migration, web, infra or deploy change.

**Regression risk and how it is caught:**

- Every authenticated request now authenticates in a hook: R1 (every API test signs in through it), G3, R3 e2e.
- Rate-limit order: G6.
- `/config` fingerprint depends on key order and values: `ConfigPayload` order is fixed in §4; `settings.test.ts`.
- Audit rows: `sla-policies.test.ts` (count), `import-undo.test.ts`/`import-cli.test.ts` (`entity_id`, before/after).
- `settings.ts` keeps two routes registered by `registerSettings`; `/api/v1/settings/sla-policies` (static) still
  wins over plant's `/api/v1/settings/:key` (parametric) whatever the order (find-my-way rule); `sla-policies.test.ts`.
- Merge with ticket 13 on `app.ts`: §2.15.
- PR size > 800 lines: `size:large` with the reason in the PR body.

## 8. Evidence (filled by the builder)

- B1–B7 red then green: _paste_
- G1/G2 red (task 4, before wiring) then G1–G6 green: _paste_
- R1 full vitest run after tasks 2, 3, 4, 5: _counts_
- R2 planted `pnpm boundaries` output (exit 1) and clean output (exit 0): _paste_
- R3 `pnpm verify` and `pnpm test:e2e`: _result_
- Fast tests before/after: _s_ / _s_

## 9. Open questions

None blocking. For the orchestrator to confirm or override (each is decided above):

1. **D §2.10:** SLA-policy and machine-criticality routes stay in `settings.ts` instead of plant (they write `ticket`
   and `sla_policy`, which plant may not call).
2. **D §2.13:** the ownership table and `LEGACY` live in the tool, not in `modules/manifest.ts` as ARCHITECTURE §2 says.
3. **§2.2:** the guard is a route-level `preParsing` hook, not `onRequest` (keeps 429 before 401; measured).

No product question for Nimish: nothing a user sees changes.
