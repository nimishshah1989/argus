# Backlog

Generated from `docs/spec/SPEC.md` §11 on 10 November 2026, plus the design track from `docs/FRONTEND-STRATEGY.md`. One ticket per row. `verification` is `auto` (a test or script proves it), `gate-manual` (Nimish checks it on staging) or `external` (an input from outside, tracked in `NEEDS.md`).

Status: `todo`, `in-progress`, `done`, `blocked-external`, `waived`. A ticket is ready when its dependencies are done and its external inputs are present.

| Milestone                            | Tickets | Done | In progress |
| ------------------------------------ | ------- | ---- | ----------- |
| M0 Foundation and walking skeleton   | 8       | 6    | 0           |
| M1a Ticket core                      | 5       | 0    | 0           |
| M1b Parity complete and soft cutover | 7       | 0    | 0           |
| M2 Accountability                    | 5       | 0    | 0           |
| M3 WhatsApp and voice                | 3       | 0    | 0           |
| M4a Analytics parity                 | 3       | 0    | 0           |
| M4b The loop                         | 3       | 0    | 0           |
| Design (enabling)                    | 4       | 0    | 0           |

**Frontier now:** `M0-0.8` (walking skeleton, runs locally). `M0-0.1`–`M0-0.6` are done. `M0-0.7` infrastructure is authored but `blocked-external` on the AWS account/domain/secrets (N7). The Settings UI lands with the web scaffold in M0-0.8.

## M0 Foundation and walking skeleton

### M0-0.1 — Monorepo scaffold: the layout in section 10, lint with the no-literal-strings rule, Vitest, Playwright, Testcontainers, CI running lint, typecheck, test, build, licence check

- **Verification:** auto
- **Depends on:** —
- **Status:** done
- **Acceptance:** auto: `pnpm test` green on the empty repo; CI runs on every pull request

### M0-0.2 — `docs/adr/0001-stack.md`, `docs/adr/0002-outside-services.md`, `CLAUDE.md`, `docs/plan/backlog.md`, `docs/plan/STATUS.md`, `docs/plan/NEEDS.md`, `docs/spec/parity.yaml` generated from PARITY.md

- **Verification:** auto + gate-manual
- **Depends on:** 0.1
- **Status:** done
- **Acceptance:** auto: parity.yaml validates and its row count equals the checklist's rows; gate-manual: Nimish reads the two decision records

### M0-0.3 — Schema v1 migrations with RLS: tenant, person, login, session (our tables), machine, segment, machine\_group, machine\_move, list\_item, shift, setting, glossary\_term, ticket, ticket\_event, crew\_member, work\_segment, breakdown\_report, file, push\_subscription, audit\_log, import\_batch, ref\_counter; `app_router` role and its functions

- **Verification:** auto
- **Depends on:** 0.1
- **Status:** done
- **Acceptance:** auto: generic isolation test passes for every table; dev assertion fires on a query without tenant

### M0-0.4 — Auth: tenant from host, login, logout, me, change password, 30-day sliding bearer sessions, shared logins with acting person; `/brand` by host

- **Verification:** auto
- **Depends on:** 0.3
- **Status:** done
- **Acceptance:** auto: contract tests; end-to-end sign-in on two tenants on staging

### M0-0.5 — Settings API and the first Settings screens: lists with flags, people and logins, machines, shifts, features; translation screen with the untranslated list

- **Verification:** auto
- **Depends on:** 0.3
- **Status:** done
- **Acceptance:** auto: a list edited in Settings is returned by `/config` with a new fingerprint

### M0-0.6 — Cosmos seed from `docs/discovery/source/cosmos-platform-export-2026-10-28.json` (191 machines with nameplate fields, team, lists, settings), `docs/discovery/bhavin-v3/live-config-2026-11-09.json` (192 ids, segments, cells, shift windows, team shifts) and `glossary-2026-11-09.json`; live ids win, attributes from the export, VC-57 left blank, every conflict in a seed report

- **Verification:** auto
- **Depends on:** 0.3
- **Status:** done
- **Acceptance:** auto: counts match the sources (192 machines by segment, 14 people, 19 codes); seed report committed

### M0-0.7 — Infrastructure: Terraform for RDS, S3 with versioning, IAM, Secrets Manager, EC2; Docker Compose with Caddy and the server; `deploy:staging`, `deploy:production`, `deploy:rollback`; expand-and-contract migration check in CI; restore drill executed and logged; billing alarm; `.env.example`

- **Verification:** auto + external
- **Depends on:** 0.1
- **Status:** blocked-external
- **Acceptance:** auto: deploy and rollback run from CI against staging; migration check fails a destructive migration. external: AWS account, domain, GitHub secrets from Nimish

### M0-0.8 — Walking skeleton: floor screen raises a stopped ticket on one machine; desk Open list shows it; both deployed on staging under `cosmos.staging.<domain>`

- **Verification:** gate-manual
- **Depends on:** 0.4, 0.5, 0.6, 0.7
- **Status:** todo
- **Acceptance:** gate-manual: Nimish raises a ticket from his phone and sees it on the Open list

