# Build protocol — how this product gets built

Written 10 November 2026 for Nimish (product owner) and the build agent (engineering lead).
This is the working agreement. The detailed review ladder is in `docs/REVIEW-MECHANISMS.md`; the anti-bloat rules are in `docs/LEAN.md`; the 9/10 scorecard is in `docs/QUALITY-BAR.md`; the goal/graph orchestration and parallel policy is in `docs/ORCHESTRATION.md`; the low-cost AWS shape is in `docs/INFRASTRUCTURE.md`. If this file conflicts with `CLAUDE.md` or the harness, the precedence is:
direct instruction → `CLAUDE.md` → `.claude/harness/CLAUDE.md` → this file → individual skill defaults.

---

## 1. Who does what

| Role                 | Who                                             | Owns                                                                                                 | Never does                                                                       |
| -------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Product owner        | Nimish                                          | What users should experience, priorities, pricing, policy decisions, testing previews, gate go/no-go | Reviews code, chooses libraries, manages agents, approves test seams             |
| Engineering lead     | the build agent                                 | Architecture, schema, code, tests, CI, infrastructure-as-code, deploys to staging, docs, estimates   | Creates paid accounts, signs legal agreements, gives a production go/no-go alone |
| Independent reviewer | a fresh-context agent, and a human for security | Review against the slice plan and a fixed checklist                                                  | Writes the code it reviews                                                       |
| External suppliers   | Bhavin, Meta, AWS, Sarvam, Cosmos staff         | Their files, accounts, approvals, translations, voice notes                                          | —                                                                                |

The product owner is not the project manager. The build agent runs the day-to-day loop and brings decisions, not tasks.

---

## 2. The loop, one slice at a time

A **slice** is the smallest piece of work that a user can see working end to end. One slice = one branch = one pull request = one review = one merge. No “big bang” sessions.

| Step              | What happens                                                                                        | Artifact                  | Exit condition                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------- |
| 1. Intake         | Read `docs/HANDOFF.md`, the ticket, the spec section, the parity rows                               | ticket                    | You can say what a user will be able to do                      |
| 2. Plan           | Name every file, interface, data field and test case (Given/When/Then) before code                  | `docs/slices/<ticket>.md` | A fresh reviewer says a coder could build it with zero guessing |
| 3. Red            | Write the failing test first, at an agreed seam                                                     | test commit               | The test fails for the right reason                             |
| 4. Green          | Write only enough code to pass                                                                      | code commit               | The new test passes                                             |
| 5. Prove          | Run the whole suite: unit, database isolation, end-to-end, PDF/offline/accessibility where relevant | CI run                    | Everything green, no test skipped or weakened                   |
| 6. Review         | Fresh-context reviewer checks the diff against the plan and the checklist                           | review verdict            | `PASS`, or findings fixed and re-reviewed                       |
| 7. Merge + deploy | Squash-merge; `main` deploys staging automatically                                                  | PR                        | On staging, with a URL and three steps to try it                |
| 8. Record         | Update parity, changelog, handoff, log; write a decision record if a choice was made                | docs                      | The next session can start from the repo alone                  |

Rules that do not bend:

- Tests first; never delete, skip or weaken a test to go green.
- The smallest complete change: prove it needs to exist; reuse before writing; no abstraction with one use; no new runtime dependency without an ADR; file 400 lines, function 60, complexity 12 (`docs/LEAN.md`).
- One slice per PR; every changed line traces to the slice.
- No plant-specific values in code: machines, codes, shifts, SLA targets and numbering are configuration or fixtures.
- Every tenant table gets `tenant_id` and row-level security in the same migration.
- Business rules live in `packages/domain` as pure functions; screens and handlers do not contain rules.
- No secrets, real personal data, ids or keys in code, URLs, fixtures, screenshots or logs.
- Migrations are expand-and-contract; a destructive migration needs a backup step and a schema review.
- Nothing merges red. Nothing goes to production from a session.

### Bugs

A bug starts with a failing test that reproduces it, then the root cause, then a regression test. A symptom patch is not a fix.

