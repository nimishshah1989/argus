# Review 04 — Build readiness and architecture review

10 November 2026 · for Nimish · reviewer: an AI build agent (read-only review; no code changed)

## What I read and how I checked it

Read end to end: `README.md`, `AGENTS.md`, `CLAUDE.md`, `.claude/harness/CLAUDE.md`, all of `spec/` (`SPEC.md`, `DOMAIN.md`, `PARITY.md`), `docs/DESIGN.md`, `docs/HANDOFF.md`, `02-KICKOFF-PROMPT.md`, the three council reviews in `review/`, `bhavin-v3/INVENTORY.md`, the Git/GitHub and local state. Skimmed: `01-SCOPE-BRIEF.md` (the decision-relevant sections), research notes 01–15, `research/16-borrow-dont-build.md` (read closely), the four prototype inventories (structure and formulas, not all 39,000 words), and `atlas-poc/`.

I also ran checks against the actual files rather than trusting the prose:

- The platform export really has **191 machines** (125 CNC + 16 conventional + 17 process + 30 utility + 3 DG) and **1,158 breakdown rows**; the live config really has **192 machine ids** (the extra one is **VC-57**), **14 team entries including 1 vendor**, **19 active codes**, **2 shift windows**, and a glossary of **86 English corrections + 58 Gujarati terms**.
- The embedded data in `source/cosmos_platform.html` is the **same 1,158 rows** as the JSON export (all ids match), so the “answer key” has one source, not two.
- The breakdown history contains **six maintenance codes that exist in neither settings list**: `MEC` (73 rows), `NI` (2), `INT` (2), `FS` (1), `PP` (1), `UTI` (1). It also has **381 blank codes**, **353 rows signed “Maint. Team”**, **7 blank sign-offs**, and comma-separated names such as `Bipin P, Chirag P`.
- Git: **no commits**, **no remote**, branch `main` unborn.
- GitHub: `nimishshah1989/argus` exists but is **empty and PUBLIC** (created 28 Oct 2026). The pack contains real people’s names and plant data, and the spec repeatedly requires a private repository.
- Local toolchain: Node 24.14, pnpm 10.30, PostgreSQL 18.3, Playwright and `gh` (authenticated as `nimishshah1989`) are present. Docker is installed but the daemon is **not running**. Terraform is **not installed**. The AWS CLI is installed but its current credentials are **invalid**.

## Bottom line

**Yes, I can take the engineering lead on this, and the pack is good enough to build from — but I would not start session 1 until four things are settled.** This is not a “the spec is bad” review; it is the opposite. The product thinking, the domain model, the parity material and the research are better than most funded startups bring to a build. The problems are at the seams: two different operating systems in one repo, a repository that is not yet the repository, one auth design that contradicts itself, and one parity figure that cannot be promised “exact” until Bhavin’s Worker source is in hand.

| Area | Score | One-line verdict |
| --- | --- | --- |
| Product thesis | 9/10 | Sharp, differentiated, grounded in Cosmos’s own data |
| Domain and parity material | 8/10 | Unusually complete; the hands-on figure needs pinning |
| Architecture | 7/10 | Right shape; auth, tenancy and PWA details contradict themselves |
| Buildability / autonomy | 7/10 | Strong loop, but Athena v3 and SPEC define different loops |
| Operational readiness | 5/10 | Nothing is scaffolded; accounts and Bhavin’s files are missing |
| Commercial SaaS completeness | 5/10 | No billing, tenant lifecycle, legal/DPA or platform admin |
| **Overall** | **7.5/10** | **Go, with conditions; M0–M4 is buildable, M5–M6 need a written spec** |

## What is genuinely strong

1. **The product is the accountability loop, and the spec knows it.** Report → own → clock → close → hand back, with analytics reading from it, is the right first product. The parity floor (“reproduce every number before improving any”) is the right discipline for a customer whose trust depends on the old numbers.
2. **The domain model is detailed enough to build.** The command table in `DOMAIN.md` §2, the permissions matrix §3, the exact figure definitions §5, and the one-to-one mapping of Bhavin’s 29 endpoints are the hard part of a CMMS, and they are already written. Most specs stop at “a ticket has a status”.
3. **The discovery pack is real evidence, not a mood board.** The 39,000-word inventory has line numbers and UI copy; the 1,158-row dataset is real; the live config and glossary are exact; the source of both tools is present. I verified the counts and they hold.
4. **The milestone order and splits are sensible.** M1a (the daily loop) before M1b (PDFs, board, offline, import, cutover), and M4a (answer key + legacy engine) before M4b (PM, codes, forecasts), is the right grain. The soft cutover with day-3/day-7 checks and a revert plan is better than a parallel run nobody would actually do.
5. **The stack is boring in the right places.** One TypeScript monorepo, Fastify + pg-boss in one process, Vite/React PWA, Postgres with RLS, S3, Chromium for Indic PDFs. The borrow-don’t-build research is licence-aware and current. There is no AGPL contamination.

