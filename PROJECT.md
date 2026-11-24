# PROJECT: Uptimo (repo: Argus) — maintenance OS for Cosmos Engitech

_The locked blueprint. Agents read §1–4 and the current milestone every session. Only Plan sessions edit this file, and every edit gets an ADR in `docs/adr/`. Tasks live in GitHub Issues, not here._

**Status:** Building (adopted mid-flight) · **Current milestone:** M2 and M2b · **Locked on:** not yet: waiting for Nimish's read · **Version:** v1 (adoption, ADR 0011)

_Written on 2026-11-23 from the code at `e468e31a`, the docs and the PR history, not from memory. Product detail stays in
`docs/spec/SPEC.md` (product truth), `docs/DATA-MAP.md` (data), `docs/DESIGN.md` + `docs/design/v2/` (design) and
`docs/plan/MILESTONES.md` (the old 98-ticket plan, kept as the detailed backlog the milestones below draw from)._

## 1. Product (≤15 lines)

- **Problem:** Cosmos runs maintenance on Bhavin's v3 ticket app and Excel workbooks; breakdowns, PM and the figures behind decisions are scattered, slow and hard to trust.
- **Users:** operators (report a breakdown on a shared floor phone, in Gujarati); technicians and supervisors (work tickets at the Desk); maintenance head and plant head (analytics and decisions); admin (settings); a wall TV board.
- **Must do (v1):** breakdown → ticket with owner, two clocks and an escalation ladder → coded close with a PDF → production handback; PM plans, calendar and floor PM jobs; registers (AMC, warranty, legal, calibration) with reminders; analytics whose figures equal Bhavin's exactly (answer key) for 2026 and his 2022–2025 history; an Action Center that names the decisions worth taking; English and Gujarati.
- **Will NOT do (v1):** WhatsApp and voice (M3 in the old plan, parked); a second plant (M5, parked); live AI (AI runs in shadow only); billing and self-serve (ADR 0004); OEM analytics (no v1 screen, engine does not compute it); General Work screen (Nimish, 20 Nov).
- **Done for v1 means:** Cosmos runs on Uptimo in production with five years of history, the redesigned (v2) screens, and the nine numbers in `docs/plan/MILESTONES.md` "v1 is done when these nine numbers hold" met.

## 2. Architecture (≤20 lines)

- **Stack:** TypeScript on Node ≥24, pnpm 10.30.3 workspace (one language end to end, ADR 0001). Server: Fastify 5 + raw SQL on `pg` (D02: no ORM) + pg-boss jobs (ADR 0006). Web: React 19 + Vite 8 PWA, react-router 7, TanStack Query, ECharts (D27), i18next. DB: Postgres (RDS). Auth: hand-rolled sessions, Argon2id, opaque token stored hashed, 30-day sliding (ADR 0003).
- **Shape:** one server, modules in `apps/server/src/modules/` (identity, people, plant, tickets, accountability, notifications, files, reports, analytics, imports, ops, ai) talking only through published interfaces (`pnpm boundaries`); pure rules and the analytics maths in `packages/domain`; contracts in `packages/shared`; migrations and `withTenant()` in `packages/db`; one web app `apps/web` for every face (floor, desk, analytics, settings, board, `/gallery`).
- **External systems:** AWS ap-south-1 (EC2 + Docker Compose + Caddy, RDS, S3, ECR, Secrets Manager; Terraform in `infra/`); web push; Claude for AI features in shadow (ADR 0007). Imports: Bhavin's ticket-app export (`pnpm import:bhavin`) and his workbooks (`pnpm import:legacy`).
- **Multi-tenancy / security model:** every table has `tenant_id` with forced row-level security and a least-privilege API role (migrations 0001–0002, D24); the tenant comes from the host; permissions are checked on the server; a shared login records the acting person; money only for roles allowed to see it.
- **Deploy:** every merge to `main` builds images and deploys **staging** over SSM with a snapshot before migrating, health and PDF checks, and a manual rollback (`.github/workflows/deploy.yml`). Staging: `https://cosmos.3-108-95-203.sslip.io` (`/api/v1/health` shows the commit). **There is no production yet.** Weekly logical backup (`backup.yml`), restore steps in `infra/RESTORE.md`.
- **Non-negotiables:** tenant_id + RLS in the same migration as the table; never edit a merged migration; a migration that changes or deletes data runs a backup first; no secrets or real personal data in the repo (`pnpm pii:scan`, gitleaks); figures equal the answer key; a redesign never reduces scope (coverage table); a v2 screen ships live and deletes its v1 page in the same PR.