### When the spec is silent or wrong

Write the conflict and the proposed resolution in `docs/spec/QUESTIONS.md` and proceed, **unless** the change alters stored data, money or an outside account; then mark the ticket `blocked-external` and move to the next one. Never guess silently.

---

## 3. Cadence, gates and what you see

**Weekly (30–60 minutes, you):** a plain-English demo on staging — what changed for a user, three things to try on your phone, what I need, what risk is coming. No code, no jargon.

**At a milestone gate (1–2 hours, you):** I write `docs/plan/gates/M<n>.md`: scope done and not done, parity counts, test counts, open questions, ten steps to try it on staging, known risks, and one go/no-go question. You test and answer. The next milestone does not start without your answer.

**At cutover (half a day, you + Bhavin):** the runbook in `docs/spec/` — import, his app read-only, ours live, day-3 and day-7 checks, revert plan. You own the go/no-go; I own the technical execution.

**Milestones:** M0 foundation and walking skeleton → M1a ticket core → M1b parity and soft cutover → M2 accountability → M3 WhatsApp and voice → M4a analytics parity → M4b the loop → M5 plant two → M6 AI layer. Each has a written gate; no milestone is “done” because it looks done.

**What you will not be asked:** which library, which database, how to structure code, whether a test seam is right, which agent to run. Those are mine, recorded in `docs/adr/`.

---

## 4. Architecture, in plain English

**One office building, not a campus.** One server process (Fastify) that also runs the background jobs, one Postgres database, one static React web app, one S3 bucket. This is called a **modular monolith**: inside the building there are separate departments (auth, tickets, machines, reports, analytics), each with a door and a rule about who may enter, but they share one foundation. It is the right shape for 15–250 users and a solo founder; microservices would add roofs, plumbing and failure modes without adding value.

```
phones / WhatsApp / QR
        │
        ▼
   one HTTPS server  ──►  Postgres (data + job queue)
        │                    │
        │                    ├─► S3 (PDFs, photos, voice notes)
        │                    └─► background jobs (SLA timers, PDFs, analytics, messages)
        ▼
   one React PWA (floor, desk, board, analytics, settings)
        │
        └─► offline cache + outbox on the phone
```

| Layer           | Choice                                                                               | Why                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Language        | TypeScript everywhere                                                                | One language for a small team and for AI agents; the analytics port was always going to be TypeScript                       |
| Server          | Fastify + Zod                                                                        | Schema-first, fast, small; one process for API and jobs (`ROLE=api                                                          | worker | all`) |
| Database        | Postgres 16/17, Drizzle ORM, SQL migrations                                          | Boring, reliable, row-level security, one queue table; no Redis                                                             |
| Jobs            | pg-boss                                                                              | Timers, retries, dead letters, cron — in the same database                                                                  |
| Web             | Vite + React + TanStack Query + Tailwind + shadcn/ui                                 | Static files, installable PWA, offline; no server rendering to operate                                                      |
| Charts / tables | ECharts, TanStack Table                                                              | One chart system, one table system                                                                                          |
| PDFs            | Playwright + Chromium + Noto Gujarati/Devanagari                                     | The only reliable way to shape Indic scripts                                                                                |
| Files           | S3 with versioning                                                                   | PDFs, photos, voice notes, imports, backups                                                                                 |
| Hosting         | AWS Mumbai (ap-south-1), EC2 + Docker Compose + Caddy, RDS, S3, SES, SSM, CloudWatch | Data stays in India; one-command deploy and rollback; no Supabase, no Vercel, no NAT, no ALB — see `docs/INFRASTRUCTURE.md` |
| Tenancy         | Shared schema + `tenant_id` + row-level security                                     | Lowest cost and effort at this scale; database-per-tenant is a later enterprise option                                      |
| Analytics       | `packages/engine`, legacy profile first, Python sidecar only when needed             | Reproduce Bhavin’s numbers exactly, then improve                                                                            |