## M1a Ticket core

### M1a-1.1 — `packages/domain`: state machine with every command in the Domain tab, figures from events and segments with overrides, permissions

- **Verification:** auto
- **Depends on:** 0.3
- **Status:** todo
- **Acceptance:** auto: a test per transition and per figure definition; property test that cached figures equal recomputed ones; the v3 rules in INVENTORY.md sections 3 and 14 each have a named test

### M1a-1.2 — Tickets API: every command with idempotency keys and row locks; state, ticket detail, lists with cursor pagination; day-report data

- **Verification:** auto
- **Depends on:** 1.1
- **Status:** todo
- **Acceptance:** auto: contract tests; concurrency test (two starts) and replay test

### M1a-1.3 — Floor face: machine search and groups, situation, problem with quick chips, work request, sent screen, My complaints, cancel own un-started, pending production persons

- **Verification:** auto
- **Depends on:** 1.2
- **Status:** todo
- **Acceptance:** auto: Playwright raise, see ticket number, cancel

### M1a-1.4 — Desk face: Open (three lists, counts strip, team now), ticket card with state-dependent actions, ticket detail with timeline and people, Mine, Team, account sheet

- **Verification:** auto
- **Depends on:** 1.2
- **Status:** todo
- **Acceptance:** auto: Playwright drives one ticket through start, update, pause, resume, join, leave, transfer, pick up, running again, stopped again, close with report

### M1a-1.5 — Follow-up tasks: leave at close, Tasks list, follow-up boxes, machine-stopped minutes on done; cancel, restore, correct (including machine and kind)

- **Verification:** auto
- **Depends on:** 1.2
- **Status:** todo
- **Acceptance:** auto: tests for pending, overdue, done; correction writes old and new values

## M1b Parity complete and soft cutover

### M1b-1.6 — Report form and breakdown PDF (QR payload identical to ref.js v1), day report PDF with shift-length windows, server-rendered and stored in S3

- **Verification:** auto
- **Depends on:** 1.2
- **Status:** todo
- **Acceptance:** auto: PDF text extraction checks fields; a rendered-page image test proves Gujarati glyphs with the bundled fonts

### M1b-1.7 — Live board and kiosk route

- **Verification:** auto
- **Depends on:** 1.2
- **Status:** todo
- **Acceptance:** auto: tiles and counts match a fixture's Open lists

### M1b-1.8 — Web push with the acting-person re-subscribe rule; WhatsApp share text (short and full)

- **Verification:** auto + gate-manual
- **Depends on:** 1.2
- **Status:** todo
- **Acceptance:** auto: push payload contract test. gate-manual: a push received on Android and on an installed iOS PWA

### M1b-1.9 — PWA: two manifests, service worker, cached state and config, offline outbox with idempotency keys and 409 drafts, update banner

- **Verification:** auto
- **Depends on:** 1.2, 1.3, 1.4
- **Status:** todo
- **Acceptance:** auto: Playwright offline test closes a ticket offline and replays it; a replay onto a closed ticket produces a draft

### M1b-1.10 — Import of Bhavin's live tickets: the export format is defined in `docs/spec/import/bhavin-export.schema.json` (one JSON object per ticket with events, crew, reports); alias file for free-text names; figures recomputed and compared with his stored values, overrides created where admin edits explain a difference; reference counters set to the imported maximum; `import:undo`

- **Verification:** auto + external
- **Depends on:** 1.5
- **Status:** todo
- **Acceptance:** auto: reconciliation report with zero unexplained mismatches on his export. external: the export and the Worker source. Fallback if the export is late: an admin-login crawl of `/api/state`, `/api/ticket` and `/api/mywork?team=1` for the last 30 days, clearly labelled

### M1b-1.11 — Gujarati strings for the floor and desk from Cosmos's team via the translation screen

- **Verification:** auto + external
- **Depends on:** 1.3, 1.4
- **Status:** todo
- **Acceptance:** external: translations entered; auto: untranslated list empty for the floor face

### M1b-1.12 — Cutover runbook: import, his app read-only, ours live, day-3 and day-7 checks, revert plan (re-enable his app, export the week's tickets as CSV)

- **Verification:** gate-manual
- **Depends on:** 1.6–1.11
- **Status:** todo
- **Acceptance:** gate-manual: Nimish and Bhavin run the runbook; go or no-go recorded in the gate report

## M2 Accountability

### M2-2.1 — Machine criticality and the severity matrix in Settings; severity on every ticket

- **Verification:** auto
- **Depends on:** 1.5
- **Status:** todo
- **Acceptance:** auto: matrix tests

### M2-2.2 — SLA policies; timers as delayed jobs re-armed on every transition; which wait reasons pause the clock (list flag); restore timer stops at machine running; business hours optional

- **Verification:** auto
- **Depends on:** 2.1
- **Status:** todo
- **Acceptance:** auto: fake-clock tests for every timer path

### M2-2.3 — Escalation rules, ladder L1 to L4 and vendor, roster, escalation events, acknowledge; push notifications