## The four things to fix before session 1 (blockers)

### B1 — The repo contains two operating systems, and they disagree

`CLAUDE.md` imports `.claude/harness/CLAUDE.md` (Athena v3), which mandates: architect (Fable) → architecture-reviewer (Opus) → schema-reviewer → `to-spec`/`to-tickets` → GitHub issues labelled `ready-for-agent` → slice-planner → plan-reviewer → build with TDD → code-reviewer → merge. It stores memory in `docs/HANDOFF.md`, `wiki/`, and `docs/decisions/`, and it requires a slice plan in `docs/slices/<issue>.md` that names every file, interface, field and test before a coder starts.

`spec/SPEC.md` §10 defines a different loop: `docs/plan/backlog.md` → pick the first unblocked ticket → tests → implement → PR → self-merge → update `parity.yaml` → repeat; memory in `docs/plan/STATUS.md`, `docs/plan/NEEDS.md`, `docs/spec/QUESTIONS.md`, `docs/spec/DIFFERENCES.md`; decisions in `docs/adr/`. There is no slice plan and no reviewer agent in that loop.

`AGENTS.md` tells every agent to read both. The current tree has neither `docs/slices/` nor `docs/plan/`; `docs/HANDOFF.md` exists but is an empty template; `wiki/` is an empty index. The Stop hook runs `.claude/harness/fast-tests.sh`, which currently prints “No fast tests configured yet” and exits 0.

**What happens if it is left alone:** the first agent either invents `docs/slices/` for every ticket (slow, and the reviewer checklists demand it) or ignores the harness (and breaks the rules it was told to follow). Reviewers look for files that will never exist. Memory is written twice or not at all.

**Recommendation:** keep Athena v3 as the outer governance and SPEC as the product source of truth, and write one short `docs/WORKFLOW.md` that resolves the collisions explicitly:

- **One memory file.** Use `docs/HANDOFF.md` (the hooks already read it) and make it point to `docs/plan/backlog.md` and `docs/plan/NEEDS.md`; retire `docs/plan/STATUS.md` or make it an alias.
- **One decisions folder.** Pick `docs/adr/` (SPEC’s layout) and add a repo-local note that this is the Athena `docs/decisions/` folder under a different name. Do not maintain both.
- **One planning gate.** Keep `slice-planner` + `plan-reviewer` for tickets that touch more than one module, the schema, money or the cutover; for a one-file UI ticket, the ticket + parity row is the plan. State the threshold in `docs/WORKFLOW.md` so the determinism rule is not silently weakened.
- **One definition of done.** Union of SPEC’s list (tests, RLS, i18n, changelog, parity.yaml, merged, staging) and Athena’s (reviewer PASS, no test weakened, boundaries, no secrets). Write it once.
- **One merge authority.** Both say the agent merges on green; make the code-reviewer step part of SPEC’s loop, not an optional extra.

This is a documentation change, not product code. I can do it in session 1.

### B1a — The skills assume a human partner; the harness says agents decide

The skill suite is good, but several skills were written for a human-in-the-loop coding session and have not been fully adapted to Athena v3’s “Nimish answers product and business only; agents decide technology” rule:

- `tdd` says “before writing any test, write down the seams under test and **confirm them with the user**” (`.claude/skills/tdd/SKILL.md`). Under Athena there is no user in the room for a technology question; the slice plan’s named test cases are the seam confirmation.
- `subagent-driven-development` says a merge or a push to a shared branch is one of the four things that stop you and make you ask (`.claude/skills/subagent-driven-development/SKILL.md`). Athena says the agent merges its own PR when CI is green and the review passes (`.claude/harness/CLAUDE.md:36`). The skill’s v3 note overrides the “rulings, not stalls” section but does not resolve the merge stop.
- `to-tickets` says “quiz the user … iterate until the user approves the breakdown” (`.claude/skills/to-tickets/SKILL.md`). The kickoff says session 1 generates `backlog.md` itself and moves on (`02-KICKOFF-PROMPT.md`).
- `office-hours` produces `docs/BRIEF.md`; this repo’s brief is `spec/SPEC.md`. Do not rerun office hours; treat the spec as the brief and use `grill-with-docs` only for genuinely open product questions.
- The frontmatter pins `model: sonnet` / `model: opus`, and `to-tickets`/`to-spec`/`grill-with-docs` are `disable-model-invocation`. Those model names do not resolve in this DSH session.