**What I rejected and why:** the Atlas fork (AGPL, Java, would lose Bhavin’s ticket model), Next.js (fast-moving; the app is a static PWA), separate mobile apps (PWA serves the floor better), microservices and Redis (no load for them), Supabase as the core (managed lock-in; a plain Postgres keeps the data ours).

**How the choice is governed:** the shape is decided in [SPEC.md](spec/SPEC.md) §0 and §5. I own the technical choices and record every irreversible one in `docs/adr/`. If a spike shows a better option, I write a one-page decision record with what I rejected and why, and I tell you in plain English before changing it. I will not silently swap the architecture.

---

## 5. The tables

**About 26 tables in v1, roughly 55 by M4.** Not 200. The design rule is: **events are the truth; the ticket row is a fast cache; `work_segment` is the only interval table.** Stopped periods, pauses and handover waits are derived from event pairs, not stored four times.

### v1 — M0/M1 (about 25)

| Group                      | Tables                                                                                                  | What they hold                                                                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tenancy and people         | `tenant`, `person`, `login`, `session`, `platform_access`                                               | One row per customer; the acting human; personal or shared login; a 30-day session; our time-limited support access                                                                   |
| Machines and configuration | `segment`, `machine_group`, `machine`, `machine_move`, `list_item`, `shift`, `setting`, `glossary_term` | CNC/Conventional/Process/Utility/DG/Robot; groups; nameplate fields; effective-dated cell moves; every option list with flags; shifts; settings; the Gujarati/transliterated glossary |
| Tickets                    | `ticket`, `ticket_event`, `crew_member`, `work_segment`                                                 | Current state + cached figures; the append-only event log with per-ticket sequence; who joined as primary/support; the one interval table per person per working stretch              |
| Reports and files          | `breakdown_report`, `file`, `push_subscription`                                                         | The old form (now with a root-cause field); S3 metadata; push endpoints                                                                                                               |
| Safety and imports         | `audit_log`, `import_batch`, `import_row`, `ref_counter`, `command_idempotency`                         | Settings/admin actions; every import with its source rows; gapless BD/WR numbering; replay protection for commands that have no ticket yet                                            |

### M2 — accountability (6)

`sla_policy`, `escalation_rule`, `sla_timer`, `escalation_event`, `roster_entry`, `handback`.

### M3 — messaging (6)

`wa_contact`, `wa_conversation`, `wa_message`, `wa_template`, `notification`, `consent`.

### M4 — PM, codes and analytics (about 13)

`pm_plan`, `pm_task`, `pm_checklist`, `pm_execution`, `failure_code`, `failure_code_alias`, `failure_coding`, `engine_run`, `kpi_snapshot`, `forecast`, `forecast_outcome`, `scorecard`, `intervention`.

### M5 — plant two (about 6)

`plant`, `tenant_domain`, `industry_pack`, `import_mapping`, settings scope columns, `platform_login`.

### M6 — AI (about 3)

`ai_suggestion`, `ai_evaluation`, `llm_usage` (the per-tenant cost cap).

**Every tenant table** has `id` (UUID), `tenant_id`, `created_at`, `updated_at`, and an RLS policy enabled and forced. The exceptions are `tenant`, the migration table and pg-boss’s own tables; they are documented.

**Every new table** is covered automatically by the generic isolation test: it introspects the schema, inserts rows for two tenants, and asserts each tenant sees only its own.

**Deliberate simplifications:** no `plant` table and no settings scopes in v1 (one tenant = one plant until M5); no separate stop/wait/handover interval tables (derived); billing, self-serve signup, plan enforcement and invoices are deferred to after M6 (ADR 0004). The `tenant.plan` and `tenant.status` columns stay as placeholders, not enforced rules.

---

## 6. Multi-tenancy and scale

### How isolation works