- **Verification:** auto
- **Depends on:** 2.2
- **Status:** todo
- **Acceptance:** auto: missed acknowledge notifies L2, missed restore L3, critical still down L4; repeat caps enforced

### M2-2.4 — Production handback from My complaints and the board QR: confirm or dispute; dispute reopens the same ticket; timeout rule; turnaround figures

- **Verification:** auto
- **Depends on:** 2.3
- **Status:** todo
- **Acceptance:** auto: dispute returns the ticket to working with a new segment for the last lead

### M2-2.5 — Failed-jobs page, timer-lag alarm, per-device session revoke

- **Verification:** auto
- **Depends on:** 2.3
- **Status:** todo
- **Acceptance:** auto: alarm fires in a test

## M3 WhatsApp and voice

### M3-3.1 — Meta Cloud API: webhook verification and signature check, inbound routing by phone, consent message, templates (English and Gujarati) for every message sent outside the 24-hour window, outbound queue with per-message cost logged and a monthly cap

- **Verification:** auto + external
- **Depends on:** 1.2
- **Status:** todo
- **Acceptance:** auto: contract tests on recorded webhook payloads; cap test. external: verification, number, template approvals (started in M1)

### M3-3.2 — Voice notes: download, Sarvam transcription behind the provider interface, text shown back, confirm, glossary applied; daily minutes cap

- **Verification:** auto + external
- **Depends on:** 3.1
- **Status:** todo
- **Acceptance:** auto: provider mocked; external: accuracy measured on the consented notes and recorded

### M3-3.3 — QR per machine; PDFs and day reports delivered on WhatsApp; SES email for plant-head escalation

- **Verification:** auto
- **Depends on:** 3.1, 1.6
- **Status:** todo
- **Acceptance:** auto: delivery job tests

## M4a Analytics parity

### M4a-4.1 — Answer key: a Playwright script opens the platform HTML from disk, loads the data set (the embedded seed first, Bhavin's Excel export when it arrives) through the page's own import, fixes the clock at one as-of date, visits every screen and extracts the figures named in the prototype inventory into `fixtures/answer-key/<screen>.json`

- **Verification:** auto
- **Depends on:** 1.12
- **Status:** todo
- **Acceptance:** auto: fixtures committed and reproducible

### M4a-4.2 — `packages/engine` with a legacy profile (the Cosmos constants as a fixture, not product code) reproducing every calculation in the Guide

- **Verification:** auto
- **Depends on:** 4.1
- **Status:** todo
- **Acceptance:** auto: every fixture number matches exactly

### M4a-4.3 — Analytics face

- **Verification:** auto
- **Depends on:** 4.2
- **Status:** todo
- **Acceptance:** auto: each screen's figures come from the engine's result tables and match the fixtures

## M4b The loop

### M4b-4.4 — PM calendar, checklists, load spreading, PM compliance

- **Verification:** auto + external
- **Depends on:** 4.3
- **Status:** todo
- **Acceptance:** external: the PM tool from Bhavin; auto: parity rows green

### M4b-4.5 — Failure-code taxonomy and coding at close; shift-calendar KPIs beside the legacy ones

- **Verification:** auto
- **Depends on:** 4.3
- **Status:** todo
- **Acceptance:** auto: codes required on close; KPI definitions tested

### M4b-4.6 — Frozen monthly forecasts, scorecard, inspection tickets from Hot machines, intervention ledger

- **Verification:** auto + gate-manual
- **Depends on:** 4.5
- **Status:** todo
- **Acceptance:** auto: fake-clock tests; gate-manual: first scorecard from live data

## Design track (enabling)

### D0.1 — Design audit and role journeys

- **Verification:** auto + gate-manual
- **Depends on:** 0.1
- **Status:** todo
- **Acceptance:** Audit Bhavin v3 and the inventories; one journey per role; the five management numbers. Artifact: docs/design/ROLE-JOURNEYS.md.

### D0.2 — Design tokens and component library v0

- **Verification:** auto
- **Depends on:** D0.1
- **Status:** todo
- **Acceptance:** Tokens (colour, type, space, radius, motion); components (button, input, card, status pill, sheet, list row, timeline, KPI tile); Storybook/Ladle and visual regression.

### D0.3 — Clickable floor and desk prototypes; usability tests

- **Verification:** auto + gate-manual
- **Depends on:** D0.2
- **Status:** todo
- **Acceptance:** A React prototype tried on a phone; 3–5 operators and 3 technicians; time/error/confidence recorded.

### D0.4 — Design QA gate for floor and desk

- **Verification:** auto + gate-manual
- **Depends on:** 1.3, 1.4, D0.3
- **Status:** todo
- **Acceptance:** Every parity screen and state reviewed at 360 px; axe clean; performance measured on a low-end phone; differences logged.

## Definition of done (every ticket)

Tests pass (unit, isolation, end-to-end where a screen changed); no new table without `tenant_id` and RLS (the generic isolation test covers it); strings in i18n; changelog line; `parity.yaml` updated; reviewer PASS and green CI; merged; on staging.