**Recommendation:** add a short `docs/SKILLS.md` table: skill → when it applies → the v3 override (who confirms seams, who approves a ticket breakdown, when a merge stops). State the precedence in one line: **direct instruction > `CLAUDE.md` > `.claude/harness/CLAUDE.md` > `docs/WORKFLOW.md` > skill defaults.** This keeps the good parts of the skills (TDD, diagnosis, design, delegation) without importing a human approval step the harness has deliberately removed.

### B2 — The repository is not the repository yet

The folder is the handoff pack: `spec/` is at the root, there is no `apps/`, `packages/`, `infra/`, `package.json`, CI, `.env.example`, `THIRD_PARTY.md`, `docs/plan`, `docs/spec` or `docs/adr`. `README.md:3` says to put this folder in the private repo as `docs/discovery/`, copy `spec/` to `docs/spec/`, then paste the kickoff. That has not happened. Git has no commits and no remote, and GitHub’s `argus` repo is empty and **public**.

The current `.gitignore` only ignores `.claude/harness/.stop-failures`; `.DS_Store` files are present at the root and in subfolders, and `.freebuff/` is a local marker. The pack contains real names (`bhavin-v3/live-config-2026-11-09.json`, `source/cosmos-platform-export-2026-10-28.json`, the platform HTML) and must not be pushed to a public repo.

**Recommendation:** make the GitHub repo private first; add a real `.gitignore` (`.DS_Store`, `.env*`, `node_modules/`, `dist/`, `.freebuff/`, `*.pem`, coverage, Playwright artifacts); create the target layout; move the pack to `docs/discovery/`; copy `spec/` to `docs/spec/`; write the initial commit. The exact commands are in the last section.

### B3 — Auth is specified twice, in incompatible ways

`SPEC.md` says better-auth with the username, admin, organization and multi-session plugins, its bearer plugin, 30-day sliding sessions, shared logins and device revoke (`spec/SPEC.md:177,193,207`). `DOMAIN.md` defines its own `login` table (`password_hash` **Argon2id**, role, shared flag) and its own `session` table (`token_hash`, device label, expiry, revoked) (`spec/DOMAIN.md:16-17`). better-auth owns `user`, `session`, `account` and `verification` tables, plus its own organization tables; its default password hashing is scrypt, not Argon2id; and the shared-phone model (a login with no person, an acting person on every action, a cell-scoped shared phone) is custom.

**What happens if it is left alone:** an agent builds half of better-auth and half of the DOMAIN tables, or spends a week trying to force better-auth into a shape it does not have. Either way, the first migration is wrong.

**Recommendation:** run a one-day spike in M0 and pick one:

- **(a) Hand-rolled sessions (my default).** A `login` row with Argon2id, an opaque random token stored only as SHA-256, a `session` row with sliding expiry, a device label and revoke. This is ~150–250 lines, matches DOMAIN exactly, fits RLS (the session lookup is one narrow cross-tenant function), and avoids fighting a library whose model is email-first. For 15 users, the security surface is small and testable.
- **(b) better-auth as the only auth model.** Delete DOMAIN’s `login`/`session`, map `login` to better-auth’s `user` with additional fields, use its custom hasher for Argon2id, and accept its organization tables. This is more code and more upgrade risk, but it gives admin/impersonation/device features for free.

Do not keep both. Record the choice as ADR 0003.

### B4 — The “exact” hands-on figure is not pinned down

`DOMAIN.md:189` defines hands-on (active) time as the **union** of the ticket’s work segments: minutes during which at least one person was working, with overlapping people counted once. But v3’s client computes the live figure as `activeMin + minutes since segStart` (`bhavin-v3/app.js:580,1292`), where `segStart` is the **lead’s** current segment, and `activeMin` is a server-computed scalar whose algorithm is in the Cloudflare Worker — which is **not in the pack** (`spec/SPEC.md:433`). On a job with a lead and a support person, the union can be larger than v3’s `activeMin`; on a job where the lead pauses while support keeps working, it can be different again. The import gate requires every ticket’s recomputed figures to match Bhavin’s stored values within one minute (`spec/SPEC.md:385,438`).

**What happens if it is left alone:** M1a ships a figure definition that feels right, M1b’s import reconciliation produces a long list of one-to-many-minute mismatches, and the cutover gate cannot be met without either fudging the tolerance or rewriting the figure layer under pressure.

**Recommendation:**