1. A request arrives at `cosmos.<domain>`. The **host name**, never a URL parameter or header, resolves the tenant.
2. One transaction begins with `set_config('app.tenant_id', <uuid>, true)` — transaction-local, so a pooled connection cannot leak it to the next request.
3. Every tenant table has a policy: `tenant_id = current_setting('app.tenant_id')::uuid`, enabled and **forced**. The application role cannot bypass it. A dev-mode assertion throws if a query runs without the setting, because the failure mode of RLS is an empty list, not an error.
4. Three places legitimately work across tenants, through a separate `app_router` role with narrow `SECURITY DEFINER` functions: session lookup by token (returns the tenant), WhatsApp routing by phone number (returns tenant and person), and the job runner (reads the tenant from the job payload, then sets it).
5. A row in another tenant is always `not_found`, never `forbidden`.
6. S3 keys are prefixed by tenant; job payloads carry the tenant; logs carry tenant and request ids.
7. One generic test tries every table as two tenants in CI; a new table is covered without a new test.

### How it scales

The current load is 15 users, 192 machines, about 250 tickets a month, 1,158 history rows. The pilot runs comfortably on one server and one Postgres. The scale path, in order, only when a measurement says so:

| Pressure                   | First move                                                                                                                 | Later move                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| CPU from PDFs or analytics | `ROLE=worker` in a second container; concurrency 1 for Chromium                                                            | a separate renderer or Gotenberg                                                          |
| Database reads             | indexes on `(tenant_id, status, updated_at)` and `(tenant_id, machine_id, reported_at)`; cursor pagination; cache `/state` | read replica; partition `ticket_event` by tenant/time                                     |
| More plants                | one tenant = one plant; M5 adds `plant` and scoped settings                                                                | database-per-tenant as an enterprise option                                               |
| More users                 | static web files behind a CDN; 30-second polling; async jobs                                                               | server-sent events only if a plant’s size demands it                                      |
| Availability               | RDS backups, S3 versioning, deploy rollback, health checks                                                                 | warm standby or auto-recovery; one EC2 is a single point of failure and 99.5% is not free |

**What I will not do now:** Kafka, Redis, Kubernetes, a service mesh, event sourcing beyond the ticket log, or a second database. Those are costs without a customer.

---

## 7. Capabilities and analytics

| Milestone | What a user gets                                                                                                                                                                                                                                                     |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0        | Sign-in (personal and shared phone), tenant brand, settings, Cosmos master data seeded, the walking skeleton: raise a ticket on the floor, see it on the Open list, on staging                                                                                       |
| M1a       | The whole v3 ticket loop: raise, start, join, leave, pause/resume, transfer, update, machine running/stopped, close with/without report, mark done, late report, cancel, restore, correct, follow-up tasks; Open/Mine/Team/detail; per-person and per-ticket figures |
| M1b       | Breakdown and day-report PDFs (server-rendered, Gujarati glyphs), Live board, web push, offline outbox, update banner, WhatsApp share text, Bhavin’s ticket import, Gujarati strings, soft cutover                                                                   |
| M2        | Severity S1–S4, SLA clocks, escalation ladder L1–L4 + vendor, duty roster, production handback (confirm/dispute), failed-jobs page, device revoke                                                                                                                    |
| M3        | WhatsApp as a channel: report by text or voice, assignment/escalation/handback messages, PDF delivery, QR per machine, email escalation, transcription with confirmation                                                                                             |
| M4a       | Every platform screen reproduced: dashboard, A1–A10, health scores, bad actors, MTTR/MTBF, Pareto, heatmaps, cost, ISO/Excel, Action Center, PM calendar, Guide — with a legacy mode that matches the answer key                                                     |
| M4b       | PM plans/checklists/load spreading, failure coding, shift-calendar KPIs, frozen monthly forecasts, a published scorecard, inspection tickets from Hot machines, the intervention ledger                                                                              |
| M5        | Importer, industry pack, settings cascade, multi-plant tenants, onboarding wizard, Hindi, approvals, vendor sharing, scheduling board, warranty/AMC, skills, shift handover                                                                                          |
| M6        | Failure-code suggestion, evidence-based fix finder, plain-language analytics with the SQL shown, daily briefing, duplicate detection, an evaluation harness with a shadow-mode threshold                                                                             |
| Post-M6   | Commercial layer: billing, self-serve signup, plan enforcement, GST invoices, platform super-admin (ADR 0004)                                                                                                                                                        |
| Later     | Cross-plant benchmarks and industry packs (opt-in, anonymised), ERP/Tally and machine connectors, sensors, MCP for outside AI tools                                                                                                                                  |

