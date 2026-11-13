# Milestones and tickets — Uptimo

Made with the `to-tickets` skill (Matt Pocock): tracer-bullet vertical slices, each a complete path through
schema, API, UI and tests, demoable on its own, sized to one fresh context window, with its blocking edges.
Prefactoring comes first ("make the change easy, then make the easy change"). Status: **draft for Nimish's
approval (to-tickets step 4)**; published to GitHub Issues with `ready-for-agent` only after approval.
Binding inputs: `docs/BRIEF.md`, `docs/ARCHITECTURE.md`, `docs/DATA-MAP.md`, `docs/decisions/D01–D17`
(41-table budget), real data in `docs/discovery/real-2026-11-13/`. The 176-ticket first draft is in git
history (`9b1c3b2`) for its traceability matrix.

## Testing seams (to-spec step 2: fewest, highest)

| Seam                                                                                                                  | What is tested there                                                                                       | Prior art            |
| --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------- |
| **1. The HTTP API** (`/api/v1`) against real Postgres loaded with Cosmos's real data (names and phones swapped in CI) | Every backend behaviour: commands, figures, permissions, tenancy, timers (fake clock), escalation, imports | `apps/server/test/*` |
| **2. The browser** — one Playwright journey per slice on the same data                                                | What a person sees and does, at 360 px, axe clean                                                          | `apps/web/e2e/*`     |
| **3. The engine call** `run(data, asOf) → figures`                                                                    | Every analytics number equals Bhavin's answer key                                                          | new in M4a           |

CI on every PR: lint, typecheck, seam 1 for the touched module plus tenant isolation, one browser smoke.
The slice's full browser journey runs on staging before Nimish previews it.

## Milestones

| #   | Milestone                 | Goal                                                                   | Gate (Nimish checks)                                                                           |                Tickets |
| --- | ------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------: |
| M0  | Foundation                | Green fast CI, real Cosmos data in, one design kit, staging live       | Opens staging on his phone, sees Cosmos's real tickets, approves the `/gallery` and the accent |                      8 |
| M1  | Cutover                   | Cosmos raises and works every ticket on Uptimo; Bhavin's app read-only | Day-3 and day-7 go/no-go                                                                       |                     13 |
| M2  | Accountability            | Two clocks, escalation ladder and roster, production sign-off          | Sign-off turnaround visible on live tickets                                                    |                      5 |
| M4a | Analytics parity          | Every platform figure Cosmos uses, exact, drillable                    | Ten figures spot-checked against Bhavin's platform                                             |                      7 |
| M4b | The loop                  | PM, registers, coded closes, frozen forecasts, scorecard, ranking      | First monthly scorecard from live data                                                         |                      5 |
| M6  | AI (India only)           | Suggestions a person confirms, each above its threshold                | Agrees capabilities; sees shadow results                                                       |                      5 |
| M3  | WhatsApp and voice (last) | Report and be chased on WhatsApp, by text or voice                     | An operator raises a ticket by voice                                                           |                      4 |
|     | **Total**                 |                                                                        |                                                                                                | **47** (21 to cutover) |

## M0 — Foundation

**01 Green, fast main** · Blocked by: none
Delivers: every PR gets a quick, honest answer and `main` is green.

1. The SLA timer shows no due time until the plant's time zone is known; the SLA browser test passes on retry.
2. CI runs only lint, typecheck, the API tests of touched modules, tenant isolation and one browser smoke, in under 8 minutes.
3. One process in every instruction file (Athena: define → code → test → build); `HANDOFF.md` true.

**02 Real tickets in** · Blocked by: 01
Delivers: Uptimo holds Cosmos's 275 real tickets with Bhavin's exact numbers.

1. The importer reads Bhavin's real `/api/export` (his field names, report keys, `segment`, `lead`, `task` events).
2. Every imported ticket's response, repair, waiting, vendor and downtime minutes equal Bhavin's, or the difference is explained by an edit.
3. Import and undo run on the real file; CI uses the same file with names and phones swapped.