1. Make `handsOn` a strategy in `figures()`: `lead` (v3-compatible) and `union` (our definition). Default new tickets to `union`; run the importer with `lead`; compare both against Bhavin’s stored `activeMin` and `repairMin`; log the winner in the reconciliation report.
2. Build the figure fixtures now, before the import: two people overlapping; lead pauses while support works; transfer with a gap; running/stopped twice; restore; correction overrides; self-started (response null); support upgraded to stopped.
3. Get the Worker source before freezing the definition. It is already a `NEEDS.md` item; make it a **hard** prerequisite for M1b, not a nice-to-have.
4. Pin rounding explicitly. v3 floors most durations but rounds `downAt()` at close (`spec/DOMAIN.md:184`); the spec’s “floor everywhere and list differences” is a reasonable stopgap, but write the exact rule and a test per figure.

## Major issues (fix in M0/M1, not blockers to starting)

### M1 — Tenancy and settings are specified three ways

M0 says “tenant settings (flat)” (`spec/SPEC.md:135`). `DOMAIN.md:30` gives `setting` five scopes (`tenant`, `plant`, `segment`, `machine_class`, `machine`) plus `scope_id`, and says the cascade is the M5 deliverable. `DOMAIN.md:14` defers the `plant` table to M5 but puts `plant_id` on people, machines, segments, groups, lists, shifts, tickets, reports and files, with the note “plant_id below reads as tenant_id”. That note is not implementable literally, and it hides a schema decision from every query and policy.

**Recommendation:** v1 has `tenant_id` only. No `plant` table, no `plant_id`, no `scope_type`/`scope_id`. `setting(tenant_id, key, value jsonb)` validated by a Zod schema; the resolver is a lookup. Add plant and scope columns in M5 as an expand migration, when a second plant is real. Update `DOMAIN.md`, epics 0.3 and 0.5, and the M0 gate wording. This also removes a whole class of RLS mistakes.

### M2 — The cutover depends on files we do not have, and the import format does not exist

`spec/SPEC.md:385,433,438` makes M1b depend on Bhavin’s live ticket export and Worker source. The import schema is referenced as `docs/spec/import/bhavin-export.schema.json` but is not in the pack. The fallback — an admin-login crawl of `/api/state`, `/api/ticket` and `/api/mywork?team=1` for the last 30 days — would lose the history before that window and is not a parity path. The import must also map free-text names, reconcile figures, preserve refs, set counters, and be reversible (`import:undo`).

**Recommendation:** write the schema now from `INVENTORY.md` §4 and §12 (ticket fields, event types, crew, reports, pauses). Build the importer against a **fake export fixture** in M1a, not M1b. Make the real export + Worker source the first `NEEDS.md` item and a hard gate. Design `import_batch`/`source_ref` and `import:undo` in schema v1. Require a zero-unexplained-mismatch report before cutover; a tolerance is not a substitute.

### M3 — “Entire SaaS” is missing the commercial layer

The spec builds a multi-tenant product for Cosmos plus a second plant by configuration. It does not build: billing or subscriptions, self-serve signup, tenant provisioning, plan enforcement, a platform super-admin surface, GST invoices, a DPA/privacy policy/terms, a support console, or tenant offboarding. `tenant.plan` and `tenant.status` exist but nothing uses them (`spec/DOMAIN.md:13`). `DOMAIN.md:117` says “tenant creation and billing live in a separate platform surface outside any tenant” — but that surface is not designed. M5 and M6 are one-line scope bullets (`spec/SPEC.md:142-143`), not specifications.

This may be deliberate: a managed pilot sold per plant does not need Stripe on day one. But “entire SaaS” does. **Recommendation:** decide the commercial shape before M5. If it is a managed pilot, say so and mark `plan`/`status` as future. If it is commercial, add an M5.5 epic: platform admin (tenant create/suspend/export), billing (Razorpay or Stripe India), invoices/GST, DPA/privacy/terms, support access with expiry and audit, and a tenant offboarding/export path. That is a product/business decision for Nimish, not a technology one.

### M4 — Tenant isolation is the right design, but nobody independent is checking it

RLS is the one mechanism in this stack whose failure is silent: a query outside the transaction, a pooled connection without the GUC, or a job that forgot `set_config` returns an **empty list**, not an error. The spec’s generic isolation test and dev-mode assertion are the right mitigations (`spec/SPEC.md:217,281`). But the loop lets the agent merge its own PR when CI is green, and the code-reviewer is an LLM; the scope brief itself says “external review before the second tenant”. Staging will hold real Cosmos data, and agent sessions hold staging credentials. There is no CSP, no encryption-at-rest statement for RDS/S3, and no audit-of-reads decision.