**The analytics rule:** parity first, improvements second, AI last. Every number on every screen drills to its tickets. Every KPI tile links to its Guide entry. Money figures are visible only to head, plant head and admin. Forecasts are frozen monthly and scored; a forecast without a published hit-rate is not shipped.

---

## 8. External code and services

### Open-source repositories/libraries we depend on (permissive licences only)

| Layer           | Pick                                                                                                                                    | Licence                    |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Server / schema | Fastify, Zod, Drizzle ORM, pg-boss, Pino                                                                                                | MIT / Apache-2.0           |
| Auth            | hand-rolled sessions (ADR 0003): Argon2id, opaque token hashed at rest, 30-day sliding                                                  | MIT                        |
| Web             | Vite, React, React Router, TanStack Query/Table, Tailwind, shadcn/ui, ECharts, FullCalendar, vis-timeline, react-grid-layout            | MIT / Apache-2.0           |
| PWA / offline   | vite-plugin-pwa, Workbox, idb, web-push                                                                                                 | MIT / MPL-2.0              |
| PDF / QR        | Playwright, Noto fonts, node-qrcode, zxing-wasm                                                                                         | Apache-2.0 / OFL / MIT     |
| WhatsApp        | whatsapp-api-js, fastify-raw-body                                                                                                       | MIT                        |
| Import          | SheetJS CE 0.20.x (from cdn.sheetjs.com, pinned), PapaParse, Fuse.js, react-spreadsheet-import                                          | Apache-2.0 / MIT           |
| Reliability     | our own Weibull/KM/Crow-AMSAA/Poisson code; stdlib/jStat/mathjs for distributions; Python sidecar with lifelines, statsmodels, ruptures | MIT / BSD / Apache-2.0     |
| Infra / test    | Terraform, Docker Compose, LocalStack or s3rver, Vitest, Testcontainers, Playwright, axe                                                | MPL-2.0 / MIT / Apache-2.0 |

**Never copied or depended on:** AGPL/GPL code (Atlas CMMS, Odoo, ERPNext, GLPI, Zammad, Metabase, and the rest of the read-only list). They are read for ideas only. `THIRD_PARTY.md` lists every dependency with its licence and is checked in CI. No BSL/SSPL/Elastic/source-available code.

### External services (each behind one adapter)

AWS (EC2, RDS, S3, SES, Secrets Manager, CloudWatch, Route 53), Meta WhatsApp Cloud API, Sarvam speech-to-text, browser push services (Google/Apple), an error tracker (Sentry with PII scrubbing, or self-hosted GlitchTip), and later an LLM provider for M6. Every new service needs a decision record and a data-protection note; data stays in ap-south-1 unless an ADR says otherwise. Each channel has a monthly cap; a cap hit pauses the queue and tells the admin.

### GitHub

The repo is the source of truth: issues for the backlog, one PR per slice, Actions for lint/typecheck/test/build/migration/licence checks and the staging deploy. `gh` is authenticated on this machine; I can create labels, issues and PRs.

---

## 9. Memory and anti-drift

**The chat is disposable. The repository is the memory.** A long conversation will be compacted or lost; a file will not. Every session starts by reading the repo and ends by writing it.