## 3. Data model

- **Source of truth:** `packages/db/migrations/0001…0015_*.sql` (raw SQL, applied in order by `pnpm migrate`; downs in `migrations/down/`). There is **no `db/schema.sql`**: no Postgres was available to this session to dump one (Docker refused). Guards: `pnpm migrations:check`, `pnpm migrations:immutable`. Table budget: 40 (D17); 37 built.
- **Entities and why they exist** (grouped by owning module; columns live in the migrations, meanings in `docs/DATA-MAP.md`):

| Tables                                                                                                                       | Holds                                                              | Notes                                          |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------- |
| tenant, person, login, session, platform_access                                                                              | who exists and who may sign in                                     | `platform_access` built, not used yet          |
| segment, machine_group, machine, machine_move, list_item, shift, setting, glossary_term                                      | the plant: machines, cells and their dated moves, shifts, settings | nudge acknowledgements live in `setting`       |
| ticket, ticket_event, crew_member, work_segment, breakdown_report, breakdown_report_person, ref_counter, command_idempotency | tickets and their append-only history, crew time, closing reports  | figures are computed from `ticket_event`       |
| sla_policy, sla_timer, roster_entry, escalation_rule                                                                         | the two clocks and who is told when one is missed                  | `sla_policy` built, not switched on at Cosmos  |
| notification, push_subscription                                                                                              | outbox and phones to push to                                       |                                                |
| file, audit_log, import_batch, import_row                                                                                    | uploads, audit trail, imports with undo                            | audit purge: `scripts/audit-purge.ts`          |
| kpi_snapshot, forecast, pm_plan, intervention, asset_register                                                                | engine figures, frozen forecasts, PM plans, registers              |                                                |
| ai_suggestion                                                                                                                | AI output in shadow                                                | DATA-MAP still calls it "planned": out of date |

- **Core flows through the data:** a floor report creates a `ticket` + first `ticket_event` → acknowledge/start/pause/running-again/close append events, `crew_member`/`work_segment` record hands-on time, `sla_timer` runs the clocks and `escalation_rule` + `roster_entry` decide who is told → close writes `breakdown_report` (codes, PDF) → handback → the engine reads events into `kpi_snapshot` figures and `forecast`s.
- **Invariants (each has tests today):** no row is readable across tenants (`packages/db/test/isolation.test.ts`, `apps/server/test/rls.test.ts`); a ticket's history is append-only and figures recompute from it; erased people stay erased (`apps/server/test/erased-stays-erased.test.ts`); figures equal the answer key (`tools/answer-key.test.ts`, engine tests); a merged migration never changes (`tools/migration-immutability.test.ts`).
- **Known data-doc drift:** DATA-MAP lists tables D17 removed and says a person's team is stored twice under two names.

## 4. Frontend (screens and flows locked here; pixels locked by approved wireframes)

- **Design system:** the repo's own, not the global kit: `docs/DESIGN.md`, `docs/design/v2/` (UX-RULES, LANGUAGE, COVERAGE), tokens in `apps/web/src/ui/tokens.css`, kit in `apps/web/src/ui/v2/`. `pnpm ui:check` enforces kit-only screens. `design/brand.css` is not used. All of these are protected in `.loop.json`.
- **Wireframes of built screens:** each file in `design/wireframes/` is a self-contained snapshot of the built v2 screen from the staging gallery (fixture data, commit `24e7bb47`). Nimish approves them all at once with `loop approve --all`; after that the gate applies to new screens and redesigns.
- **Screens:**