**Recommendation:** budget a human senior engineer for a few days before M1b cutover and again before plant two: review the RLS policies, the `app_router` `SECURITY DEFINER` functions, auth/session handling, webhook signature verification, secret handling, and run the isolation suite against staging. Add to the M0/M1 hardening list: CSP for the PWA, S3 bucket policy + default encryption, RDS encryption, token/session revoke, login rate limit and lockout, file upload limits and content-type checks, and HTML escaping in PDF templates. I can write and test these; I cannot be the independent reviewer.

### M5 — PWA manifests and “live updates” are underspecified

The spec says one Vite SPA with **two installable manifests** (floor and desk), one service worker at the root (`spec/SPEC.md:236`), and `vite-plugin-pwa` (`spec/SPEC.md:182`). `vite-plugin-pwa` generates one manifest per build; two manifests for one SPA need two HTML entry points (or a server route that serves a manifest per path), which is not specified. Separately, the frontend table says “Live updates pushed to open screens” (`spec/SPEC.md:82`) while the actual M1 mechanism is 30-second polling (`spec/SPEC.md:249`); there is no SSE/WebSocket transport and no `/version` endpoint for the update banner.

**Recommendation:** either two HTML entry points (`floor.html`, `desk.html`) each with its own manifest and `start_url`, or one manifest and accept one install. State plainly that “push” in M1 means web push notifications, not live data; polling is the live mechanism. Add `GET /version` (build id) and use it for the update banner. Add an SSE endpoint later only if a plant’s size demands it.

### M6 — The data quality of the history is bigger than the spec says

I verified the counts, and the data is messier than `PARITY.md` §3 admits:

- 381 of 1,158 rows have **no maintenance code** (33%); 353 are signed **“Maint. Team”** (30%); 7 have a blank sign-off; names are comma-separated in one field (`Bipin P, Chirag P`).
- Six codes appear in the history but in neither settings list: `MEC` (73), `NI` (2), `INT` (2), `FS` (1), `PP` (1), `UTI` (1). `MEC` is almost certainly a duplicate of `M`, but it is a decision, not a guess.
- The team list is **13 people + 1 vendor**, not 14 people; the 14th name in closed jobs may be a spelling variant or a departed person, and the alias file must resolve it.
- `ref.shifts` has 3 shifts, but `shiftTimes` has only 2 windows (08:00–18:30 and 18:29–05:00), while the report form lists shifts 1, 2, 3. Day reports and M4 shift-calendar KPIs depend on which is right.
- 53 rows are PM, 101 are NO DT; the scope brief says PM is not a breakdown and NO DT is zero lost hours. The engine must separate them, and the ticket model must carry both concepts (it does).

**Recommendation:** add a **seed/data-quality report** to M0 that lists every unknown code, blank field, duplicate and alias, with counts; add a reviewed code-alias map (`MEC→M`, `NI/INT/FS/PP/UTI→MIS` or inactive) signed off by Bhavin; make the acceptance counts explicit (“192 machines, 13 people + 1 vendor, 19 active + 3 inactive codes, 6 unknown legacy codes”). Add the same report to M4a before the answer key is frozen.

### M7 — M5 and M6 are not specified, and M6 has no model/data-residency decision

M5 (“plant two”, importer, industry pack, settings cascade, mid-market features) and M6 (“AI layer”) are scope bullets, not build specs. M6 in particular has no LLM provider, no data-residency note, no cost cap per tenant, no evaluation threshold beyond “shadow-mode acceptance above a threshold set per agent”, and no answer to Meta’s WhatsApp AI policy (business-specific bots only; general-purpose assistants are banned). The spec’s outside-services list does not include an LLM at all (`spec/SPEC.md:162`), and any LLM that sees ticket text is an outside service under rule 8.

**Recommendation:** write M5/M6 specs after M4a, not now. For M6, add ADR 0004: provider and region, PII scrubbing, per-tenant monthly cap, retrieval-first with codes selected from the list, no free-form SQL against tenant tables, and a shadow-mode evaluation harness. Do not promise M6 dates until that exists.

## Smaller contradictions to fix in one pass