| Artifact                   | Holds                                                                    | Written                        | Read by                 |
| -------------------------- | ------------------------------------------------------------------------ | ------------------------------ | ----------------------- |
| `docs/HANDOFF.md`          | Live, in flight, next, blocked — under 50 lines                          | Start and end of every session | Every session first     |
| `docs/plan/backlog.md`     | Every ticket, dependencies, `auto`/`gate-manual`/`external`, status      | Session 1, updated per ticket  | Every session           |
| `docs/plan/NEEDS.md`       | Every input only you or Bhavin can supply, with exact format             | When blocked                   | Every session           |
| `docs/spec/QUESTIONS.md`   | Spec/parity/code conflicts and the resolution followed                   | When one appears               | Planner and reviewer    |
| `docs/spec/DIFFERENCES.md` | Every deliberate departure from Bhavin’s behaviour: old, new, why        | When one is chosen             | Gate report             |
| `docs/spec/parity.yaml`    | One row per parity feature: id, disposition, milestone, status, evidence | Per ticket                     | CI and gate report      |
| `docs/adr/`                | Irreversible decisions, one page, with what was rejected                 | When a choice is made          | Every future session    |
| `docs/slices/<ticket>.md`  | Files, interfaces, fields, Given/When/Then tests                         | Before code                    | Coder and reviewer      |
| `docs/plan/gates/M<n>.md`  | Evidence, counts, ten steps to try, risks, go/no-go                      | End of a milestone             | You                     |
| `wiki/` + `wiki/log.md`    | Why, not what; append-only session log                                   | When a reason is not in code   | Anyone asking “why”     |
| `CHANGELOG.md`             | User-visible changes                                                     | Per slice                      | You and the gate report |
| The tests                  | Executable memory of every rule                                          | Per slice                      | CI                      |

### The session protocol

1. **Start:** read `HANDOFF`, the ticket, its spec section, its parity rows, and the ADRs it touches. Do not trust memory of the chat.
2. **Work one slice.** If it does not fit, split the slice — never the context.
3. **At 50–70% of the context window:** stop, write the handoff, and continue in a fresh session. Never wait for 90–99%: compaction at that point loses detail and costs more. The `handoff` skill exists for this.
4. **End:** update handoff, log, parity, changelog, and any question/difference. The next session must be able to start from the repo alone.
5. **Subagents get constructed briefs**, not the whole conversation: the slice plan, the files, the tests, the checklist. The reviewer gets the diff, the plan and the CI result, not the author’s reasoning.
6. **The model may forget; the repo may not.**

### Drift alarms (checked weekly and at every gate)

- Parity count has not moved, or a `done` row has no test.
- A PR touches files outside its slice.
- Tests were skipped, weakened or deleted.
- The handoff is stale or describes work the repo does not show.
- The same question appears in `QUESTIONS.md` twice.
- CI is red for more than a day, or a deploy is rolled back twice.
- A plant-specific value appears in code.
- A new table has no `tenant_id`/RLS, or a new dependency has no licence entry.
- A milestone gate is claimed without a gate report.
- The scope grows by a feature that is not a parity row or a written addition.

If an alarm fires, the fix is a ticket, not a conversation.

### DeepSeek Harness specifics

- The repo’s `.claude` hooks and agents are Claude Code-specific: in DSH they do not fire, and `fable`/`opus`/`sonnet` do not exist. I follow their intent with DSH tools: `bash`, `read`/`write`/`edit`, `subagent` for fresh-context planning/review, `workflow` for large audits, `todo_write` for the session, and the `handoff` skill at the context limit.
- DSH has workspace-write or danger-full-access file policy; I still do not touch production, and I do not create accounts or change GitHub visibility without your go-ahead.
- The durable memory is the same repo files. DSH can compact or end a session; the files survive.
- Model routing is recorded in `docs/orchestration.yaml` and `docs/ORCHESTRATION.md` §10: DeepSeek Flash plans and reviews; the hosted free coder (`openrouter/nvidia/nemotron-3-ultra-550b-a55b:free`) writes product code. The maker and checker are different model families, but both are small enough that fixed checklists, tests and human R3 sign-off remain the real gate.
- The coder route and its credential are machine-local and session-scoped: run the 1-word probe before the first packet, and start a new session after the profile changes. Do not silently fall back to DeepSeek for code.

---

## 10. Skills: what I use, and what they actually do