**03 Real plant in** · Blocked by: 01
Delivers: machines, people and settings are Cosmos's real ones, not seed guesses.

1. Machines come from the 11 November registers (CNC, conventional, process, DG, utilities), with segments and cells.
2. The 26 real logins and their people exist with roles; shift windows are 08:00–18:30 and 18:29–05:00.
3. Seed counts match the sources; differences are listed, not silently fixed.

**04 History cannot be lost** · Blocked by: 01
Delivers: no action in the app can erase or rewrite a ticket's history. (Prefactor, expand–contract.)

1. Work stretches are updated in place, never deleted and re-inserted; list entries and logins are switched off, never deleted.
2. The cutover migration removes delete and edit rights on history, makes one open breakdown per machine a database rule, and adds the known indexes.
3. The migration check catches any destructive statement anywhere in a line.

**05 One design kit** · Blocked by: 01
Delivers: every future screen is built from one installed kit (Apple principles, `docs/DESIGN.md`).

1. The component kit, tokens, icons, layout pieces and one status vocabulary (colour + label + icon) are installed; screens cannot hand-style (checked in CI).
2. `/gallery` shows every component and status at 360 px in English and Gujarati, axe clean.
3. Nimish picks the accent colour on the gallery.

**06 Page patterns** · Blocked by: 05
Delivers: a new screen is mostly configuration.

1. List, detail, form, step-by-step, settings-table, dashboard and board patterns exist, each shown in the gallery.
2. A settings screen is one short description generated into a working screen with its API.
3. All data fetching goes through one resource layer with offline and sync states.

**07 Staging live** · Blocked by: 02, 03 · External: domain and AWS role (N7)
Delivers: every merge is on staging with Cosmos's real data, and Nimish can try it on his phone.

1. A merge to `main` deploys staging; a rollback runs from CI.
2. Staging is loaded with the real tickets and plant; `/health` checks the database and queue.
3. Secrets live in the secret store; logs carry tenant and request ids and no personal data.

**08 Safe to run** · Blocked by: 07
Delivers: data can be restored and problems are seen early.

1. Backups run and a restore drill is executed and logged.
2. A billing alarm and an error alarm exist.
3. Old sessions and replay keys are cleaned up on schedule.

## M1 — Cutover

**09 Report a breakdown (floor)** · Blocked by: 02, 03, 06

1. An operator reports a stopped machine in three taps, by search or group, with quick problems; a second report of an open machine shows the existing ticket.
2. Other work requests, the sent screen with the ticket number, My complaints and cancel-own work as in v3; `?m=` opens a machine; a machine with a pending task warns.
3. The floor is fully usable in Gujarati.

**10 Desk lists and ticket detail** · Blocked by: 02, 06

1. Open (counts strip, breakdowns, tasks, work), Mine, Team and needs-report show the real tickets exactly as v3 groups them.
2. The ticket card and detail show the facts, full history, people and minutes, and only the actions allowed in that state.

**11 Work the ticket** · Blocked by: 10

1. Start (back-dated), update, pause with reasons, resume, join, leave, transfer, pick up, running and stopped behave as v3, checked against `worker.js` on real tickets.
2. Per-person minutes on the ticket and on the day report are the same number.

**12 Close, report, PDFs** · Blocked by: 11

1. Close with report, without report, done and late report work; report-only creates a record without a ticket.
2. The breakdown PDF (QR identical to v3) and the day report on the real shifts render, Gujarati included.

**13 Follow-up tasks** · Blocked by: 12

1. A job left unfinished at close becomes a child task with reason and expected date, on the Tasks tab.
2. The parent shows pending, overdue and done boxes; machine-stopped minutes are asked when a task is done.

**14 Admin fixes** · Blocked by: 11

1. Cancel, restore within 7 days, and correct (including machine and kind) work with reasons and old and new values.
2. Every configuration and correction change appears in the audit trail screen.

**15 People and logins** · Blocked by: 06, 03

1. The admin adds, edits and switches off people (with mobile numbers) and logins (personal or shared, role, cell).
2. Shared phones ask who is acting; every action records the acting person; a person can see and sign out their devices.

