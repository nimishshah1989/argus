# Roadmap — evaluation and full plan (13 November 2026)

Basis: `docs/spec/SPEC.md`, `docs/plan/*`, `docs/spec/parity.yaml`, both harness contracts, the code on
`main` (`b5b0b84`), an independent read-only code audit, and the suites **run in this session**: `pnpm test`
**507/507** (53 files, real Postgres via Testcontainers) and `pnpm test:e2e` **42/42** (desktop + phone).
"V" = verified in code or by running it; "est." = estimate. Nothing was run against staging: staging does not exist.

## 1. Verdict

The code that exists is careful and its tests are real: forced RLS on all 28 tenant tables, every app path
inside `withTenant` (including jobs and the importer), idempotent commands with row locks, an event log, a
migration ledger with crash-recovery tests, ~15k lines of tests for ~20k lines of source. **The problem is
sequencing and honesty of status, not code quality.** About 50 merged PRs, **zero users, no staging, no gate
ever passed**. The spec says M1 ends in cutover and "M2 then lands on a live system"; instead M2 (severity,
SLA timers, tags) was built while M1 parity is 12 of 47 rows done and the docs describe M1 as "shipped".
Stop new features. Ship M1 to Cosmos. Then M2.

## 2. Where the build actually stands

| Area            | Docs say        | Verified state                                                                                                                                                                                                                                                           |
| --------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M0 Foundation   | 7/8 done        | Code done. **Infrastructure never applied, and the deploy workflow cannot run as written** (§8.1). 0.8 "on staging" ran locally only. M0 gate never held; no `docs/plan/gates/`.                                                                                         |
| M0-0.5 Settings | done            | **No UI to manage people, logins, machines, groups, shifts or lists** (only wait-reason flags). **No translation screen in the UI** (API only), yet N5 Gujarati is meant to be entered through it. Settings has criticality, severity matrix and SLA only. (V)           |
| M1a Ticket core | merged          | All v3 commands exist in `packages/domain` and as API routes (V). **Follow-up tasks absent**: no task creation at close, no Tasks tab (V). `recordPastBreakdown` exists in the domain but has no route or screen (V).                                                    |
| M1b             | "shipped"       | PDFs, board, push, offline outbox (scope matches spec), synthetic importer + undo. Missing: update banner (`skipWaiting` fires immediately), `?m=` deep link, desk install (two manifest links on one page; browsers use the first), real import, Gujarati, cutover. (V) |
| M2              | 2.1, 2.2 merged | Severity + SLA timers work in tests; no user has seen them. 2.3–2.5 not started.                                                                                                                                                                                         |
| M3–M6           | —               | Not started; `packages/engine` is an empty package.                                                                                                                                                                                                                      |
| Parity ledger   | 80 rows         | 16 done · 34 in-progress · 26 todo · 3 external · 1 waived. **The 34 in-progress rows record no gaps.**                                                                                                                                                                  |

## 3. Gaps, ranked

**Strategic**

1. **Nothing is live.** Under Athena, Nimish's job is to test previews; there is nothing to open on a phone.
2. **Built out of order.** M2 started before the M0/M1 gates. Escalation needs a real roster, phones and
   tickets; its five open product questions are better answered after two weeks of live use.
3. **N1 is the biggest risk.** The importer was built against a schema _we_ wrote, never against Bhavin's
   data or Worker source. If his export differs, 1.10 restarts. It also gates cutover.
4. **Cutover blockers hidden behind "done":** no admin screens for people/logins/machines/shifts, no
   translation screen, no follow-up tasks. Cosmos cannot run day-to-day without them.