The repo’s suite is mostly **Matt Pocock’s skills** (`grill-with-docs`, `grilling`, `domain-modeling`, `to-spec`, `to-tickets`, `tdd`, `diagnosing-bugs`), **Superpowers’** `subagent-driven-development`, plus `impeccable` (design) and `office-hours` (product). DSH also has its own native skills with overlapping intent. I use the native one when it matches, and read the repo’s pinned `SKILL.md` when it does not.

| Phase            | Skill                                                   | What it enforces                                                              | Source / DSH use                                   |
| ---------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------- |
| Product shaping  | `office-hours`                                          | Forcing questions, premise challenge, alternatives                            | Repo only; already done — the spec is the brief    |
| Requirements     | `grill-with-docs` / `grill-me`                          | Relentless product questions, glossary and decisions                          | both                                               |
| Spec and tickets | `to-spec`, `to-tickets` / `to-issues`, `to-prd`         | One vertical slice per ticket, acceptance criteria, blocking edges            | both                                               |
| Architecture     | `architect`, `architecture-reviewer`, `schema-reviewer` | Modular monolith, one interface per module, RLS, keys, indexes, reversibility | Repo agents; emulated with fresh-context subagents |
| Slice plan       | `slice-planner`, `plan-reviewer`                        | Every file, interface, field and test named; no guessing                      | Repo agents; emulated                              |
| Build            | `tdd`, `subagent-driven-development`                    | Red → green; fresh implementer per task; task review                          | both                                               |
| Debug            | `diagnosing-bugs` / `diagnose`                          | Reproduce, minimise, hypothesise, instrument, fix, regression test            | both                                               |
| Design           | `impeccable`, `DESIGN.md`                               | Clarity, deference, depth; one primary action; accessibility                  | Repo + native design skills                        |
| Review           | `code-reviewer`                                         | Plan match, no extra, tests first, boundaries, no secrets, green suite        | Repo agent; fresh-context subagent                 |
| Memory           | `handoff`                                               | Compact the session into a document another agent can pick up                 | native                                             |
| Audit            | `improve-codebase-architecture`                         | Deepening opportunities, ADR-aligned                                          | later                                              |

**Three skill/harness conflicts I will resolve once, in `docs/SKILLS.md`:**

1. `tdd` asks the user to confirm test seams; under our rules the **slice plan** is the confirmation, and you are not asked a technology question.
2. `to-tickets` asks the user to approve the breakdown; the **backlog** is approved as part of the milestone plan, not ticket by ticket.
3. `subagent-driven-development` says a merge is a stop-and-ask; our harness says the agent merges when CI is green and the review passes. The **review** is the gate, not a human click.

Skills are checklists, not magic. The real safety is the tests, the isolation suite, the reviewer, the parity count and the gate report.

---

## 11. Bhavin’s files: what to ask for, and what each unlocks

I cannot promise another person’s delivery date. I can promise that M0 and M1a do not wait for him. Here is the exact request; send it as a checklist.

| Ask                                                                                                                     | Format                                                                                 | Unlocks                                                                  | When          |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------- |
| Every live ticket (BD and WR) with its events, crew, pauses, reports, segments, parent/child links, refs and timestamps | JSON export, one object per ticket, raw (no cleaning, include cancelled and corrected) | M1b import and cutover                                                   | Needed by M1b |
| The Cloudflare Worker source                                                                                            | The server code, read-only; NDA if he prefers                                          | Exact figure semantics (the `activeMin` question), import reconciliation | Needed by M1b |
| The **current** analytics platform HTML and his latest Excel export                                                     | The file from his browser, plus the workbook                                           | M4a answer key (every displayed figure)                                  | Needed by M4a |
| The PM tool, if it is a separate file                                                                                   | File, screenshots, or a walkthrough                                                    | M4b PM calendar and checklists                                           | Needed by M4b |
| The people list with roles and which logins are shared                                                                  | Names, roles, shared/personal, no passwords                                            | Seed and permissions                                                     | M0/M1         |
| Consent for staff phone numbers and 50–100 Gujarati voice notes                                                         | Written consent; recordings                                                            | M3 voice accuracy                                                        | During M2     |