| # | Where | Problem | Fix |
| --- | --- | --- | --- |
| 1 | `DOMAIN.md:89` vs `:159` | `correct` may change **machine and kind** in the command table, but the API request schema omits both | Add `machineId` and `kind` to the `changes` object, with validation |
| 2 | `DOMAIN.md:86` vs `:37` | `recordPastBreakdown` writes `raised_channel=backfill`, but the enum is `floor, desk, whatsapp, qr, import` | Add `backfill` to the enum (or use `import`) |
| 3 | `DOMAIN.md:132` | `GET /brand?tenant=slug` says “no tenant parameter” in the same row | Remove the query parameter; document host resolution and the staging/local hosts |
| 4 | `SPEC.md:311` vs harness `CLAUDE.md:63` | Decisions live in `docs/adr/` or `docs/decisions/` | Pick one and alias the other |
| 5 | `SPEC.md:135,364` vs verified data | “14 people” includes 1 vendor | Say “13 people + 1 vendor”; count by `person.team` in the seed test |
| 6 | `DOMAIN.md:84` vs `bhavin-v3/app.js:28` | `markDone` is from `working` only; v3’s `canCloseT` also allows `open` (the UI may not expose it) | Verify with a v3 trace; if it is reachable, allow `markDone` from `open` for general tickets |
| 7 | `SPEC.md:219`, `DOMAIN.md:72` | `upgradeKind` (support → stopped) is new behaviour, not a v3 parity row | Add an `Improve` row to PARITY and a `DIFFERENCES.md` entry |
| 8 | `DOMAIN.md:38` | `ticket_event.idempotency_key` is unique **per ticket**, but `raise` has no ticket yet | Add a tenant-level `command_idempotency` table or a unique `(tenant_id, key)` on a create log |
| 9 | API table | No `GET /health` or `GET /version` | Add both; `/version` returns the build id for the update banner |
| 10 | `SPEC.md:203` | Node 22 LTS; the machine has Node 24.14, which is the current LTS line in Nov 2026 | Pin the current LTS at session 1, not a recalled version |
| 11 | `DOMAIN.md:37` vs `:28` | `reported_by_role` includes “Maintenance”, but the observed-by list has four roles (Operator, Setter, Supervisor, Engineer) | Decide whether Maintenance is a reporter role or a person title; keep one vocabulary |
| 12 | `DOMAIN.md:41` | `breakdown_report` stores `downtime_min`, `response_min`, `repair_min` again | Label them “as printed at submit”; ticket figures remain the truth; add a test that a later correction does not rewrite a filed report |

## Architecture, component by component

| Area | Verdict | Why / what to change |
| --- | --- | --- |
| Monorepo shape | **Keep** | 2 apps + 5 packages is right for this size. Do not add Turborepo until builds hurt. `packages/domain` pure and 100% tested is the boundary that matters. |
| Server | **Keep** | Fastify + pg-boss in one process with `ROLE=all` is proportionate. Move the M4 engine to a worker thread or `ROLE=worker` when a 2,000-run Monte Carlo starts blocking the event loop. |
| Database / RLS | **Keep, harden** | Plain SQL policies next to tables; one generic isolation test that introspects `pg_tables`; a loud assertion when `app.tenant_id` is unset; document exactly how `app_router` gets `BYPASSRLS` and why its `SECURITY DEFINER` functions are narrow. No `plant`/scope columns in v1. |
| Auth | **Change** | Resolve better-auth vs custom (B3). One mechanism, one table set. |
| API | **Keep** | Commands as sub-resources, `Idempotency-Key`, cursor pagination, one error envelope, cross-tenant = `not_found`. Add `/health`, `/version`, a create-idempotency table, and the `correct` schema fields. |
| Web | **Keep** | Vite/React/TanStack Query/Tailwind/shadcn/ECharts is the boring, right stack. Fix the two-manifest mechanism; add CSP; decide whether the bearer token in IndexedDB is acceptable for the pilot (it is, with CSP and short-lived revoke, but write it down). |
| Offline | **Keep** | `idb` outbox for the same four writes v3 queues; 409 turns the queued report into a draft; never silent drop. Add an explicit “needs attention” list in the UI. |
| PDF | **Keep** | Playwright + bundled Noto Gujarati/Devanagari is the only reliable Indic route. Pin the browser to the Playwright version; one browser, concurrency 1, `shm_size`, 4 GB minimum (prefer 8 GB for production). Test text extraction + a page-1 pixel snapshot. |
| Analytics engine | **Keep, sequence carefully** | Legacy profile first, improved models second; constants as data, not code; deterministic seed and generator for the Monte Carlo; fixtures before screens. This is the largest single body of work; M4a is not a “few sessions”. |
| Messaging | **Keep** | One adapter interface; templates from day one; track the 24-hour window per contact; copy media immediately (WhatsApp media URLs expire in 5 minutes); log cost per message and enforce caps; consent text on first contact. |
| Infra | **Keep, right-size** | EC2 + Docker Compose + Caddy + RDS is right for a pilot. Add Terraform, GitHub OIDC (no long-lived AWS keys), MinIO locally, `.env.example`, and a real restore drill. One box is a single point of failure; 99.5% needs auto-recovery or a warm standby, not just backups. |
| Observability | **Keep** | JSON logs with tenant/request ids, `/health`, uptime ping, failed-jobs page, timer-lag alarm. Decide Sentry vs self-hosted GlitchTip in ADR 0002; if Sentry, scrub PII and note the region. |
| Testing | **Add a `docs/TESTING.md`** | Vitest for domain; Testcontainers Postgres for db/API/isolation; Playwright webServer + Compose for E2E; axe for accessibility; PDF text + pixel; offline replay; fake clock for SLA. The spec names the tools but not the harness, fixtures or CI wiring. |
| Cost | **Verify** | USD 110–150/month for two environments is tight once Chromium, RDS storage/backups, Secrets Manager, CloudWatch and WhatsApp fees are real. Recalculate on the AWS calculator before the M0 gate. |

