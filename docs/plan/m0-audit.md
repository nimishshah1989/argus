# M0 audit: ponytail-audit of the whole repo

Audited `origin/main` at `569fa72` in a separate read-only worktree (`/tmp/audit-wt`). No file in the repo was changed.

**What this repo does:** Uptimo is a maintenance system for Indian factories. A breakdown is reported from a phone, becomes a ticket with an owner and SLA clocks, and is closed with a coded report and a PDF. One Fastify API and one Postgres database (row-level security per customer, pg-boss jobs) serve a React PWA. Behind them sit the importer for Bhavin's history, retention jobs and a dormant AI module.

**Load assumed:** one plant (Cosmos) on staging. That means tens to about 100 people on phones and one or two wall boards, all polling every 30 s. Everything runs on one `m6g.large` (2 vCPU, 8 GB) in one process (D18), with Caddy in front.

**What I ran:** `pnpm size`, `deps`, `boundaries`, `shortcuts` (all exit 0), `eslint .` (clean), `tsc --noEmit` (clean), and the unit tests in `packages/domain` and `apps/web/src` (23 files, 164 tests, all green). I also wrote a script that counts function lengths from the TypeScript syntax tree. The database tests and e2e tests need Docker, which this machine does not have, so they were not run.

---

## Must fix

1. **The day-report PDF button fails in production** (`infra/server.Dockerfile`, `apps/server/src/modules/reports/pdf.ts:166-177`)
   - **What this is:** Both PDF routes start a headless Chromium (a browser with no window) to turn HTML into a PDF. The desk's "My day" panel calls `/api/v1/reports/day.pdf` (`apps/web/src/screens/desk/MinePanel.tsx:81`).
   - **Problem:** The server image is plain `node:24-alpine`. It installs no Chromium, sets no `CHROMIUM_PATH`, and has no Playwright cache. `resolveChromium` throws "Chromium not found", so every PDF request on staging answers 500. Tests pass only because CI installs Chromium on the runner.
   - **Fix:** Add `RUN apk add --no-cache chromium font-noto font-noto-gujarati` (alpine package names may differ) and `ENV CHROMIUM_PATH=/usr/bin/chromium` to the Dockerfile. Then add one smoke step after deploy that fetches a day PDF.
   - **If we skip it:** The first time Nimish taps "Day report" on his phone at the gate, he sees "Internal error".

2. **The whole plant shares one rate-limit bucket** (`apps/server/src/app.ts:36-47`, `infra/Caddyfile:8`, `apps/web/src/main.tsx:15`)
   - **What this is:** `@fastify/rate-limit` allows 1000 requests per minute per client IP.
   - **Problem:** Fastify is not told to trust the proxy (`trustProxy` is unset). So `request.ip` is the Caddy container's address for every user. Every React Query on every phone refetches every 30 s. For example, 60 phones × 4 queries × 2 per minute is 480 requests/min, before boards, the offline sync, logins and actions. At shift change it goes over 1000, and then everyone gets 429 errors until the minute ends.
   - **Fix:** `Fastify({ trustProxy: true, ... })` in `buildApp`. Only Caddy can reach port 3001, so trusting it is safe. Add one test that two `X-Forwarded-For` addresses get separate budgets.
   - **If we skip it:** One busy minute locks the whole factory out, including the person trying to report a breakdown.