| ID                                                                                               | Screen                 | Who uses it        | State                                                                     | Wireframe                                    |
| ------------------------------------------------------------------------------------------------ | ---------------------- | ------------------ | ------------------------------------------------------------------------- | -------------------------------------------- |
| S01-dashboard                                                                                    | Dashboard (Today)      | heads              | built, v2 live                                                            | `design/wireframes/S01-dashboard.html`       |
| S02-action-center                                                                                | Action Center          | heads              | built, v2 live                                                            | `S02-action-center.html`                     |
| S03-machines-register                                                                            | Machines register      | heads, admin       | built, v2 live                                                            | `S03-machines-register.html`                 |
| S04-footprint                                                                                    | Footprint (A7)         | heads              | built, v2 live                                                            | `S04-footprint.html`                         |
| S05-age                                                                                          | Age (A8)               | heads              | built, v2 live                                                            | `S05-age.html`                               |
| S06-breakdown-log                                                                                | Breakdown Log          | heads, supervisors | built, v2 live                                                            | `S06-breakdown-log.html`                     |
| S07-bd-pm                                                                                        | BD % and PM split (A1) | heads              | built, v2 live                                                            | `S07-bd-pm.html`                             |
| S08-category-cell                                                                                | Category and cell (A2) | heads              | built, v2 live                                                            | `S08-category-cell.html`                     |
| S09-mttr-mtbf                                                                                    | MTTR and MTBF (A3)     | heads              | built, v2 live                                                            | `S09-mttr-mtbf.html`                         |
| S10-manpower                                                                                     | Manpower (A4)          | heads              | built, v2 live                                                            | `S10-manpower.html`                          |
| S11-why-why                                                                                      | Why-Why (A6)           | heads, supervisors | built, v2 live                                                            | `S11-why-why.html`                           |
| S12-problem-analysis                                                                             | Problem Analysis (A10) | heads              | built, v2 live                                                            | `S12-problem-analysis.html`                  |
| S13-fix-finder                                                                                   | Fix Finder             | technicians, heads | built, v2 live                                                            | `S13-fix-finder.html`                        |
| S14-pm-calendar                                                                                  | PM Calendar            | heads, supervisors | built, v2 live                                                            | `S14-pm-calendar.html`                       |
| S15-compare                                                                                      | Compare                | heads              | v2 built in gallery; v1 live                                              | `S15-compare.html`                           |
| S16-data-checklist                                                                               | Data Checklist         | heads, admin       | v2 built in gallery; v1 live                                              | `S16-data-checklist.html`                    |
| S17-team-focus                                                                                   | Team Focus             | heads              | v2 built in gallery; v1 live                                              | `S17-team-focus.html`                        |
| S18-oem                                                                                          | OEM                    | heads              | gallery only; not built (no engine figure)                                | `S18-oem.html`                               |
| S19-login                                                                                        | Sign in                | everyone           | built, v1 live                                                            | `S19-login.html`                             |
| — Machine page, Cell change log, Energy (A5), Shift-calendar KPIs, Bottleneck (A9), Forecast Lab | analytics              | heads              | built, v2 live; **no snapshot**: no gallery view, staging needs a sign-in | none yet                                     |
| — Floor phone, Desk, Ticket, TV board, Settings, Money Matters, Monthly/Annual reports, Guide    | the other faces        | all roles          | built, v1 live; **no snapshot**; redesign not started                     | none yet (wireframe comes with the redesign) |

- **Key user flows:** (1) operator: Floor → report a breakdown in 3 steps → sees it Booked → In progress → Fixed. (2) technician: Desk → acknowledge → start → running again → close with codes → PDF. (3) head: Dashboard → Action Center → open a decision → act or snooze; drill any figure to the rows behind it. (4) supervisor: PM Calendar → move a PM → floor PM job.
- **Gate:** no frontend code for a screen until Nimish runs `loop approve <ID>`. Editing a wireframe voids its approval. Every v2 screen PR also carries its coverage table (`docs/design/v2/COVERAGE.md`).

## 5. Milestones

_Every later milestone is a vertical slice Nimish can click through. Goals are yes/no; each maps to a test or a command. Tickets come from `loop-ticket` and live in GitHub Issues._

### M-done — what already works