## Can I take this on? What I can and cannot do

**I can own:** the architecture and schema, all application code (`apps/web`, `apps/server`, `packages/*`), migrations and RLS, seeds and the Cosmos importer, the analytics port, tests and CI, Terraform/Compose, staging deploys when credentials exist, debugging, performance, documentation, ADRs, parity tracking, and the session-by-session execution of M0–M4.

**I cannot:** create or pay for AWS/Meta/Sarvam accounts; complete Meta business verification or template approvals; obtain Bhavin’s export, Worker source, current platform HTML/Excel or PM tool; collect consented phone numbers and voice notes; sign a DPA or give legal advice; be the independent security reviewer; test on a real low-end Android/iPhone over 3G (Playwright device profiles are not the same); make product/business decisions; or give a production go/no-go at the cutover gate. Those are human or external.

**One environment caveat:** the harness was written for Claude Code with Fable/Opus/Sonnet agents and Claude hooks. In this DeepSeek Harness session, I can read and follow the rules, but the hooks do not fire and the named models do not exist; I would emulate the reviewer roles with subagents on available models. If the maker–checker separation depends on different model families, run the build in Claude Code, or accept a weaker independence here. Decide this before session 1.

## Effort, honestly

The spec says “a few weeks per milestone”. My estimate, for one agent working one ticket at a time with review and gates:

| Milestone | Estimate | Depends on |
| --- | --- | --- |
| M0 Foundation + walking skeleton | 1.5–2.5 weeks | AWS/domain for the deploy gate; local Docker for the rest |
| M1a Ticket core | 2.5–3.5 weeks | none beyond M0 |
| M1b Parity + cutover | 2.5–3.5 weeks | Bhavin’s export + Worker source; Gujarati strings |
| M2 Accountability | 1.5–2.5 weeks | role/SLA decisions |
| M3 WhatsApp + voice | 2–3 weeks + Meta lead time | Meta verification, templates, number, Sarvam, consented voice notes |
| M4a Analytics parity | 3–4 weeks | current platform HTML + Excel; answer-key fixtures |
| M4b The loop | 3–4 weeks | PM tool; code taxonomy approval |
| M5 Plant two | 3–4 weeks | a written M5 spec; second plant |
| M6 AI layer | 2–3 weeks | a written M6 spec; LLM/data-residency ADR; evaluation set |

**Total: roughly 22–30 agent-weeks, or 6–8 calendar months** with gates and external waits. The first usable cutover (end of M1b) is realistically **8–10 weeks after session 1**, if the export arrives. These are estimates, not commitments; M4 and M5 are the uncertain ones.

## GitHub: what I found and the exact steps

The repo `nimishshah1989/argus` exists, is **empty**, and is **public**. `gh` is authenticated as `nimishshah1989` with `repo` scope; git’s user name and email are set; the protocol is HTTPS.

Do this in order:

```bash
# 1. Make the repo private BEFORE any real data is pushed.
gh repo edit nimishshah1989/argus --visibility private \
  --accept-visibility-change-consequences

# 2. Connect the local folder.
cd "/Users/nimishshah/All AI/argus"
git remote add origin https://github.com/nimishshah1989/argus.git

# 3. Restructure first (docs/discovery, docs/spec, apps/, packages/, infra/),
#    add .gitignore, then commit and push.
git add -A
git commit -m "chore: initial discovery pack and build specification"
git branch -M main
git push -u origin main
```

Two cautions:

- The pack contains real names and plant data. Do not push it while the repo is public. If you would rather not make the repo private, scrub the discovery data first, and keep the real data in a separate private store.
- The harness says “never push to main”. For an empty repo, the initial pack commit on `main` is a reasonable exception; from session 1 onward, work on branches and merge via PRs. If you prefer, make the initial commit on a `setup` branch and open a PR against `main`.

I can run these commands for you, but I will not change your GitHub visibility or publish the pack without your explicit go-ahead. Say the word and I will do steps 1–3 in one pass after the restructure.

## First two weeks, concretely

**Session 1 (no product code):** resolve B1 in `docs/WORKFLOW.md`; restructure the repo; write `.gitignore`; make the repo private and push the pack; write ADR 0001 (stack), ADR 0002 (outside services), ADR 0003 (auth decision after the spike); generate `docs/spec/parity.yaml` from `PARITY.md` with stable ids; write `docs/plan/backlog.md`, `NEEDS.md`, `QUESTIONS.md`, `DIFFERENCES.md`; add CI (lint, typecheck, test, licence check, migration check) and an empty `docs/TESTING.md`.

**Spike week (throwaway, time-boxed):**
- Auth: build the two candidates side by side and pick one (B3).
- RLS: one table + policy + the generic isolation test + the unset-GUC assertion, with two tenants.
- Figures: implement `handsOn: lead|union` against the eight fixtures in B4; compare on synthetic multi-person jobs.
- PWA: prove two manifests from one Vite build (two HTML entries) or decide one manifest.

**Then M0:** schema v1 (tenant, person, login, session, machine, segment, group, move, list_item, shift, setting, glossary, ticket, event, crew, work_segment, breakdown_report, file, push_subscription, audit_log, import_batch, ref_counter, `app_router` functions); seed `cosmos` with the verified inputs and a seed report; brand/login/config; the walking skeleton (floor raise → desk Open) on local Docker Compose; the deploy/restore gates when AWS and the domain exist.

## Decisions I need from you (product and business, not technology)

1. **Commercial shape.** Is the first release a managed pilot for Cosmos (no billing/signup; tenant setup by us) or a commercial SaaS from day one (billing, self-serve, plan enforcement)? This decides whether M5.5 exists.
2. **Shifts.** Which is real: two windows (08:00–18:30, 18:29–05:00) or three shifts? The report form lists 3; the live config has 2. Day reports and all M4 shift KPIs depend on it.
3. **Legacy codes.** May I map `MEC → M` and `NI/INT/FS/PP/UTI → MIS` (or inactive), and ask Bhavin to confirm? Or should they stay as separate legacy codes?
4. **Data use and consent.** Can Cosmos’s real data be used in staging and test fixtures behind access controls, and what consent/DPA text do we use for staff phone numbers and voice notes? This is a legal/product answer, not a code answer.
5. **Name and owner.** Is the product “Argus” (the GitHub repo name) or “Maintenance OS” (the spec’s working name)? And who is the human senior engineer who signs off tenant isolation before cutover and before plant two?

## Appendix: what I verified

- `source/cosmos-platform-export-2026-10-28.json`: 191 machines (125/16/17/30/3), 1,158 breakdowns, 15 cell-log rows, settings `prodHrsPerDay=20`, `workDaysPerYear=300`, `efficiencyFactor=15`, `whyWhyThresholdHours=24`; 22 codes including 3 inactive (`ELE`, `HYD`, `ROT`).
- `bhavin-v3/live-config-2026-11-09.json`: 192 machine ids; the only id not in the export is `VC-57`; 14 team entries (13 Team + 1 Vendor); 19 codes; 2 shift windows; 13 team-shift entries; no group/segment overrides; `quickProblems` null → six defaults; `floorLive=false`; features `general` and `pause` on.
- `bhavin-v3/glossary-2026-11-09.json`: 86 English corrections, 58 Gujarati terms, 3 caveats (including known bad entries to fix at seed).
- `source/cosmos_platform.html`: embedded `INIT_*` data has the same 1,158 breakdown ids as the export; 125/16/17/30/3 machines; 15 cell-log rows; six external CDN scripts (XLSX 0.18.5, Chart.js 4.4.1, pdf.js 3.11, jsQR 1.4, jsPDF 2.5.1, html2canvas 1.4.1). The answer-key script will need network access or locally cached copies of those CDNs.
- Breakdown data quality: 381 blank codes; 353 “Maint. Team”; 7 blank sign-offs; comma-separated names; unknown codes `MEC` 73, `NI` 2, `INT` 2, `FS` 1, `PP` 1, `UTI` 1; 53 PM rows; 101 NO DT rows.
- Git/GitHub/local toolchain as stated above.