3. **Password guessing is barely limited** (`apps/server/src/modules/identity/routes.ts:41-61`)
   - **What this is:** The login route.
   - **Problem:** Login has no limit of its own, only the shared 1000/min bucket from finding 2. Once finding 2 is fixed, that becomes 1000 guesses per minute per IP. Also, an unknown username skips the argon2 check and answers much faster than a known one. That timing difference tells an attacker which usernames exist.
   - **Fix:** Give the login route its own limit, for example `config: { rateLimit: { max: 10, timeWindow: '1 minute', keyGenerator: ip + username } }`. When the user is not found, still run `verify` against a fixed dummy hash.
   - **If we skip it:** Any short or seeded password (the floor's shared logins) can be guessed from the internet.

4. **Any "head" can write any setting with any value, including AI consent and the AI cap** (`apps/server/src/modules/plant/routes.ts:67-89`)
   - **What this is:** `PUT /api/v1/settings/:key` stores a JSON value under any key.
   - **Problem:** Only `severity_matrix` has its value checked. A head can send `PUT /settings/ai.consent` with `{status:'granted', signedOn, fileId, ...}` and `PUT /settings/ai.monthlyCapUsd` with `1e9`. That passes the written-consent gate and the spending cap that ADR 0007 requires (`ai/suggest.ts:78-88`). Any other key accepts junk too, and the code that later reads those keys has to cope with it.
   - **Fix:** Keep a map of allowed keys, each with its zod schema. Answer 404 for an unknown key and 422 for a bad value. Make `ai.*` keys admin-only, or operator-only. That is one small table plus one lookup, and it deletes the `if (key === 'severity_matrix')` special case.
   - **If we skip it:** The legal and cost guard on sending plant data to an outside AI can be switched off by a plant user.

5. **Push subscribe lets any user make the server POST to any URL** (`apps/server/src/modules/notifications/routes.ts:17-22, 50-54, 116-130`)
   - **What this is:** SSRF (server-side request forgery) means tricking the server into calling an address the attacker chooses. The phone registers a push "endpoint" URL, and `/push/test` sends a web-push POST to it.
   - **Problem:** `endpoint` only has to be a non-empty string. Any logged-in user, the shared floor login included, can register `http://server:3001/...`, a VPC-internal address or `http://169.254.169.254/...`, then call `/push/test`. IMDSv2 is required (`infra/terraform/main.tf:366`), so AWS credentials are safe. Other internal services are not.
   - **Fix:** In `subscribeSchema`, require `https:` and a host from the known push services (`fcm.googleapis.com`, `updates.push.services.mozilla.com`, `*.push.apple.com`, `*.notify.windows.com`). About 5 lines, plus one test.
   - **If we skip it:** A floor login becomes a tool for probing the private network.

6. **One refused offline command blocks the outbox forever** (`apps/web/src/offline/replay.ts:31-46`)
   - **What this is:** Closes and reports made offline are queued in IndexedDB and replayed in order when the phone is back online.
   - **Problem:** Only a 409 becomes a draft. Any other refusal (`break`) stops the loop and leaves the entry first in line. Examples: a 422 because a report code was removed from a list while the phone was offline, a 403 because the person left the crew, a 404. That entry fails again on every retry, so every close and report queued after it never reaches the server, and nobody is told.
   - **Fix:** Treat every 4xx except 401, 408 and 429 like 409: `addDraft` + `removeQueued`. Keep `break` for network errors, 5xx, 401 and 429. Add one test in `replay.test.ts` with a 422 entry followed by a good one.
   - **If we skip it:** A technician's whole shift of offline reports quietly never syncs.

7. **Deploys run migrations with no backup first** (`infra/instance/deploy.sh:30-40`)
   - **What this is:** Every deploy runs `scripts/migrate.ts` against RDS, then swaps the containers.
   - **Problem:** CLAUDE.md says a migration that changes data needs a backup run first. Today the only backup is a manual step in HANDOFF for the first deploy. Every later deploy migrates with no snapshot. And if the health check fails, the script rolls back to the old image on the new schema.
   - **Fix:** In `deploy()`, before migrating, run `aws rds create-db-snapshot` and `aws rds wait db-snapshot-available`, or `dump.sh`, whenever the migration table shows pending files. That is about 4 lines.
   - **If we skip it:** A bad migration on production history has no restore point newer than the nightly backup.

## Should fix

8. **Ticket PDFs are written where nobody can read them, and are lost on every deploy** (`apps/server/src/modules/reports/routes.ts:156-180, 308`; `apps/server/src/modules/files/store.ts`)
   - **What this is:** `GET /tickets/:id/pdf` renders a PDF, saves it with the local file store, inserts a `file` row and returns `/api/v1/files/<id>`.
   - **Problem:** No route serves `/api/v1/files/:id`, so the link it returns is a 404. The store's folder is `os.tmpdir()` inside the container. It has no volume (`infra/docker-compose.yml`), so every redeploy deletes the files while their database rows stay. Each tap renders again and adds another file and row.
   - **Fix:** Until the S3 adapter lands, return the PDF bytes directly, the way `day.pdf` already does, and drop the file-row write. If the row is needed for `setReportPdf`, mount a volume and add the read route.
   - **If we skip it:** A dead link, plus `file` rows that point at nothing and grow without limit.

9. **No cap on parallel Chromium processes** (`apps/server/src/modules/reports/pdf.ts:191-210`)
   - **What this is:** Each PDF request starts its own Chromium, with a 30 s timeout.
   - **Problem:** At shift end, 10 to 20 people can tap "Day report" at once. Each Chromium uses about 150-300 MB, on the same 8 GB box that runs the API and the jobs. The kernel's out-of-memory killer can then stop the API.
   - **Fix:** Put a small in-process gate around `exec`, at most 2 at a time. A counter and a promise queue is about 10 lines, with no dependency.
   - **If we skip it:** A shift-change spike of report downloads can take the whole site down.

10. **`sendPush` is dead code, and broken** (`apps/server/src/modules/notifications/routes.ts:150-156`, `repo.ts:63-73`)
    - **What this is:** A helper "for M2 escalation, not wired yet".
    - **Problem:** Nothing calls it. It also reads `push_subscription` through the pool with no tenant set, and forced row security then returns zero rows. When M2 wires it up, no push will ever arrive, and no error will be raised.
    - **Fix:** Delete both functions (about 20 lines). M2 writes the real one inside `withTenant`, with a test.
    - **If we skip it:** M2 builds on a helper that silently sends nothing.

11. **The AI module runs in M0 with nothing to do** (`apps/server/src/modules/ai/*`, 1,072 lines; `apps/server/src/index.ts:29`)
    - **What this is:** The M6 Claude suggestion pipeline: redaction, cap, retries, a worker.
    - **Problem:** No feature is registered (`jobs.ts:15`, `features ?? {}`). Even so, every process starts a pg-boss worker that polls `ai.suggest` every 2 s. `MILESTONES.md:140` says `ai` is "born as a module in its milestone". It is code nobody can use, and it still has to be kept up to date.
    - **Fix:** Do not call `startAiJobs` until a feature exists (one line). Deleting the module until M6 is a product decision for Nimish: it would remove about 1,072 lines plus migration-related tests.
    - **If we skip it:** About 1k lines to maintain, plus constant idle polling, for a feature months away.

12. **Every request costs 4 database round-trips and a write** (`apps/server/src/modules/identity/service.ts:35-56`, `repo.ts:33-40`)
    - **What this is:** `authenticate` runs on every non-public request.
    - **Problem:** It runs `auth_lookup`, then three separate transactions: an UPDATE of the session (`last_seen_at`, `expires_at`), a login read and a person read. With 30 s polling, that is one row UPDATE (and a WAL write, Postgres's change log) on every GET from every phone.
    - **Fix:** Return login and person fields from `auth_lookup`, which already joins `login`. Touch the session only when `last_seen_at < now() - interval '5 minutes'`. That brings it to 1 query on most requests.
    - **If we skip it:** About 4x more database work per request than needed, mostly writes, so the 10-connection pool (`kernel/db.ts:4`) fills first.

13. **The same "who may change settings" rule exists in two places** (`apps/server/src/modules/plant/routes.ts:25-27` vs `packages/domain/src/permissions/settings.ts`; also `tickets/repo/list.ts:73`)
    - **What this is:** `canWrite` (head or admin) gates settings, lists, translations, SLA policies and criticality. The domain package already has `canSettingsLists` and `canSettingsSla` for the same thing.
    - **Problem:** If one changes and the other does not, the screen and the API disagree. `needReportRows` also hard-codes `['supervisor','head','admin']` as "sees all".
    - **Fix:** Call the domain functions and delete `canWrite`. Move the "sees all" list into `permissions/views.ts`.
    - **If we skip it:** Permission bugs, where the screen offers a button the API refuses, or the reverse.

14. **Two PDF templates copy the same helpers** (`reports/pdf-template.ts:23-31, 60-73` and `reports/day-report-template.ts:3-11, 50-63`)
    - **What this is:** HTML escaping (`esc`), the "Cell X" label and the machine label.
    - **Problem:** These are exact copies. A fix to escaping in one place would leave the other open to HTML injection in the PDF.
    - **Fix:** Put the three helpers in one `reports/html.ts` and import them in both files. That saves about 25 lines.
    - **If we skip it:** Two escapers drift apart.

15. **Tests check column, table and index names (against CLAUDE.md)** (`packages/db/test/sla-migration.test.ts:67-80`, `packages/db/test/ai-suggestion-migration.test.ts:24, 206`)
    - **What this is:** Migration tests.
    - **Problem:** They assert `information_schema` column lists (`pause_max_minutes`, `job_id`, ...), the full `pg_tables` list and index names. Renaming a column breaks them even when behaviour is the same. That is exactly what CLAUDE.md forbids.
    - **Fix:** Replace these asserts with behaviour: write a policy or timer through the API or a definer function and read it back, and use `EXPLAIN` or a timing check only where the index is the point. The generic RLS and tenant sweeps in `isolation.test.ts` and `definer-functions.test.ts` are security invariants, so keep them.
    - **If we skip it:** Refactors fail tests for no user-visible reason, and people start weakening tests.

16. **The seed reads `docs/discovery` at runtime, and that folder is not in the image** (`apps/server/src/seed/cosmos.ts:178-186`, `.dockerignore`)
    - **What this is:** `pnpm seed:cosmos` builds Cosmos from three discovery JSON files.
    - **Problem:** CLAUDE.md says discovery is "reference only, never code to copy". `.dockerignore` drops `docs/discovery`, so the seed cannot run from the deployed image. It also writes `docs/plan/seed-report.md` into the working directory.
    - **Fix:** Generate the three inputs into `apps/server/src/seed/generated/`, the way `cosmos-machines.json` already is, and read them from there.
    - **If we skip it:** Re-seeding staging needs a full repo checkout next to the database, which is fragile.

## Nice to have

17. **Leftovers to delete:** the empty `packages/engine/` (only a `package.json`, imported nowhere). Two ADRs are both numbered D24 (`D24-charts-echarts.md`, `D24-database-roles-and-definer-functions.md`), and code says only "D24" (`retention.ts:11`, `tickets/repo/imported.ts:182`). Decisions live in two folders (`docs/adr/0001-0007` and `docs/decisions/D01-D24`). Fix: delete the package, renumber one D24 as D25, and say in one README line which folder is current.

18. **The React 300-line budget is not enforced** (`tools/check-size.ts:4`). LEAN.md says `check-size` enforces 300 lines for React files, but the script only knows 400. `apps/web/src/components/reportFields.tsx` sits at exactly 300 lines. Fix: for `.tsx` files under `apps/web/src`, use 300 (3 lines).

19. **The app DB password is built into a DDL string** (`scripts/migrate.ts:231-234`). `ALTER ROLE app_api ... PASSWORD '<value>'` is written to the RDS log whenever `log_statement` covers DDL. Fix: run `SET log_statement = 'none'` on that connection first, or set the password from a precomputed SCRAM hash.

20. **The image copies the whole repo, dev dependencies included, and runs as root** (`infra/server.Dockerfile`, `.dockerignore`). `.dockerignore` does not exclude `.env` or `*.env`, so a local env file would be baked in. Fix: add `.env*` and `*.env` to `.dockerignore`, and add `USER node`.

Smaller items left out: 3. The no-person path in `needReportRows` returns every row. The idempotency fallback answers 500 when the replay itself throws. Day-shift windows are duplicated from the shift table, but that is tracked under N11.

---

## Required lists

**Files over 400 lines (source, the budget applies):** none. `pnpm size` passes. Largest: `imports/schema.ts` 386, `tickets/mapper.ts` 385, `imports/reconcile.ts` 361, `domain/src/sla.ts` 355. 22 files are over the 250 warning.
Exempt (tests or migrations) over 400: `domain/test/sla.test.ts` 830, `server/test/sla-timers.test.ts` 763, `import-cli.test.ts` 751, `import-schema.test.ts` 740, `tickets-commands.test.ts` 722, `db/test/definer-functions.test.ts` 683, `db/test/migration-runner.test.ts` 667, `import-undo.test.ts` 608, `migrations/0001_schema_v1.sql` 590, `import-reconcile.test.ts` 582, `migrations/0009_history_cannot_be_lost.sql` 576, `import-state.test.ts` 527, `domain/test/state.test.ts` 502, `ticket-severity.test.ts` 488, `sla-jobs.test.ts` 481, `ai-suggest.test.ts` 467, `tickets.test.ts` 439, `cutover-scripts.test.ts` 434, `import-integration.test.ts` 418.

**Functions over 60 lines:** ESLint (counts code lines only) finds 0. Counting raw lines, with blanks and comments:
- `NotificationsToggle`: 66 lines, `apps/web/src/components/NotificationsToggle.tsx:24`
- `ReportPanel`: 64 lines, `apps/web/src/components/ReportForm.tsx:125`
- `SlaWaitReasonSettings`: 62 lines, `apps/web/src/components/SlaWaitReasonSettings.tsx:13`
- `executeRaise`: 62 lines, `apps/server/src/modules/tickets/routes.ts:217`
- At exactly 60: `raiseTicket` (`packages/domain/src/state.ts:35`) and `startJobs` (`accountability/jobs.ts:61`).

**Dependencies without an ADR:**
- `qrcode` (server, `reports/pdf.ts:8`): in THIRD_PARTY.md, but in no ADR.
- `web-push` (server): ADR 0002 names only "browser push services", not the library.

Everything else is covered: fastify, pg, pg-boss, zod, React, Router, TanStack, Tailwind and ECharts by ADR 0001/0006/D24; argon2 and rate-limit by 0003; i18next by D07; radix and lucide by D20. THIRD_PARTY.md also lists libraries that are not installed (Pino, SheetJS, Fuse, idb, ...) as "planned".

**Tests that check table or column names:** see finding 15. `migration-runner.test.ts:20-40` also probes columns, but it does that to detect whether a migration was already applied, which is what it tests. That is acceptable.

**Modules reaching across interfaces:** `pnpm boundaries` reports 0 problems in 110 files, and the ESLint import rules pass. One inconsistency is left: 13 server files import `withTenant` from `@uptimo/db`, and 12 import it through `kernel/index.js`. It would be better to choose one.

---

**Verdict:** The core is solid: row-level security per customer, idempotent commands with row locks, a careful import undo, and lint, type and size gates that are green. Fix first: Chromium in the image (1), `trustProxy` plus a login limit (2, 3), the settings allowlist (4) and the outbox stall (6). Then add the pre-migration snapshot (7) before production.

**Lean:** -~90 lines and -0 dependencies are possible (sendPush, `packages/engine`, duplicate template helpers, `canWrite`, the ticket-PDF file write). That becomes about -1,160 lines if the AI module waits for M6.

**Not checked:** the database and e2e suites (no Docker here). The importer (`modules/imports`, about 4,500 lines) was only sampled at `undo.ts`, and its own large test suite was trusted. I did not review the migration SQL beyond `auth_lookup` and the RLS policy, the web screens beyond the offline outbox, sync and polling, Terraform beyond the IMDS setting, or `tools/` scripts beyond `check-size`. Staging is not live, so none of this was checked against real RDS or real traffic.