**16 Plant settings** · Blocked by: 06, 03

1. Machines, segments and groups, shifts, every list (wait reasons and their flags, work types, quick problems) and the glossary are edited on generated settings screens.
2. Company name, logo, language, time zone and feature switches are settings; the old hand-built settings screens are gone.

**17 Gujarati** · Blocked by: 16 · External: Gujarati strings (N5)

1. The admin sees untranslated keys and enters Gujarati on a translation screen.
2. The floor's untranslated list is empty; Cosmos's wording is Uptimo's default Gujarati.

**18 Live board and alerts** · Blocked by: 10

1. The TV board matches the Open list; push (new breakdown, complaint fixed), WhatsApp share text and 30-second refresh behave as v3.
2. The account sheet and update banner work; floor and desk install as two separate apps.

**19 Hardened** · Blocked by: 07 · External: security reviewer (N10)

1. Login and `/brand` are rate-limited per client; a session cannot cross tenants; stored PDFs and logos are served.
2. Open and Live render in under 2 seconds on a cheap Android over 3G.
3. A human security review signs off.

**20 Usability round** · Blocked by: 09, 11, 12 · External: sessions (N15)

1. 3–5 operators and 3 technicians try the floor and desk on staging; time and errors recorded.
2. What they stumble on is fixed.

**21 Cutover** · Blocked by: 09–20

1. Production runs, deploys only in the 05:00–08:00 window, and has a restore drill.
2. The cutover-morning import and its undo are rehearsed on staging, then run; Bhavin's app goes read-only.
3. Day-3 and day-7 checks are recorded; the revert plan is ready.

## M2 — Accountability

**22 Clocks live** · Blocked by: 21

1. Severity and SLA targets are switched on at Cosmos; acknowledge and restore clocks show on cards, detail and board.
2. Long pauses and unanswered sign-offs have their own clocks. (M2 schema migration: roster, escalation rule, notification.)

**23 Roster, ladder, acknowledge** · Blocked by: 22

1. The head sets the duty roster per shift and the ladder L1–L4 and vendor.
2. The right person acknowledges a ticket and its acknowledge clock stops.

**24 Escalation** · Blocked by: 23

1. Missed acknowledge notifies L2, missed restore L3, a critical machine still down L4, repeating up to the cap, by push through one notification service that retries.
2. Every escalation shows on the ticket's history; a transferred ticket nobody picks up escalates.

**25 Production sign-off** · Blocked by: 22

1. The reporter (or anyone in the cell) confirms or disputes the fix from My complaints or the board QR; a dispute reopens the same ticket for the last lead.
2. An unanswered sign-off times out; turnaround is measured both ways.

**26 Run it safely** · Blocked by: 24

1. The admin sees and retries failed jobs; late timers raise an alarm.
2. Support access to Cosmos data needs an approved, expiring grant, visible in the audit trail.

## M4a — Analytics parity

**27 Answer key and history** · Blocked by: 21 · External: triage with Bhavin, code aliases (N12)

1. Bhavin's 11 November platform and workbook are captured as answer-key fixtures, only for the screens Cosmos uses.
2. The 1,354-row breakdown log is loaded as closed tickets, counted once alongside the live tickets.

**28 Dashboard and machines** · Blocked by: 27

1. The engine computes dashboard KPIs, registers, fleet age and footprint, and the data checklist, matching the answer key.
2. The dashboard and one page per machine show them; every figure drills to its rows.

**29 Breakdown analyses** · Blocked by: 28

1. Breakdown log, A1 BD % and PM split, A2 category and cell, A3 MTTR and MTBF match exactly.
2. Their screens drill to rows.

**30 Manpower, energy, root cause** · Blocked by: 28

1. A4 manpower, A5 energy heatmap, A6 Why-Why and A10 problem analysis match and are on screen with sortable tables.

**31 Forecast** · Blocked by: 29