If only some arrive tomorrow: the export + Worker unblock the import; the platform HTML + Excel unblock the answer key; the PM tool unblocks M4b; none of them block M0 or M1a. I will fingerprint every file, count its rows, and write a data inventory before using it. I will not “clean” his data on the way in; the seed report lists every conflict for a human decision.

---

## 12. What you set up, and what I do with it

| #   | You create                                                         | Time                        | What I need from it                                                            |
| --- | ------------------------------------------------------------------ | --------------------------- | ------------------------------------------------------------------------------ |
| 1   | GitHub repo, **private**                                           | 5 min                       | The remote URL; I connect and push                                             |
| 2   | AWS account, ap-south-1, MFA, budget alarm, IAM role for CI (OIDC) | 1 day                       | Account id, role ARN, region; I write Terraform                                |
| 3   | Domain + Route 53 (or Cloudflare)                                  | 1 day                       | The domain; I wire `cosmos.staging.<domain>`                                   |
| 4   | Meta developer app + free test number, inside a Business Portfolio | 1 day; verification 2 weeks | App id, test number, token stored in Secrets Manager; start verification early |
| 5   | Sarvam API key                                                     | 1 day                       | Key in Secrets Manager; I build the adapter                                    |
| 6   | Sentry (or GlitchTip) + uptime monitor                             | 1 hour                      | DSN; PII scrubbing on                                                          |
| 7   | Local: Docker Desktop running, Terraform installed                 | 1 hour                      | A working `pnpm dev` and local Postgres                                        |

Do not buy the production WhatsApp number or start AWS production until the M1b gate. Staging first. Every credential goes into Secrets Manager or `.env.local`, never into a file that can be committed.

**Costs to expect:** roughly USD 60–95 a month for two AWS environments (production RDS, staging self-hosted or a second database), plus WhatsApp per-message and Sarvam per-minute fees; a billing alarm at ₹30,000. No Supabase, no Vercel, no Redis, no NAT, no ALB, no paid APM. The caps are settings with tests, not good intentions. The full cost model is in `docs/INFRASTRUCTURE.md`.

---

## 13. Definition of ready and definition of done

**Ready** (a ticket may start): it has a parity row or a written addition; its spec section is named; its acceptance criteria are testable; its dependencies are done or explicitly waived; the files/interfaces/fields/tests are named in the slice plan; any external input is present or the ticket is marked `blocked-external`.

**Done** (a ticket may merge): the failing test came first; the whole suite is green; the isolation test covers any new table; strings are in i18n; the changelog line is written; `parity.yaml` is updated; the PR matches the plan and nothing extra; the reviewer passed; it is merged and on staging.

**A milestone is done** only when its gate report exists and you have answered its go/no-go question.

---

## 14. The first 30 days

| Week | Work                                                                                                                                                                          | Your involvement                                      |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1    | Repo is private and restructured; write `WORKFLOW.md`/`SKILLS.md`, ADR 0001–0003; parity.yaml; backlog; CI; testing doc; four one-week spikes (auth, RLS, figures, manifests) | 30 minutes: try the first staging link when it exists |
| 2    | Schema v1 with RLS; generic isolation test; `seed:cosmos` + seed report; brand/login/config                                                                                   | 30 minutes: try sign-in on staging (when it exists)   |
| 3    | Walking skeleton: floor raise → desk Open; deploy/rollback; restore drill                                                                                                     | 30 minutes: raise one ticket on your phone            |
| 4    | M0 gate report; start M1a (ticket state machine + floor/desk)                                                                                                                 | 1 hour: M0 go/no-go                                   |

The first visible thing you can try is a ticket raised on the floor screen and seen on the Open list. That is deliberate: no month of invisible foundation.

---

## 15. The one-paragraph version

I build in vertical slices, one PR at a time, with a failing test first, a fresh-context review, a green suite and a staging URL; I record every decision and every parity row in the repo; I stop at milestone gates and write a plain-English report; you test on your phone, answer product questions and give the go/no-go. The repo — not the chat — is the memory, so a new session can always pick up exactly where the last one stopped.