**Process (Athena harness)** 5. **Two contradictory harnesses.** `.claude/harness/CLAUDE.md` (Athena v3: Fable architects, Opus plans and
reviews, Sonnet builds, GitHub Issues) vs repo `CLAUDE.md`/`AGENTS.md`/`ORCHESTRATION.md` §10 (DeepSeek
plans, free Nemotron codes, `backlog.md`). §10.4 still names the retired TwIL/Ollama route. Much of the
last stretch went into model routing, not product. 6. **Athena artifacts missing:** `docs/BRIEF.md`, `docs/ARCHITECTURE.md`, `docs/DATA-MAP.md`,
`docs/decisions/`; **zero GitHub Issues**; no gate reports. 7. **Stop hook is a no-op:** `.claude/harness/fast-tests.sh` only prints "No fast tests configured yet". 8. **Status docs overstate:** `backlog.md` statuses wrong, `HANDOFF.md` says "M1b shipped" and "SLA PR
pending" (it is merged), `STATUS.md` older, `wiki/` has one page, `TAG-SYSTEM.md` describes tags the code
does not implement (and that would duplicate severity and ticket state). 9. **Local machine hygiene** (Nimish's Mac; not visible from the cloud): dirty stale branch, nested
worktrees, a worktree holding `main`. Graphify output and its ADR exist only there, so this review could
not use the graph — it used the code directly.

**Product** 10. Product name unresolved (N13): `uptimo` packages and image, `argus` repo and Terraform bucket. 11. Analytics parity (20+ platform screens, "every figure exactly") is the largest remaining block and no one
has checked which screens Cosmos actually uses.

## 4. Point of view

A breakdown → owner → two clocks → escalation → close → production sign-off loop for Indian plants,
phone-first, Gujarati-ready; then analytics that forecast and prove maintenance works. The spec's principle 1
says the loop ships first. The asset that makes this a business is **live use at Cosmos**: it produces the
import reconciliation, SLA targets, roster, escalation thresholds and the analytics history. Until cutover,
every feature is a guess. Order: (1) one coherent harness; (2) staging in Nimish's hand; (3) close M1 and cut
over; (4) M2 by switching on what is already built, then M3, M4.

## 5. Milestones and tickets

One ticket = one vertical slice = one GitHub issue = one slice plan = one PR.

### Phase H — Harness re-baseline (7 tickets, no product code)

| #   | Ticket                           | Goal (done means)                                                                                                                                                                             |
| --- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | One process: Athena v3           | Repo `CLAUDE.md`, `AGENTS.md`, `ORCHESTRATION.md` agree with `.claude/harness/CLAUDE.md`; DSH routing retired in `docs/decisions/` with the reason.                                           |
| H2  | Real stop hook                   | `fast-tests.sh` runs domain, shared and web unit tests in < 3 min (the DB tier needs Docker; it stays in CI).                                                                                 |
| H3  | Issues as the queue              | Every ticket here is a GitHub issue under a GitHub milestone; the current milestone's carry `ready-for-agent`; `backlog.md` corrected and marked superseded.                                  |
| H4  | As-built architecture + data map | `architect` writes `ARCHITECTURE.md` + `DATA-MAP.md` from the code; `architecture-reviewer` and `schema-reviewer` PASS; drift (§8) becomes issues or decisions. Nimish approves the data map. |
| H5  | Brief                            | `docs/BRIEF.md` from SPEC §1–3 plus Nimish's product-only answers.                                                                                                                            |
| H6  | Parity gap audit                 | Each of the 34 `in-progress` rows becomes `done` with evidence or gets a `gaps:` list; gap groups become M1 issues.                                                                           |
| H7  | Memory reset                     | `HANDOFF.md` < 50 lines and true; `STATUS.md` folded in; log line for #73/#74; `TAG-SYSTEM.md` matches the code; retro notes saying M0/M1 gates were not held.                                |

### M0 close — Staging live (6) · Gate: Nimish raises a ticket from his phone on staging

| #    | Ticket                      | Goal                                                                                                                                                                              |
| ---- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.7a | Accounts (N7, **Nimish**)   | Domain bought; OIDC role ARN in repo secrets.                                                                                                                                     |
| 0.7b | Working deploy              | Fix §8.1 (arm64 image, `packages: write`, compose uses `image:`, web build shipped, migrations run, no `secrets` in job `if`); merge to `main` deploys `cosmos.staging.<domain>`. |
| 0.7c | Rollback + migration safety | `deploy:rollback` proven from CI; a destructive migration fails the check.                                                                                                        |
| 0.7d | Restore drill + cost rail   | Restore executed and logged; billing alarm at ₹30,000.                                                                                                                            |
| 0.7e | Observability               | `/health` checks the DB; uptime ping; JSON logs with tenant and request id; error-tracker decision (India data).                                                                  |
| 0.8  | M0 gate                     | Phone → staging → raise → Open list; `docs/plan/gates/M0.md`.                                                                                                                     |

### M1 close — Parity complete and cutover (~31) · Gate: day-3 and day-7 go/no-go at Cosmos

| #       | Ticket                                                  | Goal                                                                                                                                     |
| ------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1.21    | People and logins admin                                 | Add/edit/disable people and logins (personal/shared, role, phone, shift, cell); revoke a person's devices.                               |
| 1.22    | Machines, groups, shifts, lists admin                   | Edit machines, segments, groups, shift windows, every option list; `/config` fingerprint changes.                                        |
| 1.23    | Translation screen                                      | Admin sees untranslated keys and enters Gujarati; prerequisite for N5.                                                                   |
| 1.13    | Follow-up tasks (`v3.actions.17`)                       | Task left at close; Tasks tab; pending/overdue/done boxes on the parent.                                                                 |
| 1.14    | Report only (`v3.actions.16`)                           | Expose `recordPastBreakdown`: PDF without a live ticket.                                                                                 |
| 1.15    | Floor finishing (`reporting.05`, `.10`)                 | Pending-task warning; `?m=VC-17` deep link.                                                                                              |
| 1.16    | Account sheet + update banner (`views.08`, `alerts.05`) | Version, "Update now"; no `skipWaiting` during shift change.                                                                             |
| 1.24    | Every label translatable                                | Action labels out of `actions.ts` into i18n; lint covers `.ts`.                                                                          |
| 1.25    | Login protection                                        | Per-route limits on login and `/brand`, `trustProxy` behind Caddy, failed-attempt counter, session tenant = host tenant.                 |
| 1.26    | Two installable apps                                    | Floor and desk manifests per route, both installable.                                                                                    |
| 1.27    | Audit trail                                             | Every settings, list, criticality, translation and tag change writes `audit_log`.                                                        |
| 1.28    | One rule, one place                                     | Role gates and per-person minutes only in `packages/domain`; ticket and day report show the same minutes.                                |
| 1.29    | Contracts and boundaries                                | Workspace dependencies instead of `../../../packages`; one shared DTO set; boundary lint in CI; ADR for raw SQL over Drizzle.            |
| 1.G1–G9 | Parity gap slices (est. 9, from H6)                     | Sign-in, reporting, start/update/pause, crew, cancel/restore/correct, Open/card/detail, board/My complaints, PDFs, alerts/share/refresh. |
| 1.10    | Real import (N1)                                        | Reconciliation on the real export: zero unexplained mismatches; fallback: labelled 30-day crawl.                                         |
| 1.11    | Gujarati (N5)                                           | Untranslated list empty for the floor.                                                                                                   |
| 1.17    | Real shifts (N11)                                       | Day report reads tenant shifts; no hard-coded windows.                                                                                   |
| 1.18    | Security sign-off                                       | ASVS L1 self-check, then human reviewer (N10).                                                                                           |
| 1.19    | Performance                                             | Open/Live < 2 s on a low-end Android over 3G; `/state` < 300 ms at 500 machines.                                                         |
| D0.3    | Usability sessions (N15)                                | 3–5 operators, 3 technicians on staging; findings filed.                                                                                 |
| D0.4    | Design QA                                               | Every floor/desk screen at 360 px, axe clean, reviewed against `DESIGN.md`.                                                              |
| 1.20    | Production                                              | Tag deploy in the 05:00–08:00 IST window; prod restore drill.                                                                            |
| 1.12    | Cutover                                                 | Runbook rehearsed on staging with a real export copy; go live; day 3 / day 7; revert plan ready.                                         |

### M2 — Accountability (13; 2.1 and 2.2 merged) · Gate: handback turnaround visible on live tickets

| #    | Ticket                              | Goal                                                                                    |
| ---- | ----------------------------------- | --------------------------------------------------------------------------------------- |
| 2.0  | Switch on severity + SLA at Cosmos  | Targets tuned with Bhavin on live data.                                                 |
| 2.3a | Ladder + roster schema and Settings | L1–L4 + vendor; duty roster per shift (architect + schema review).                      |
| 2.3b | Acknowledge                         | Command, API, desk button.                                                              |
| 2.3c | Escalation engine                   | Fake clock: missed ack → L2, missed restore → L3, critical still down → L4; repeat cap. |
| 2.3d | Notification service                | One adapter interface, push adapter, retries, dead letter, per-channel cap.             |
| 2.3e | Escalation history + rules UI       | Every escalation on the timeline; rules editable.                                       |
| 2.3f | Unpicked transfer escalates         | A transfer nobody picks up escalates by itself.                                         |
| 2.4a | Handback domain + API               | Dispute reopens the same ticket with a new segment for the last lead.                   |
| 2.4b | Handback UI                         | My complaints and board QR confirm/dispute.                                             |
| 2.4c | Timeout + turnaround                | Unanswered → `timed_out`; turnaround both ways.                                         |
| 2.5a | Failed-jobs page                    | Admin sees and retries failed jobs.                                                     |
| 2.5b | Timer-lag alarm                     | Fires in a test and in CloudWatch.                                                      |
| 2.5c | Device sessions                     | Per-device list and revoke.                                                             |

### M3 — WhatsApp and voice (~14) · Gate: an operator raises a ticket by voice; accuracy recorded

Webhook + signature; phone→person routing + consent (schema v3); outbound queue, en/gu templates, 24-hour
window, cost log and cap; WhatsApp adapter for escalation and handback; report by WhatsApp text; voice
download, storage, 90-day retention; Sarvam adapter + daily cap; confirm-back with glossary; accuracy on
consented notes (N6); QR per machine; PDFs and day reports on WhatsApp; SES email to the plant head; DPDP
consent and deletion (N14). **Start Meta business verification now**: weeks of lead time.

### M4a — Analytics parity (~20) · Gate: every answer-key number matches

A0 triage with Bhavin: which platform screens Cosmos uses (drops recorded in `DIFFERENCES.md`); history load
of 1,158 breakdowns with aliases (N12); answer-key script (N2); engine by calculation family (registers/KPIs;
A1–A3; A6/A9/A10; health/compare/bad actors; cost; forecasting; Action Center; monthly/annual reports);
analytics screens (Today, Machines, Breakdowns, Forecast, Action Center, Cost, Reports); drill-down; Excel
import/export; data checklist.

### M4b — The loop (~11) · Gate: first scorecard from live data

PM plans by time and meter, checklists, calendar, load spreading, compliance (N3); failure-code taxonomy at
close (reconcile with `maint_code` tags); shift-calendar KPIs (N11); monthly forecast freeze; scorecard;
inspection tickets from Hot machines; intervention ledger.

### M5 Plant two (~18) and M6 AI layer (~9) — sized at the M4 gate

M5: AI-mapped importer, CNC pack, settings cascade + multi-plant (architect), onboarding wizard, Hindi,
approvals, vendor sharing, scheduling board, warranty/AMC, skills, handover log, penetration test.
M6: evaluation harness first; failure-code suggestion, fix finder, plain-language analytics, daily briefing,
duplicate detection — each in shadow mode until it clears its threshold.

### Totals

| Block              |  Tickets | Confidence                           |
| ------------------ | -------: | ------------------------------------ |
| H re-baseline      |        7 | firm                                 |
| M0 close           |        6 | firm                                 |
| M1 close + cutover |      ~31 | firm on 22; est. on the 9 gap slices |
| M2 remainder       |       13 | firm                                 |
| M3                 |      ~14 | est.                                 |
| M4a                |      ~20 | est.; triage may cut it              |
| M4b                |      ~11 | est.                                 |
| **Through M4b**    | **~102** |                                      |
| M5 + M6            |      ~27 | rough                                |
| **Whole spec**     | **~129** |                                      |

**To cutover: 44 tickets** (7 process, 6 staging, 31 M1), of which ~8 wait on outside inputs.

## 6. How each ticket runs under Athena v3

1. Issue labelled `ready-for-agent` (`to-tickets`; one milestone ahead only).
2. `slice-planner` writes `docs/slices/<issue>.md` (every file, interface, field, Given/When/Then);
   `plan-reviewer` PASS in a fresh context. A silent plan stops the builder.
3. Schema touched → `architect` + `schema-reviewer`; data-altering migration needs PASS + a backup step.
4. Build with `tdd` + `subagent-driven-development`; failing tests first; no test weakened.
5. `code-reviewer` PASS + green CI → the agent merges.
6. Merge deploys staging → Nimish tests user-visible slices on his phone.
7. Parity row, `wiki/log.md`, `HANDOFF.md` updated in the same PR.
8. Gate report `docs/plan/gates/M<n>.md`: criteria → tickets → tests → evidence; Nimish says go or no-go.

## 7. What only Nimish can do (ordered by lead time)

| Need                                                       | Why now                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------- |
| N1 Bhavin's export + Worker source                         | Longest pole to cutover; importer unproven on real data |
| N7 domain + OIDC role                                      | Blocks staging, i.e. everything you can test            |
| N8 Meta business verification + number                     | Weeks of lead time; blocks the M3 gate                  |
| N13 product name                                           | Three names in use                                      |
| N11 shifts, N12 code aliases                               | Small answers; block day report and history load        |
| N10 security reviewer, N15 usability sessions, N5 Gujarati | Needed before cutover                                   |
| N14 data use and consent                                   | Blocks real data on staging and all of M3               |
| M2-2.3 five product questions                              | **Defer until two weeks after cutover**                 |

## 8. Code findings (verified unless marked)

1. **Deploy cannot run** (`.github/workflows/deploy.yml`): `secrets` in a job-level `if`; no `packages: write`;
   amd64 image for an arm64 `t4g` AMI; compose uses `build:` not `image:`; web build not shipped; no
   migration step; `ref` input unused.
2. **Login effectively unlimited**: one global 1000/min limit (`apps/server/src/app.ts:33`), no per-route
   limit, no `trustProxy` behind Caddy, so every client shares Caddy's IP bucket.
3. **Cosmos shift windows hard-coded** in `apps/server/src/day-report.ts:10-14` (spec principle 3).
4. **Rules outside the domain**: settings/needs-report/day-report role checks in the server; per-person
   minutes computed twice (domain floors per segment, day-report SQL rounds), so numbers can disagree;
   web rebuilds the action model and role gates.
5. **English action labels** in `apps/web/src/components/actions.ts`; the i18n lint covers only `.tsx`.
6. **No module boundaries**: flat `registerX` files reaching into each other's SQL; web imports
   `../../../packages/shared/src`; undeclared workspace dependencies; no boundary lint.
7. **Drizzle silently dropped** for raw `pg`; ADR 0001, SPEC, `THIRD_PARTY.md` still say Drizzle.
8. **Types defined three times** (shared, domain, web `api-types.ts`); server returns untyped records.
9. **Audit log** written only for SLA policy changes and import undo.
10. **E2E shares one database across two parallel projects** with `retries: 2`; a spec that edits the
    tenant-wide severity matrix is not serial (flakiness risk inferred, not observed: 42/42 passed here).
11. **Seen in CI on PR #75:** SLA due times render in the browser time zone until `/config` loads
    (`SlaTimerSummary.tsx:89` passes `config?.timeZone`), then jump to plant time; and
    `sla-timers.spec.ts:23` raises on a fixed machine without cancelling, so serial retries 409. Fix slice
    goes first in M1 close (test-first: no plant time shown until the tenant zone is known).
12. Low: `/health` never checks the DB; `sendPush` is dead; `/api/v1/files/:id` URLs are returned but no
    route serves them; three files at 384–399 lines held under the cap partly by re-export shims.
