# M1a-e2e — Playwright end-to-end harness

## Goal

A local `pnpm test:e2e` that boots the **real stack** (Postgres, migrated + seeded; the API
server; the web app) and drives the floor→desk flows that the M1a-5 screens implement — the
acceptance for SPEC 1.3/1.4.

## Files (write scope)

- `playwright.config.ts` — wire a `globalSetup` (start container + migrate + seed) and the
  `webServer` entries (API on :3001, Vite on :3000 proxying `/api`), phone + chromimum projects.
- `apps/web/e2e/global-setup.ts` + `teardown.ts` — start a `postgres:16-alpine` Testcontainer,
  load `packages/db/migrations/0001_schema_v1.sql`, seed a small cosmos fixture (tenant, segment,
  machines, people, logins, ref_counter), publish the URI to the server process; stop it on teardown.
- `apps/web/e2e/fixtures.ts` — the seed SQL + the known usernames/passwords/machine codes.
- `apps/web/e2e/floor.spec.ts` — SPEC 1.3: sign in, raise a stopped ticket, see the confirmation ref.
- `apps/web/e2e/desk.spec.ts` — SPEC 1.4: the ticket is on the Open board; open it and drive
  start → update → pause → resume → transfer → start (pick up) → machine-running → machine-stopped
  → close (report); plus the Open/Mine/Team tabs and the floor My-complaints list.
- `package.json` — keep `test:e2e` (`playwright test`); no new dependency (Playwright is installed).

## Rules

- Deterministic: each spec raises its own ticket(s); use Playwright auto-waiting assertions, no sleeps.
- The server must read `DATABASE_URL` and the web must proxy `/api`; the stack is torn down always.
- `pnpm test:e2e` green locally; the existing `pnpm verify` (vitest 91 tests) stays green and
  `test:e2e` is **not** added to `verify` yet (browsers/CI wiring is a follow-up).

## Out of scope

CI wiring (`playwright install` in Actions), PDFs, push, the live board, screenshots/visual tests.
