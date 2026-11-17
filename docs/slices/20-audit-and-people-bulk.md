# 20 + 21 — the audit screen's backend, and people bulk actions

Owners: backend builder (this side), web builder (the screens). Write areas do not overlap: this side is
`apps/server/`, `packages/shared/`, `packages/domain/` and the tests; the web side is `apps/web/` (and its i18n).
No table, no migration, no new dependency. The audit writer (`ops.audit.record`) and the session rows already exist.

## What the tracker claimed and what is true

`ops` registered no routes (`register: () => undefined`): there was no `GET /audit`, no CSV export, no bulk
endpoint, `person` PATCH had no `reason`, and neither people nor logins listed a last sign-in. Only the writer
existed. Nothing in this slice reads or writes a table that does not exist.

## The frozen shapes (the web screen is built against these)

1. `GET /api/v1/audit?area=&personId=&from=&to=&cursor=&limit=`
   - **admin and head read**; every other role, board included, is 403; no sign-in is 401.
   - newest first: `{ items: [{ id, at, action, entity, entityId, actor: { loginId, name } | null, before, after, ip }], nextCursor }`.
   - `area` is the audit entity (`person`, `machine`, `setting`, `ticket`, `login`, `session`, `route`, …). A value
     outside the known entities is 422 naming `area`.
   - `personId` narrows to rows about that person (`entity = 'person'`, that id) **or** written by one of that
     person's logins. A malformed id is 422 naming `personId`.
   - `from`/`to` are plant days (`YYYY-MM-DD`), inclusive, converted with the plant's own time zone as
     `at >= from 00:00 local` and `at < (to + 1 day) 00:00 local`. A day that is not a real calendar day is 422
     naming `from`/`to`; `from` after `to` is 422 naming `from`.
   - `limit` 1–200, default 50; `cursor` is the opaque `nextCursor` from the previous page; a cursor that is not
     one of ours is 422 naming `cursor`.
   - `before`/`after` are the stored JSON (null when the line has none). `actor` names the person behind the
     login, or the username for a shared phone; it is null on a support-grant line (no login).
   - Erasure stays honest: `erase_person` already blanks the stored values and renames the person to
     "Former staff"; the reader shows what is stored and never reconstructs a name (D30).
2. `GET /api/v1/audit.csv` — **admin only** (head is 403), same `area`/`personId`/`from`/`to` filters, no
   cursor/limit (a stray one is 422 naming it). `text/csv; charset=utf-8` with CRLF and RFC-4180 quoting, header
   `at,action,entity,entityId,actor,ip,before,after`; `before`/`after` are compact JSON, `actor` is the same name
   the JSON row carries and blank on a grant line. The export is capped at the newest **50 000** rows; when the
   cap is hit the body ends with one comment line saying so and how to narrow it. Not streamed, but bounded.
3. `PUT /api/v1/people/:id` with `active: false` accepts an optional `reason` (trimmed, max 500) and the
   `person.switch_off` audit row keeps it in `after.reason` only — never in `before`. A switch-off without a
   reason stays allowed (the lock puts the requirement on the screen); a reason alone is still "Nothing to
   change". The reason is ignored on any other edit, including switch-on.
4. `POST /api/v1/people/:id/sign-out` `{ reason }` — **admin only**; ends every live session of that person's
   logins, replies `{ ended: n }`, and writes `person.sign_out` with `after: { reason, ended }`. This is the
   bulk "sign out devices" action; a reason is required (422 naming `reason` when absent or blank).
5. People and logins list replies gain `lastSignInAt: string | null`: the newest session start for that login
   (for a person, across their logins); null when that login/person never signed in. It is carried inside the
   existing reply shapes — no second route, and `POST`/`PUT` replies carry it too.
6. Bulk "change shift" and bulk "switch off" stay **client loops** over `PUT /people/:id` (each audited). No bulk
   endpoint is added; `POST /api/v1/people/bulk` stays 404 and is asserted.

## Why the routes sit in `identity`, not `ops`

`ops` is the bottom module (`CALLS.ops = []`); its repo owns `audit_log` and nothing else. The audit reply needs
the actor's name, which lives on `login`/`person` (identity), and the plant day needs `tenant.time_zone`
(identity). `identity` may call `ops`, not the other way round, so the read route is registered by `identity`
(`apps/server/src/modules/identity/audit.ts`): it reads the page through the published `ops.audit.page(tx, …)`,
resolves names and the time zone in the same `withTenant` transaction, and shapes the reply. `audit_log` SQL
stays in `ops/repo.ts`; `login`/`person` SQL stays in `identity/repo`. No manifest change, no cycle.

## Packets (each with its test first, red then green)

- **P0** this plan, and the two test files written before any code (`audit-api.test.ts`, `people-bulk.test.ts`).
- **P1 last sign-in** — `lastSignInAt` on `personAdminSchema`/`loginAdminSchema`, computed in the identity repo
  select (`max(session.created_at)`), included in every people/logins reply. Green: the last-sign-in tests.
- **P2 audit read + CSV** — `ops/repo.ts` page query (filters + keyset cursor), `ops` published `audit.page`,
  identity `audit.ts` read/export routes, shared `audit.ts` contracts, `AUDIT_AREAS`, reply schemas; the
  reply-contract count goes 121 → 124. Green: the audit tests (permissions, tenancy, filters, paging, quoting,
  cap).
- **P3 people bulk** — `reason` on the person patch with `after.reason`, `POST /people/:id/sign-out`,
  `person.sign_out`, shared reply schema. Green: the bulk tests.

## Deliberately not built

- No bulk endpoint for change-shift or switch-off (a client loop over the existing PATCH, each audited).
- No audit of the export itself and no new retention job (the 3-year clean-up is still an operator task).
- No screen, no i18n, no `apps/web` change, no `docs/plan/ledger.md` change.
- No stored actor name on the audit line: names are resolved at read time, so an erased person shows as
  "Former staff" for ever.