- M0 — Data model · Done · 15 migrations, RLS on every table, isolation tests (`packages/db/test/`, CI `api` shards).
- Tickets end to end (floor report → desk → coded close → PDF → handback, clocks, escalation, roster, push) · Done · server tests in `apps/server/test/`, e2e in `apps/web/e2e/` (CI `browser` shards).
- Plant setup: machines, cells and moves, lists, shifts, settings, people and logins, imports with undo · Done · server tests.
- Analytics engine with 2026 figures equal to the answer key; forecast freeze; PM plans and registers (old M4a, M4b in part) · Done · `tools/answer-key.test.ts`, engine tests.
- v2 redesign: 20 analytics screens live on staging with their v1 pages deleted (§4) · Done · gallery and browser CI; each screen PR had an independent review.
- Staging deploy on every merge with snapshot, health and PDF checks · Done · health URL showed `24e7bb47` on 2026-11-23.
- CI on 2026-11-23 (PR #546, Linux): fast suite 307 of 307 test files pass; typecheck and lint pass (7 lint warnings).
- Unverified: whether every renamed v2 figure keeps v1's formula (only the Action Center filters were spot-checked); v2 figures with history loaded (staging has 2026 only).

### Current gaps (honest)

- **No production.** Ticket 97 (production stack) not started; one restore drill (14 Nov, at migration 10 of 15).
- **History not loaded:** 2022–2025 workbooks (ticket 69) in progress; parity for those years unproven.
- **Figures are slow:** 2.8 s per request at 1,350 rows, recomputed on every read (target ≤300 ms p95).
- **Gujarati:** 1,209 of 1,848 strings blank (floor and tickets 191); `v2*` keys blank.
- **Coverage debt:** 97 of 187 v1/spec items MISSING across the first six v2 screens (`docs/design/v2/scope/batch1.md`); Compare, Data Checklist and Team Focus cannot go live until cleared.
- **Bugs:** Breakdown Log export has two identical columns (Ticket ID, Ticket No.) and the PM Reports Data column holds UUIDs; the Cell change log CSV writes a database id for an unlisted machine; "Show the numbers" missing on Shift KPIs, Energy, Problem Analysis and Dashboard charts; the shell remounts loading → ready (a phone menu closes); after a person switch the previous screen can stay up to 30 s.
- **Test gaps:** `apps/server/test/escalation.test.ts` fails between 17:59 and 18:30 UTC (wall clock); two flaky tests (`who-is-acting`, `sla-timers`) are allowed one re-run; no DOM test runner (reviews found bugs unit tests cannot see); the money rule has no per-screen test (a v2 rupee leak to every role was found by audit, not by a test).
- **Developer machines:** on macOS, `Bubble.tsx`/`bubble.ts` and `Live.tsx`/`live.ts` clash by case, so typecheck and 8 fast tests fail on a Mac (6 from the clash, 2 backup-script tests not traced). Linux CI is green.

### M1 — Stabilise · Done (2026-11-24; ADR 0015 carries G1.2a and Shift KPIs/Energy G1.4)

- **Delivers:** the known bugs above fixed, so the redesign continues on solid ground. For users: correct exports and the missing "Show the numbers".
- **Goals (yes/no):**
  - [x] G1.1 `pnpm typecheck` and the fast suite pass on macOS — test: a guard in `tools/` that fails when two files in `apps/` differ only by case.
  - [~] G1.2 (b done #565; a waits for Nimish, ADR 0015) Breakdown Log export has one ticket-number column and PM Reports Data shows codes, not UUIDs — test: export tests in `apps/web/src/screens/v2/breakdown-log/`.
  - [x] G1.3 Cell change log CSV never prints a database id — test: its CSV test.
  - [~] G1.4 (Dashboard #567, Problem Analysis #569 done; Shift KPIs + Energy moved to M2) "Show the numbers" on Shift KPIs, Energy, Problem Analysis and Dashboard charts — test: each screen's test finds the table behind each chart.
  - [x] G1.5 `escalation.test.ts` passes at any wall-clock time — test: run with the clock fixed at 18:00 UTC.
  - [x] G1.6 Rupees never reach a role without money rights on any v2 figures route — test: one server test per route with a no-money role.
- **Screens:** S01, S06 and the no-snapshot screens G1.4 touches (their wireframes first).
- **Depends on:** M0.

### M2 — Finish the analytics redesign · Building

- **Delivers:** Compare, Data Checklist and Team Focus live in v2 with clean coverage tables; then Money Matters, Monthly, Annual, Guide and Settings redesigned and live, each deleting its v1 page.
- **Goals (yes/no):**
  - [ ] G2.1 0 MISSING rows across all analytics coverage tables, or Nimish's written yes per row — test: `pnpm quality:pr` coverage check on each PR.
  - [ ] G2.2 No v1 analytics page left in `apps/web/src/screens/analytics/` — test: route test.
  - [ ] G2.3 Every analytics screen passes `pnpm ui:check` and axe with 0 violations — test: gallery CI.
- **Screens:** S15, S16, S17 + new wireframes for Money Matters, Monthly, Annual, Guide, Settings.
- **Depends on:** M1.

### M2b — Insight pass · Building

- **Delivers:** every live v2 screen says what to notice (ADR 0023, UX rules 60–67): a computed takeaway line per table, chart and section, the outlier marked with a tone tag, a yardstick on every key number, worst-first ranking with a collapsed tail, and rows that expand in place. Figures never change. One ticket per screen, after Compare goes live and before the rest of M2.
- **Goals (yes/no):**
  - [ ] G2b.1 Every live v2 screen's model gives each section a computed takeaway — test: `apps/web/src/screens/v2/insight-coverage.test.ts` lists each screen's sections; its not-yet list shrinks to empty.
  - [ ] G2b.2 Reviewer rule 67 passes on every M2b PR: no table or chart lacks a takeaway, a marked outlier or a yardstick on its key number — test: reviewer PASS on each ticket PR.
  - [ ] G2b.3 Every figure is unchanged — test: `tools/answer-key.test.ts`.
- **Screens:** S01 Dashboard, S02 Action Center, S06 Breakdown Log first, then every other live v2 screen (list in ADR 0023).
- **Depends on:** M2's Compare live (ticket 588).

### M3 — History in, figures fast · Not started

- **Delivers:** 2022–2025 loaded on staging and every analytics page answering quickly on five years of data.
- **Goals (yes/no):**
  - [ ] G3.1 100 % of the workbooks' machine-months equal or named, 0 unexplained — test: `pnpm validate:full` reconciliation sheet.
  - [ ] G3.2 A figures request answers in ≤300 ms p95 with the whole history and 30 readers; 0 engine runs inside a read — test: load script (old ticket 98).
  - [ ] G3.3 2026 parity stays at 0 problems — test: `tools/answer-key.test.ts`.
- **Depends on:** M1 (schema changes go one at a time).

### M4 — Floor, Desk and Board redesign + Gujarati · Not started

- **Delivers:** floor phone, desk, ticket, TV board and login in v2; every floor and desk string in Gujarati; a usability round.
- **Goals (yes/no):**
  - [ ] G4.1 0 blank Gujarati strings on floor and desk, signed by a Cosmos reviewer.
  - [ ] G4.2 The floor opens and goes live in under 2 s on a low-end Android profile.
  - [ ] G4.3 5 of 5 operators raise a breakdown unaided.
  - [ ] G4.4 Every control sits in v3's order and place (`docs/design/LOCK.md`).
- **Depends on:** M2.

### M5 — Production and cutover · Not started

- **Delivers:** Cosmos on Uptimo in production.
- **Goals (yes/no):**
  - [ ] G5.1 Production stack up (old ticket 97).
  - [ ] G5.2 A restore drill at most 7 days old, with equal row counts.
  - [ ] G5.3 One deploy and one rollback exercised on production.
  - [ ] G5.4 A planted failing job is on screen within 60 s and alarms within 5 min.
  - [ ] G5.5 Day-3 and day-7 go/no-go signed by Nimish.
- **Depends on:** M3, M4.

_Later (parked, from the old plan): finish the M4b loop (monthly scorecard), Intelligence insights (90–96), AI in shadow (55–60, 72), WhatsApp (old M3), plant two (old M5)._

## 6. Open questions (Plan resolves before the milestone they block)

- May the frozen answer key move by a last digit (52.70 → 52.69) so the engine orders ties across days? — blocks M3.
- ~~Compare: keep v1's health score and its two tables?~~ Yes, rebuilt in v2 (ADR 0013).
- ~~Order: M2 before M3?~~ Yes (ADR 0012, ADR 0013).
- Does the TV board read in Gujarati? — blocks M4.
- Do `support` tickets count 0 downtime (Bhavin to confirm)? — blocks M3.
