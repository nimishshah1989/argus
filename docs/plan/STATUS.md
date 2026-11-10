# Status — 11 November 2026

Branch: `process-fixes` (M6/M7/M8/M10 process fixes; not yet merged). Last merged PR on `main`: #44.
This file says what is built and tested, not what is planned; the plan is `docs/plan/backlog.md`.

## Merged on main (#1–#44)

**M0 foundation**

- Schema v1 (#5, #7): 26 tables, forced RLS, composite `(tenant_id, id)` foreign keys,
  `tenant_by_slug` / `auth_lookup`, and migration `0002_app_api_role.sql` for the least-privilege
  API role (#42). Isolation suite proves every tenant table hides other tenants.
- Auth (#9): host tenancy, login/logout/me/change-password, Argon2id, opaque bearer tokens hashed
  at rest, 30-day sliding sessions, shared logins with an acting person, public `/brand`.
- Settings/config (#11): `/config` with fingerprint and `?fp=` delta, `/settings`, list CRUD,
  missing-translations list. Cosmos seed (#12): 192 machines, 14 people, codes, shifts, glossary.
- Walking skeleton (#14): login, floor raise, desk open list on the real API.
- Infrastructure authored and validated (Terraform 32 resources, Compose, image, deploy/rollback)
  (#13, #20, #22) — **not applied** (blocked on domain and AWS credentials).

**M1a ticket core**

- Domain: figures (#15), permissions (#16), state machine (#17) and the full command set (#18).
- Tickets API (#23): every command, `FOR UPDATE` row locks, idempotency, `/state`,
  `/tickets/{id}`, figures recomputed and persisted.
- Floor face (#26) and desk face (#27): three-tap raise, Open board, detail with facts/figures/
  timeline/people, state-dependent actions.
- Ticket lists (#29): filterable, cursor-paginated `GET /tickets`; desk Mine/Team tabs; floor
  My complaints. Web polish (#31).
- E2E harness (#33): `pnpm test:e2e` boots a Postgres Testcontainer, migrates + seeds, starts the
  API and Vite, and drives the floor raise and the full desk lifecycle on desktop and phone.

**M1b slices shipped early**

- Breakdown report form and storage (#35); live board + kiosk (#36); server-rendered breakdown PDF
  with QR and stored file (#37); WhatsApp short/full share text + installable PWA shell (#40).

**Core-issue fixes**

- C1 (#42): the server connects as `app_api`, RLS is enforced on the real request path and
  `withTenant` fails fast without a tenant.
- C2/M1/M2 (#41): self-start status, cancel stops the clocks, restore resumes waiting.
- C3/M3 (#43): correction audit with from/to, 7-day window, time invariants, overrides; past
  breakdowns no longer invent hands-on time.
- M4 (#44): idempotency bound to command + login + request hash, 24h expiry.
- #38: duplicate-machine raise race replays the committed result.

**Process fixes (this branch)**

- M8: `pnpm test:e2e` runs in the CI `checks` job after `pnpm test`.
- M10: `pnpm migrations:immutable` + `tools/check-migration-immutability.ts` fail a PR that
  modifies, deletes or renames an existing migration; documented in `packages/db/README.md`.
- M6: parity ledger backfilled and guarded (`pnpm parity:update`; `apps/`/`packages/` changes must
  touch `docs/spec/parity.yaml` or carry the `no-parity` label with a reason).
- M7: this file, `README.md`, `HANDOFF.md` and `CHANGELOG.md` refreshed; PR template added.

## Verification today

- `pnpm verify` green: prettier, ESLint, strict TypeScript, **143 vitest tests**, server + web
  build, parity schema, licences, migration checks, lean audit.
- `pnpm test:e2e` green locally: 4 tests × 2 projects = **8 Playwright tests** (floor raise, desk
  lifecycle, live board/kiosk), on the real stack.
- CI `checks`: format, lint, typecheck, vitest, Playwright e2e, build, parity, parity:update (PR),
  licences, migrations:check, migrations:immutable (PR), lean audit, PR size. `secrets`: gitleaks.
- Terraform is validated but unapplied; there is no staging deployment yet.

## Parity — `docs/spec/parity.yaml` (79 rows)

| Status      | Count | Meaning                                                                       |
| ----------- | ----- | ----------------------------------------------------------------------------- |
| done        | 12    | v3 behaviour fully covered, each with test/PR evidence                        |
| in-progress | 34    | part of the row ships; listed gaps remain                                     |
| todo        | 29    | not built (tasks, account sheet, day-report PDF, push, offline, M4 analytics) |
| external    | 3     | blocked on outside input (Sarvam voice, legacy PDF import, Excel import)      |
| waived      | 1     | dropped v3 screen (dead code)                                                 |

Every `done` row names a test or PR. The 34 `in-progress` rows are the honest gap between
"ticket core shipped" and "Bhavin's whole app is covered"; close them before the cutover.

## Next

- **AC5b/AC5c**: offline outbox with 409 drafts; web push and acting-person re-subscribe.
- Finish the M1b parity gaps: day-report PDF, needs-report list, floor cancel-own, desk join/leave
  actions, account sheet, admin correct/restore faces, Views 1–7 completion.
- **M1b import/cutover**: Bhavin's export and Worker (external), Gujarati strings (external),
  cutover runbook.
- **M2**: severity/SLA timers, escalation ladder, production handback.
- **M4**: answer key and analytics (needs Bhavin's current platform file and Excel export).

## Blocked / needs Nimish or Bhavin

- Domain registration (`uptimo.in`), AWS spend limit, and `terraform apply` (domain, GitHub secrets).
- Bhavin's export/Worker source; the current analytics platform file and Excel export.
- Voice provider keys (Sarvam) and a consented Gujarati voice corpus.
- PDF import corpus (legacy breakdown PDFs) for the transition importer.

## Known follow-ups (tracked in code comments / HANDOFF)

- `GET /files/{id}` does not stream the stored PDF yet; each `/pdf` GET re-renders.
- Bundle Noto Sans Gujarati in the deploy image; split `apps/web/src/api.ts` types.
- Board cancelled-24h tile; floor cancel-own and desk join/leave E2E steps.