1. Planning forecast (pooled rate, seeded Monte Carlo), risk bands, bottleneck scoring, trend test and repeat faults match.
2. The Forecast Lab backtest matches and is on screen.

**32 Compare, team, money, Fix Finder** · Blocked by: 29

1. Health score comparison, Team Focus, Money Matters and Fix Finder ranking match and are on screen.

**33 Action Center, reports, export** · Blocked by: 31, 32

1. The 13 nudge rules fire as the platform's; monthly and annual reports and their PDFs match.
2. The whole data set exports as the platform's workbook; the Guide explains every figure.

## M4b — The loop

**34 Coded closes and real KPIs** · Blocked by: 33

1. Every closed breakdown is coded from one code list (Bhavin's old codes mapped); codes are required at close.
2. Shift-calendar MTBF, MTTR and availability, Pareto, heatmaps, backlog and schedule compliance sit beside the legacy figures.

**35 PM on Uptimo** · Blocked by: 33

1. PM plans and checklists come in from the workbook (PM Plan, PM Reports); PM jobs are tickets done on the phone.
2. The PM calendar spreads load; PM compliance is measured.

**36 Registers** · Blocked by: 35

1. AMC, warranty and legal tests/calibrations live in one register with due alerts.

**37 Forecast freeze and scorecard** · Blocked by: 34

1. The forecast freezes on the 1st and is scored after the month; Hot machines raise inspection tickets; an accepted nudge becomes a ticket.
2. The plant head gets one monthly scorecard.

**38 Interventions and ranking** · Blocked by: 37 · External: ranking method (Nimish)

1. Every PM change is judged against similar machines in the intervention ledger.
2. Technicians are ranked by the agreed method.

## M6 — AI (India only)

**39 AI foundation** · Blocked by: 33 · External: capability alignment with Nimish

1. Nimish and the agents agree the capabilities; an India-region provider sits behind one adapter.
2. The evaluation harness measures every feature on real tickets; a suggestion changes nothing until a person confirms.

**40 Find past jobs** · Blocked by: 39

1. Search by words (transliterated Gujarati included) finds past jobs; duplicate reports are caught.
2. Fix finder shows similar jobs, what fixed them and how often it held.

**41 Code suggestion** · Blocked by: 39, 34

1. A failure code is suggested from the words; it goes live only above its threshold.

**42 Ask and brief** · Blocked by: 39

1. Managers ask questions and see the answer, its view and its SQL; numbers come from code.
2. Each role gets a daily briefing.

**43 Manuals** · Blocked by: 39, 35

1. A plant's manuals are searchable by page, for that plant only; PM plan drafts cite their pages.

## M3 — WhatsApp and voice (last)

**44 WhatsApp channel** · Blocked by: 24 · External: Meta verification, number, templates (N8)

1. Signed webhooks; messages tied to a consenting person by phone; templates within the 24-hour rules and a monthly cost cap.
2. Escalations, assignments and sign-off requests go out and are answered on WhatsApp.

**45 Report by WhatsApp** · Blocked by: 44

1. An operator reports by chat or by scanning the machine's QR; PDFs and day reports arrive on WhatsApp.

**46 Voice** · Blocked by: 45 · External: voice notes (N6)

1. A voice note is transcribed in India, read back and confirmed; corrections improve the glossary; accuracy is recorded.

**47 Email and deletion** · Blocked by: 44

1. The plant head gets escalations and reports by email; a person's messages and voice can be deleted.

## What can run at the same time

| Window         | Parallel tickets                                                           |
| -------------- | -------------------------------------------------------------------------- |
| Start          | 02, 03, 04, 05 (after 01)                                                  |
| Before staging | 06, then 07                                                                |
| M1             | 09, 10, 15, 16 together; then 11 → 12 → 13 with 14, 17, 18, 19 beside them |
| M2             | 24 and 25 together                                                         |
| M4a            | 29 and 30, then 31 and 32                                                  |
| M4b / M6       | 34, 35 and 39 together                                                     |

Database changes run one milestone migration at a time; one browser-test stack; Nimish previews every user-visible slice.
