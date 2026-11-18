# Milestones and tickets — Uptimo

**This is the development goal post and the core tracking document.** Scope, order, every ticket's goals and blockers, and live status all live here. It is the one plan we follow; `CLAUDE.md` says how it is worked.

Made with the `to-tickets` skill (Matt Pocock): tracer-bullet vertical slices, each a complete path through
schema, API, UI and tests, demoable on its own, sized to one fresh context window, with its blocking edges.
Prefactoring comes first ("make the change easy, then make the easy change"); the one wide refactor (module
boundaries) runs expand → contract. Status: **the plan we follow (Nimish, 13 Nov 2026)**; GitHub Issues mirror it, with `ready-for-agent` on the
current milestone's tickets. Binding inputs: `docs/BRIEF.md`, `docs/ARCHITECTURE.md`,
`docs/DATA-MAP.md`, `docs/decisions/D01–D17` (table budget), `docs/spec/parity.yaml`, SPEC §3/§9, real data in
`docs/discovery/real-2026-11-13/`. The coverage map is at the end; the
47-ticket draft is in git history (`a9dfe3c`), the 176-ticket draft at `9b1c3b2`.

## Progress tracker

Updated by the orchestrator at every merge (status: `todo` → `in progress` → `done`; `parked` = not in the current build). GitHub Issues mirror this table for agents; this file wins if they differ.

| #   | Ticket                                            | Milestone | Status      | PR                                                                                                                                   |
| --- | ------------------------------------------------- | --------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 01  | Green, fast main                                  | M0        | done        | #145                                                                                                                                 |
| 02  | Module boundaries: expand                         | M0        | done        | #149                                                                                                                                 |
| 03  | Module boundaries: contract                       | M0        | done        | #151, #153, #154                                                                                                                     |
| 04  | One contract, reply parts                         | M0        | done        | #160                                                                                                                                 |
| 05  | Actions and words from the domain                 | M0        | done        | merged                                                                                                                               |
| 06  | Stop destroying history                           | M0        | done        | merged                                                                                                                               |
| 07  | History cannot be lost (cutover migration)        | M0        | done        | #169                                                                                                                                 |
| 08  | Real plant in                                     | M0        | done        | #150                                                                                                                                 |
| 09  | Real tickets in                                   | M0        | done        | #175                                                                                                                                 |
| 10  | One design kit                                    | M0        | done        | #147                                                                                                                                 |
| 11  | Page patterns: data, queue, detail, form          | M0        | done        | #162                                                                                                                                 |
| 12  | Page patterns: wizard, settings, dashboard, board | M0        | done        | #171                                                                                                                                 |
| 13  | Staging live                                      | M0        | done        | #146                                                                                                                                 |
| 14  | Staging holds Cosmos, safe to run                 | M0        | done        | #176; drill A passed 14 Nov (weekly dump carried into M1)                                                                            |
| 15  | Report a breakdown (floor)                        | M1        | done        | #179, #196, #205, #207                                                                                                               |
| 16  | Desk lists and ticket detail                      | M1        | in progress | #181, #194, #201, #203                                                                                                               |
| 17  | Work the ticket                                   | M1        | done        | #185                                                                                                                                 |
| 18  | Close, report, PDFs                               | M1        | done        | #212, #216, #221 (past breakdown screen with slice 4 build)                                                                          |
| 19  | Follow-up tasks                                   | M1        | todo        | —                                                                                                                                    |
| 20  | Admin fixes and audit                             | M1        | in progress | goal 1 API #191 + #200; screens todo                                                                                                 |
| 21  | People, logins and sign-in                        | M1        | in progress | API #199, #210; sign-in #213, who-is-acting #225; follow-up PR open soon; people screens todo                                        |
| 22  | Plant settings: machines, groups, shifts          | M1        | in progress | goal 2 #187; API #195; screens todo                                                                                                  |
| 23  | Plant settings: lists and company                 | M1        | in progress | API #206 (server done); screens todo                                                                                                 |
| 24  | Gujarati                                          | M1        | todo        | —                                                                                                                                    |
| 25  | Live board and alerts                             | M1        | in progress | goal 1 #229 (response/repair-today tiles wait on backend); goal 2 todo                                                               |
| 26  | Hardened                                          | M1        | todo        | —                                                                                                                                    |
| 27  | Usability round                                   | M1        | todo        | —                                                                                                                                    |
| 28  | Cutover                                           | M1        | todo        | —                                                                                                                                    |
| 29  | M2 schema                                         | M2        | done        | #228                                                                                                                                 |
| 30  | Clocks live                                       | M2        | done        | clocks on card/detail (`sla-timers.spec.ts`), pause breach #251; Cosmos SLA targets are an admin staging step                        |
| 31  | Roster, ladder, acknowledge                       | M2        | done        | server #241; screens #284; acknowledge #285; design calls #287                                                                       |
| 32  | Notification service                              | M2        | done        | #230                                                                                                                                 |
| 33  | Escalation                                        | M2        | done        | #249, #252; history and desk state #285; Set the ladder #287                                                                         |
| 34  | Production sign-off                               | M2        | done        | #244, #261, #262; the waiting feed #283                                                                                              |
| 35  | Run it safely                                     | M2        | in progress | devices and support access #231; failed-jobs screen and timer-lag alarm carried to M4a                                               |
| 36  | M4a schema and answer key                         | M4a       | done        | triage + answer key #267; migration part A #268                                                                                      |
| 37  | History, engine and drill-down                    | M4a       | done        | shell #265; snapshot + drill #289; face/Guide/profile #290; 37c 2026-log load #314                                                   |
| 38  | Dashboard and Today                               | M4a       | done        | answer-key seam #293; formulas #295, #298; screen + role homes #297; charts/cards/checklist #299; 38.5 draws the object figures #308 |
| 39  | Registers and machine pages                       | M4a       | done        | engine #304, screens #305, correction API #309, correction screen #311                                                               |
| 40  | Breakdown analyses                                | M4a       | done        | figures exact: seam #316, log #317, A1+S2 #318, A2 #319, A3 #320; screens #322, #325                                                 |
| 41  | Manpower, energy, root cause                      | M4a       | in progress | plan + 41h #327, 41h-2 #331, 41a A4 #329; 41b A5 built on 41b-a5, review next                                                        |
| 42  | Forecast                                          | M4a       | todo        | —                                                                                                                                    |
| 43  | Compare, team, money, Fix Finder                  | M4a       | todo        | —                                                                                                                                    |
| 44  | Action Center                                     | M4a       | todo        | —                                                                                                                                    |
| 45  | Reports, export, Guide                            | M4a       | todo        | —                                                                                                                                    |
| 46  | M4b schema                                        | M4b       | todo        | —                                                                                                                                    |
| 47  | Coded closes                                      | M4b       | todo        | —                                                                                                                                    |
| 48  | Shift-calendar KPIs                               | M4b       | todo        | —                                                                                                                                    |
| 49  | PM plans on the phone                             | M4b       | todo        | —                                                                                                                                    |
| 50  | PM calendar and compliance                        | M4b       | todo        | —                                                                                                                                    |
| 51  | Registers                                         | M4b       | todo        | —                                                                                                                                    |
| 52  | Forecast freeze and inspections                   | M4b       | todo        | —                                                                                                                                    |
| 53  | Monthly scorecard                                 | M4b       | todo        | —                                                                                                                                    |
| 54  | Interventions and ranking                         | M4b       | todo        | —                                                                                                                                    |
| 55  | M6 schema and AI provider                         | M6        | todo        | —                                                                                                                                    |
| 56  | Evaluation harness and confirm                    | M6        | todo        | —                                                                                                                                    |
| 57  | Find past jobs                                    | M6        | todo        | —                                                                                                                                    |
| 58  | Code suggestion                                   | M6        | todo        | —                                                                                                                                    |
| 59  | Ask and brief                                     | M6        | todo        | —                                                                                                                                    |
| 60  | Manuals                                           | M6        | todo        | —                                                                                                                                    |
| 61  | M3 schema and webhook                             | M3        | parked      | —                                                                                                                                    |
| 62  | WhatsApp people and outbound                      | M3        | parked      | —                                                                                                                                    |
| 63  | Report by WhatsApp                                | M3        | parked      | —                                                                                                                                    |
| 64  | Voice                                             | M3        | parked      | —                                                                                                                                    |
| 65  | Email and deletion                                | M3        | parked      | —                                                                                                                                    |
| 66  | Lockout before electrical work                    | M2        | done        | server #248; ticket #264; settings (flag on categories, step list) #284                                                              |
| 67  | Reliability and critical spares                   | M4b       | todo        | —                                                                                                                                    |
| 68  | Gujarati text understood                          | M1        | todo        | —                                                                                                                                    |

## Testing seams (to-spec step 2: fewest, highest)

| Seam                                                                                                                  | What is tested there                                                                                       | Prior art            |
| --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------- |
| **1. The HTTP API** (`/api/v1`) against real Postgres loaded with Cosmos's real data (names and phones swapped in CI) | Every backend behaviour: commands, figures, permissions, tenancy, timers (fake clock), escalation, imports | `apps/server/test/*` |
| **2. The browser** — one Playwright journey per slice on the same data                                                | What a person sees and does, at 360 px, axe clean                                                          | `apps/web/e2e/*`     |
| **3. The engine call** `run(data, asOf) → figures`                                                                    | Every analytics number equals Bhavin's answer key                                                          | new in M4a           |

CI on every PR: lint, typecheck, seam 1 for the touched module plus tenant isolation, one browser smoke.
The slice's full browser journey runs on staging before Nimish previews it. Guard tools (boundaries, migrations,
UI budgets, table budget, PII scan) run inside the seam-1 CI job; a guard is proven by a planted violation that
turns that job red. Each goal below is tagged with its seam: **[API]**, **[Browser]**, **[Engine]**; only ticket
01 has **[Process]** goals. Every schema change rides in its milestone's one schema ticket (ARCHITECTURE §8);
no other ticket adds a migration, and no ticket adds a table outside D17's list.

## Milestones

| #   | Milestone                 | Goal                                                                         | Gate (Nimish checks)                                                                                 |                                     Tickets |
| --- | ------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------: |
| M0  | Foundation                | Modules and contracts in CI, history protected, one kit, staging with Cosmos | Opens staging on his phone, sees Cosmos's real tickets, approves the `/gallery` and picks the accent |                                          14 |
| M1  | Cutover                   | Cosmos raises and works every ticket on Uptimo; Bhavin's app read-only       | Day-3 and day-7 go/no-go                                                                             |                                          15 |
| M2  | Accountability            | Two clocks, escalation ladder and roster, production sign-off, lockout       | Sign-off turnaround visible on live tickets                                                          |                                           8 |
| M4a | Analytics parity          | Every platform figure Cosmos uses, exact, drillable                          | Ten figures spot-checked against Bhavin's platform                                                   |                                          10 |
| M4b | The loop                  | PM, registers, coded closes, reliability, forecasts, scorecard, ranking      | First monthly scorecard from live data                                                               |                                          10 |
| M6  | AI (India only)           | Suggestions a person confirms, each above its threshold                      | Agrees capabilities and thresholds; sees shadow results                                              |                                           6 |
| M3  | WhatsApp and voice (last) | Report and be chased on WhatsApp, by text or voice                           | An operator raises a ticket by voice                                                                 |                                           5 |
|     | **Total**                 |                                                                              |                                                                                                      | **68** (63 active, 5 parked; 29 to cutover) |

Order is the BRIEF's: M0 → M1 → M2 → M4a → M4b → M6 → M3. Every ticket of a later milestone waits for every
ticket of the milestone before it and for that milestone's gate: the first tickets of each milestone (15 and 16
for M1; 29, 36, 46, 55, 61) name the gate in "Blocked by", and every other ticket descends from them. Nothing
before M3 depends on M3.

## M0 — Foundation

**01 Green, fast main** · Blocked by: none
Delivers: every PR gets a quick, honest answer, and the documents tell the truth.

1. [Browser] The SLA timer shows no due time until the plant's time zone is known, and the SLA journey passes 20 runs in a row; CI runs lint, typecheck, touched-module API tests, tenant isolation and the browser smoke, sharded, with a seeded tenant per Playwright worker, each shard under 8 minutes.
2. [Process] A docs check fails CI when an instruction file names a process other than pstack, when ADR 0001, SPEC or `THIRD_PARTY.md` name Drizzle, or when an `in-progress` parity row has neither evidence nor a ticket; the changelog is one fragment per PR under `changes/`, `wiki/log.md` union-merged.
3. [Process] A PII scan in CI fails on a planted real name or phone number from the source lists.

**02 Module boundaries: expand** · Blocked by: 01
Delivers: the server starts to be modules that talk only through published interfaces (wide refactor, expand step).

1. [API] One kernel auth guard: every route not on the public allowlist answers 401 without a session (test generated from the route table).
2. [API] The kernel (`withTenant`, request context, guard, jobs) and the modules `ops`, `identity` and `plant` (ARCHITECTURE §2) live in module folders with a `repo.ts` and the manifest; the whole API suite passes unchanged; the boundary check fails a planted SQL call outside a moved module's `repo.ts`.

**03 Module boundaries: contract** · Blocked by: 02
Delivers: every module is behind its interface and CI enforces it (contract step).

1. [API] `tickets`, `accountability`, `notifications`, `reports`, `files` and `imports` are moved (`analytics`, `pm`, `ai` and `whatsapp` are born as modules in their milestones); workspace dependencies and `exports` replace relative imports; commands and permissions are one file each with a registry; the whole API suite passes unchanged and the boundary check is enforced for every module.
2. [API] The isolation test discovers tenant tables from the catalogue (`breakdown_report_person` included) and fails on any table not exercised as two tenants; the same test fails when a table outside D17's list exists (`ticket_tag` is a dated exception until 07 drops it).

Split from the draft's one modularisation item: ~25 server files and the domain registries do not fit one window.

**04 One contract, reply parts** · Blocked by: 03
Delivers: server and web share one typed contract; SLA data leaves the ticket reply before M2.

1. [API] Every route's reply parses with its shared Zod schema; a missing or extra field fails the route test; `api-types.ts` and the domain DTO copies are deleted and web types are `z.infer`.
2. [API] `/state` is byte-identical for a fixed ticket set while SLA arrives as the `sla` reply part contributed by `accountability`; `tickets` imports no higher module.

**05 Actions and words from the domain** · Blocked by: 03
Delivers: the buttons a person sees and every label come from one place.

1. [Browser] For every role and state in the permissions matrix the card shows exactly the server's `availableActions`; `components/actions.ts` is deleted.
2. [Browser] Catalogues are per namespace (each under 250 lines) with `MessageKey`; an English literal in a `.ts` label field fails typecheck; the existing journeys pass in English and Gujarati.

**06 Stop destroying history** · Blocked by: 03
Delivers: no code path deletes or rewrites history any more (prefactor the cutover migration needs, ARCHITECTURE §9 item 21).

1. [API] Pausing, resuming and transferring a real ticket keeps every `work_segment` id; `ended_at` and `end_reason` are updated in place; list entries and logins are switched off, never deleted, and still show on old tickets.
2. [API] Tags are gone from code: no tag route, screen or reply field remains and `ticket_tag` is no longer written.
3. [API] The migration check catches `DROP`, `UPDATE`, `DROP CONSTRAINT`, `SET NOT NULL`, `ALTER … TYPE`, `REVOKE` anywhere in a statement and demands an `approved-by` and a `backup:` header; the seven merged files are dated exceptions.

**07 History cannot be lost (cutover migration)** · Blocked by: 06
Delivers: the database itself refuses to lose history (the cutover schema ticket: ARCHITECTURE §9 items 21, 24, 25, 31, and the `ticket_tag` drop, which D17 and DATA-MAP Q12 put before cutover; backup first, staging first).

1. [API] As the app role, UPDATE and DELETE on `ticket_event` and DELETE on `ticket`, `work_segment`, `crew_member`, `breakdown_report`, `breakdown_report_person`, `list_item`, `login` and `person` are refused; history foreign keys are RESTRICT, so deleting a login that acted on a ticket, or a person who appears on one, is refused and the row remains; `ticket_tag` is dropped; the item-24 indexes exist and the day-report and My-complaints queries use them.
2. [API] A second open breakdown on one machine is refused by the database; the preflight lists existing duplicates and stops the migration when any exist.
3. [API] The definer functions work on fake data, callable only by the router role: import undo removes one batch; erasure leaves a leaver's name in no DATA-MAP §5 place and writes one count-only audit row (the controlled leaver script); customer offboarding deletes a tenant's rows only when its export and backup references are given, and is the only path that does; `audit.purge` removes rows over 3 years. A support grant without approver or over 7 days is refused and `audit_log` carries `platform_access_id`.

**08 Real plant in** · Blocked by: 01
Delivers: machines, people and settings are Cosmos's real ones, not seed guesses.

1. [API] Machines come from the 11 November registers (CNC, conventional, process, DG, utilities) with segments and cells; counts per segment equal the sources and differences are listed in the seed report.
2. [API] The 26 real logins and their people exist with roles; shifts are 08:00–18:30 and 18:29–05:00, and an event at 18:29 falls in the later shift.
3. [API] CI fixtures carry pseudonymised names and phones; the real files load only on staging, and the PII scan from 01 passes.

**09 Real tickets in** · Blocked by: 07, 08
Delivers: Uptimo holds Cosmos's 275 real tickets with Bhavin's exact numbers.

1. [API] The importer reads Bhavin's real `/api/export` (his field names, report keys, `segment`, `lead`, `task` events); every ticket's response, repair, waiting, vendor and downtime minutes equal his `worker.js` result, or the difference is listed with the edit that explains it (zero unexplained).
2. [API] Import and undo go through `tickets.importTickets` and `removeImported` (the manifest exception ends); a re-run is identical, undo leaves no row, and CI runs on the pseudonymised copy.

**10 One design kit** · Blocked by: 01
Delivers: every future screen is built from one installed kit (Apple principles, `docs/DESIGN.md`).

1. [Browser] The kit, tokens, Lucide icons, layout pieces and the status vocabulary (colour + label + icon) are installed under one ADR naming every package; the UI check fails a planted `className`, raw colour or screen file over 120 lines in `faces/`.
2. [Browser] `/gallery` shows every token, component and status at 360 px in English and Gujarati, axe clean; a changed screenshot fails CI; the production build answers 404 on `/gallery`.

**11 Page patterns: data, queue, detail, form** · Blocked by: 04, 10
Delivers: lists, details and forms are configuration on one data layer.

1. [Browser] `defineResource` and `useCommand` are the only fetch path; an offline command queues, replays on reconnect, and a 409 becomes a draft; the sync status shows online, offline, sending and draft.
2. [Browser] `QueuePage` (with cursor paging), `DetailPage` and `FormSheet` are in the gallery with loading, empty, error and offline states, axe clean at 360 px.

**12 Page patterns: wizard, settings, dashboard, board** · Blocked by: 11
Delivers: a settings screen is one short description; charts come from one layer.

1. [Browser] One `ResourceSpec` (≤ 60 lines, no JSX) generates a working `CrudPage` that lists, creates, edits and switches off a gallery resource through its API.
2. [Browser] `WizardPage`, `BoardPage` and `DashboardPage` with `useChart` (ECharts lazy-loaded under an ADR, token palette) are in the gallery, axe clean.

Split from draft ticket 06: seven patterns, the data layer and the chart layer exceed one window.

**13 Staging live** · Blocked by: 01 · External: domain and AWS role (N7)
Delivers: every merge reaches staging, and problems are seen early.

1. [API] A merge to `main` deploys staging and a rollback runs from CI; `/health` answers 503 when the database or queue is down.
2. [API] Secrets come from the secret store; logs carry tenant and request ids and a logged body with a name is redacted; the external uptime ping, error-count and ₹30,000 billing alarms exist and fire on a test signal.

**14 Staging holds Cosmos, safe to run** · Blocked by: 09, 13
Delivers: Nimish tries every slice on his phone on Cosmos's real data, and that data can be restored.

1. [Browser] Staging holds the real plant and 275 tickets, loaded by 08's seed and 09's import (the one owner of the staging load); the desk Open list shows them on a phone.
2. [API] Backups run (point-in-time plus weekly dump); a restore drill restores staging and its log is committed.
3. [API] `session.purge` and `idempotency.purge` (30 days), `import.purge` (payloads 1 year after the batch is done) and the `audit.purge` job delete past their period and are no-ops on re-run (fake clock); nightly `figures.drift` reports cached figures that differ from their events, skipping overrides.

## M1 — Cutover

> **Layout rule (Nimish, 13 Nov, binding):** the floor and desk keep v3's flows, screen order, button positions
> and copy, because the shop floor already knows them. Reference: Bhavin's screens rendered from
> `docs/discovery/real-2026-11-13/bhavin-source/phone_tool` (and `docs/discovery/bhavin-v3`) at 360 px. The
> design kit changes look (tokens, components, status vocabulary), never placement or flow. Every M1 screen
> ticket's browser goal includes a side-by-side check against the v3 reference screenshot.

Rule for every M1 ticket that moves a screen onto the kit: the parity rows already `done` keep their tests green.
Parity rows are cited by id; their acceptance tests in `parity.yaml` are the "as v3" rule list.

**15 Report a breakdown (floor)** · Blocked by: 05, 12, 13, 14 (M0 gate: Nimish approves `/gallery` and the accent)

1. [Browser] An operator reports a stopped machine in three taps by search or group with quick problems; `?m=` opens a machine; a second report of an open machine opens the existing ticket, and a stopped report on a machine with an open ticket of kind `support` upgrades that ticket (`upgradeKind`).
2. [Browser] Other work requests, the sent screen with the ticket number, "I am starting work on it now" and My complaints pass `v3.reporting.01–04, 06–10`; every floor string is a catalogue key (Gujarati itself is 24).

**16 Desk lists and ticket detail** · Blocked by: 05, 12, 13, 14 (M0 gate: Nimish approves `/gallery` and the accent)

1. [Browser] Open (counts strip, breakdowns, tasks, work), Mine, Team and needs-report show the real tickets per `v3.views.01–03`, and lists page by cursor past 200 rows.
2. [Browser] The ticket card and detail show the facts, full history, people and minutes, and the action bar from `availableActions`.
3. [API] (Nimish, 13 Nov: new tickets follow Bhavin's rules.) `figures()` gives the same repair, waiting, vendor and downtime minutes as his `worker.js` for every ticket in the pseudonymised export (09's `real-oracle` is the test): repair is his wall clock, support and general tickets carry downtime by his current rule (the 6 Nov change, to be confirmed by Bhavin), minutes are rounded as he rounds. `docs/spec/DOMAIN.md` section 5 is rewritten to say so, and the 29 listed differences from 09 vanish for new tickets.

**17 Work the ticket** · Blocked by: 16

1. [API] Start (back-dated), update, pause with reasons, resume, join, leave, transfer, pick up, running and stopped give the `worker.js` result on real tickets (`v3.actions.01, 03, 04, 07, 08`).
2. [API] Per-person minutes come from one domain function and are the same number on the ticket and the day report.

**18 Close, report, PDFs** · Blocked by: 08, 17

1. [Browser] Close with report (the form of `v3.reports.01`), close without report, mark done for a work request, and late report work; a past breakdown creates a closed ticket with no workflow.
2. [Browser] The breakdown PDF (QR identical to v3) and the day report on the real shifts render, Gujarati included (`v3.reports.02–03`, `v3.actions.16`).

**19 Follow-up tasks** · Blocked by: 15, 18

1. [Browser] A job left unfinished at close becomes a child task with reason and expected date on the Tasks tab; the parent shows pending, overdue and done; marking a task done asks the machine-stopped minutes (`v3.actions.17`).
2. [Browser] Reporting a machine that has a pending task warns the operator (`v3.reporting.05`).

**20 Admin fixes and audit** · Blocked by: 15, 17

1. [API] Cancel (with the floor's cancel-own entry), restore within 7 days, and correct (machine and kind included) work with reasons and old and new values (`v3.actions.13–15`).
2. [Browser] `ops.audit.record` is the one audit writer; every configuration and correction change appears on the audit screen, and the admin exports the trail as CSV.

**21 People, logins and sign-in** · Blocked by: 12, 20

1. [API] The admin adds, edits and switches off people and logins (personal or shared, role, cell) on generated screens, each change audited; a mobile number must be E.164; switching a person off clears number and devices and keeps the name on past tickets; a technician's reply holds no phone.
2. [Browser] Sign-in is a `WizardPage` with show-password and the last username; any 401 signs out with a message (`v3.signin.01, 03, 05`); a shared phone asks who is acting and every action records the acting person.

**22 Plant settings: machines, groups, shifts** · Blocked by: 12, 20

1. [Browser] Machines, segments, groups and shifts are edited on generated settings screens; machine criticality is edited and audited; a cell change writes a dated `machine_move`.
2. [API] A hidden-group flag replaces the utility regex (`v3.alerts.08`); no regex is left in code.

Split from draft ticket 16 (six draft tickets): machine moves and the group flag carry domain rules, not only specs.

**23 Plant settings: lists and company** · Blocked by: 12, 20

1. [Browser] Every list (wait reasons and their flags, work types, quick problems) and the glossary are edited on generated settings screens (`v3.alerts.07`).
2. [Browser] Company name, logo, language, time zone and feature switches are settings (`v3.signin.07`); no hand-built settings screen is left.

**24 Gujarati** · Blocked by: 15, 23 · External: Gujarati strings (N5)

1. [Browser] The admin sees untranslated keys and enters Gujarati on a translation screen; overrides are stored as a `setting` (D17).
2. [Browser] The floor's untranslated list is empty, Cosmos's wording is Uptimo's default Gujarati, and the floor journey of 15 passes in Gujarati.

**25 Live board and alerts** · Blocked by: 12, 16

1. [Browser] The TV board shows the same tickets as Open and refreshes every 30 seconds; the WhatsApp share text matches `v3.views.06, 08`.
2. [Browser] New-breakdown and complaint-fixed push go through the existing push module's one send call (32 later takes it over; no second path); the account sheet works; the update banner waits out the shift changeover; floor and desk install as two apps.

**26 Hardened** · Blocked by: 13, 16, 25 · External: security reviewer signs off ASVS L1 and the DPDP checklist (N10)

1. [API] Login and `/brand` are rate-limited per client; a session cannot cross tenants; `/files/{id}` serves stored PDFs and logos with a permission check; a common password is refused; a high-severity dependency advisory fails CI.
2. [Browser] Open and Live render in under 2 seconds on a cheap Android over 3G on staging; `/state` p95 is under 300 ms on a 500-machine fixture.

**27 Usability round** · Blocked by: 14, 15, 16, 17, 18 · External: sessions (N15)

1. [Browser] 3–5 operators and 3 technicians run the floor and desk journeys on staging; times and errors are recorded against each journey spec.
2. [Browser] Each stumble fixed here first becomes a failing journey, then passes; at most five are fixed, the rest are filed as issues.

**28 Cutover** · Blocked by: 14, 15–27, 68 · External: N7

1. [API] Production runs and a deploy outside 05:00–08:00 IST is refused by the pipeline; a restore drill on production is executed and logged.
2. [API] The cutover-morning import and its undo are rehearsed on staging with zero unexplained mismatches, then run; Bhavin's app goes read-only; the rehearsed revert restores the pre-cutover state on staging.

**68 Gujarati text understood** · Blocked by: 15, 23 · External: India-only translation provider — candidates AI4Bharat IndicTrans2 (self-hosted in AWS Mumbai; verify the model licence) and Sarvam (India-hosted API), suggested by Nimish; a short trial on the real Cosmos problem texts picks one, recorded as a decision

1. [API] A problem written in Gujarati script or in transliterated Gujarati is translated to English inside India behind one adapter, using Bhavin's two-stage glossary (script terms → English before translation, English corrections after); the original text is kept beside the English. Proven on the real tickets and the 144 live glossary rules (e.g. every "coolant" variant becomes "coolant").
2. [Browser] The person sees the English back and confirms or edits it before sending, as in v3; offline, the original is queued and translated on arrival.
3. [Browser] The admin's spelling tool (Bhavin's): scans the breakdown history for words used twice or more and look-alikes of known words, offers fix entries / add rule / keep; accepted rules apply to new reports and search. No new table (`glossary_term`).

## M2 — Accountability

Escalation details (ladder people, delays, repeats, who acknowledges) are Nimish's answers two weeks after
cutover; agents propose defaults (BRIEF open question).

**29 M2 schema** · Blocked by: 28
Delivers: the one M2 migration (backup first): `roster_entry`, `escalation_rule`, `notification`; `sla_timer.kind` gains `pause` and `handback`; `list_item` gains a "needs lockout" flag (ticket 66); the handover person link (ARCHITECTURE §9 items 30, 32).

1. [API] The migration applies and reverts on a copy of production after a backup; a roster line is unique per tenant, date, shift (a link to `shift`) and person; a notification is unique per tenant and dedupe key.
2. [API] Handover on a report is a person link and imported text is kept; the SLA policy is found by severity; nothing reads or writes `person.kind`, `ticket.sla_policy_id` or `ticket.handback_status`.

**30 Clocks live** · Blocked by: 29

1. [Browser] Severity and SLA targets are switched on at Cosmos; acknowledge and restore clocks show on cards, detail and board.
2. [API] A pause longer than the policy's maximum fires one breach on the fake clock (the sign-off timeout is 34's).

**31 Roster, ladder, acknowledge** · Blocked by: 29, 30

1. [Browser] The head sets the duty roster per shift and the ladder L1–L4 and vendor on generated screens; `repeat_minutes` under 15 or no repeat cap is refused; roster lines older than 1 year are purged (fake clock).
2. [API] The rostered person acknowledges a ticket and its acknowledge clock stops; anyone else is refused.

**32 Notification service** · Blocked by: 29

1. [API] `notify` writes one row per recipient and channel (the same dedupe key twice gives one row) holding ids, not names; `notify.send` retries 5 times with backoff, then marks the row dead; an expired subscription is deleted; rows over 90 days are purged.
2. [Browser] The two v3 pushes from 25 now go through `notify`, and the direct send call is deleted.

Split from draft ticket 24: the service is its own module, used by escalation, registers and M3.

**33 Escalation** · Blocked by: 31, 32

1. [API] Missed acknowledge notifies L2, missed restore L3, a critical machine still down L4, repeating up to the cap (fake clock).
2. [Browser] Every escalation shows in the ticket's history; a transferred ticket nobody picks up escalates.

**34 Production sign-off** · Blocked by: 30

1. [Browser] The reporter, or any operator login in the same cell, confirms or disputes the fix from My complaints or the board QR; a dispute reopens the same ticket for the last lead (`v3.views.07`).
2. [API] An unanswered sign-off times out on the fake clock; turnaround is shown both ways on the ticket and Team.

**35 Run it safely** · Blocked by: 32, 33

1. [Browser] The admin sees failed jobs (dead notifications included) and retries one, audited; a late timer raises the timer-lag alarm.
2. [API] A person lists their devices and signs one out; that device's next call answers 401.
3. [API] Support access needs the Cosmos admin's approval, lasts at most 7 days, and every action under it is in the audit trail with its grant; an expired grant answers 403.

**66 Lockout before electrical work** · Blocked by: 29, 30

1. [API] A ticket whose work type or breakdown category is flagged "needs lockout" (a flag on the list entry, added in 29) refuses Start until the lockout steps (a plant setting) are confirmed; the confirmation is a ticket history entry with who and when. No new table.
2. [Browser] The technician ticks the lockout steps on the phone before Start; the ticket history shows the confirmation; an unflagged ticket starts as before.

## M4a — Analytics parity

**36 M4a schema and answer key** · Blocked by: 33, 34, 35, 66 (M2 gate) · External: triage with Bhavin, code aliases (N12)

1. [Engine] Bhavin's 11 November platform and workbook figures for every screen the triage keeps are pseudonymised answer-key fixtures; `parity.yaml` gains a row per kept screen, the AMC & Warranty, Legal Compliance, PM Plan and PM Reports registers included; the parity check fails on a kept screen without a row and ticket.
2. [API] One migration (backup first): `kpi_snapshot`; the alias column on `list_item`; each kept stored item (Why-Why records, Team Focus status/owner/note, nudge snooze; PDF import by QR is dropped, `DIFFERENCES.md` D21) gets a home in an existing table confirmed by the schema-reviewer, or is dropped in `DIFFERENCES.md`.
3. [API] `person.kind`, `ticket.sla_policy_id` and `ticket.handback_status` are dropped; the migration reverts on a production copy.

**37 History, engine and drill-down** · Blocked by: 36

1. [API] The 1,354-row breakdown log is loaded as closed tickets through the past-breakdown path with source references and legacy codes mapped through the alias column; each counts once beside the live tickets, and imported history shows on the desk; the leaver erasure path from 07 replaces a leaver's name in these history tickets too.
2. [Engine] `run(data, asOf)` with the legacy profile reads hours/day, days/year, cost/hour, thresholds and Action Center constants from settings and writes `kpi_snapshot`; the admin edits hours/day, cost/hour and thresholds on a generated settings screen, each change audited.
3. [Browser] The analytics face has its shell and Guide entry; every registered figure carries a drill target to its rows, and a test fails on a figure without one.

**38 Dashboard and Today** · Blocked by: 37

1. [Engine] Dashboard KPIs, derived numbers and the data checklist match the answer key.
2. [Browser] The dashboard shows them; each role's home opens on what needs that person now (operator My complaints, technician Mine, heads a Today dashboard of open items and breached clocks).

**39 Registers and machine pages** · Blocked by: 37

1. [Engine] Registers (controller and make split), fleet age and footprint match the answer key; the cell change log exports as the platform's sheet, and an admin correcting a cell move's date is audited; register exports carry their controlled-document numbers.
2. [Browser] One page per machine shows nameplate, history and cell moves, each figure drillable.

Split from draft ticket 28 (seven draft tickets): registers and machine pages are a separate engine family and face.

**40 Breakdown analyses** · Blocked by: 37

1. [Engine] Breakdown log (NO DT and conversions included), A1 BD % and PM split, A2 category and cell, A3 MTTR and MTBF match exactly.
2. [Browser] Their screens show them with drill-downs.

**41 Manpower, energy, root cause** · Blocked by: 37

1. [Engine] A4 manpower, A5 energy heatmap, A6 Why-Why and A10 problem analysis match the answer key.
2. [Browser] Their screens have sortable tables; a Why-Why record is saved in its home from 36 and prints as PDF.

**42 Forecast** · Blocked by: 39, 40

1. [Engine] Planning forecast (pooled rate, seeded Monte Carlo), risk bands, A9 bottleneck scoring, trend test, repeat faults and the Forecast Lab backtest match.
2. [Browser] They are on screen with their kept exports; the machine page shows its forecast band.

**43 Compare, team, money, Fix Finder** · Blocked by: 39, 40

1. [Engine] Health score comparison, Team Focus, Money Matters and the Fix Finder ranking match.
2. [Browser] They are on screen with their kept exports; Team Focus status, owner and note persist; money is shown only to heads and admin; the machine page shows its health score.

**44 Action Center** · Blocked by: 41, 42, 43

1. [Engine] The 13 nudge rules fire on the fixture exactly as the platform's.
2. [Browser] A nudge can be snoozed and the snooze holds across sessions.

Split from draft ticket 33 (six draft tickets): the rule engine is independent of reports and export.

**45 Reports, export, Guide** · Blocked by: 38, 41, 42, 43

1. [Engine] Monthly and annual reports and their PDFs match; the whole data set exports as the platform's workbook (writer library under an ADR).
2. [Browser] The Guide explains every figure on screen, and each Guide entry opens its figure.

## M4b — The loop

**46 M4b schema** · Blocked by: 44, 45 (M4a gate)
Delivers: the one M4b migration (backup first): `forecast`, `intervention`, `pm_plan`, `asset_register`; `raised_channel` gains `pm` and `inspection`; failure-code columns (component, mode, cause, action) on `breakdown_report` (ARCHITECTURE §9 items 34, 38 as amended by D17).

1. [API] The migration applies and reverts on a production copy; an `asset_register` row needs a `kind`; a ticket can be raised with channel `pm` or `inspection`.
2. [API] A breakdown report stores four codes that must be `failure_code` list items of the tenant.
3. [API] Meter interval, tolerance and the last meter reading are `pm_plan` columns; the ticked checklist points of a PM job are that ticket's report data (D17: no `pm_execution` or checklist table).

**47 Coded closes** · Blocked by: 46

1. [Browser] Every breakdown close requires codes from one `failure_code` list; the list is a generated settings screen; a switched-off code still shows on old reports.
2. [API] Bhavin's old codes resolve through the alias column loaded in 37, so legacy and new closes count in one code.

**48 Shift-calendar KPIs** · Blocked by: 47

1. [Engine] MTBF, MTTR and availability on real working hours (standard profile) sit beside the legacy figures and never replace them; hand-computed fixtures agree.
2. [Browser] Pareto and heatmaps by machine, cell, code and shift, and the backlog, are on screen and drill to tickets.

Split from draft ticket 34: coding at close and the standard KPI family are separate lanes (ARCHITECTURE §8).

**49 PM plans on the phone** · Blocked by: 46

1. [API] PM plans and checklists come from the workbook (PM Plan 431 rows, PM Reports) into `pm_plan`; counts match.
2. [Browser] `pm.generate` raises PM jobs as tickets by time and by meter reading; a technician ticks the checklist on the phone and closes the job.

**50 PM calendar and compliance** · Blocked by: 49

1. [Browser] The PM calendar (FullCalendar under an ADR) spreads load and moving a job reschedules it; the machine page lists its open and PM tasks.
2. [Engine] PM compliance and schedule compliance are defined once here and match hand-computed fixtures.

Split from draft ticket 35 (five draft tickets): a new page pattern and its figures do not fit beside the import.

**51 Registers** · Blocked by: 46

1. [Browser] AMC, warranty and legal tests and calibrations are one register with `kind`, loaded from the workbook and edited on a generated screen.
2. [API] An item within its lead time notifies its owner through `notify` (fake clock).

**52 Forecast freeze and inspections** · Blocked by: 46

1. [API] `engine.freeze` on the 1st writes one `forecast` row per machine; after the month the outcome is scored into the same row (fake clock).
2. [API] A Hot machine raises one inspection ticket per run, and its closed outcome is stored on the forecast row; an accepted nudge becomes a linked ticket.

**53 Monthly scorecard** · Blocked by: 48, 50, 52

1. [API] When a month closes (fake clock), one frozen `kpi_snapshot` period holds forecast hits and outcomes, MTBF, MTTR, availability, PM compliance, backlog and sign-off turnaround; money only for heads and admin.
2. [Browser] The plant head opens the scorecard and its PDF.

Split from draft ticket 37: the scorecard reads three other slices' figures.

**54 Interventions and ranking** · Blocked by: 48, 50 · External: ranking method (Nimish)

1. [Engine] Every PM plan change is an intervention judged before and after against a control group (proposed default: same category and segment, no PM change in the window, at least three machines).
2. [Engine] Technicians are ranked by the agreed measures, weights, period and minimum jobs from `kpi_snapshot`, each input shown and the method written in the Guide.

**67 Reliability and critical spares** · Blocked by: 48

1. [Engine] Weibull two-parameter fits with censoring per machine (only above a minimum number of failures, otherwise per category), with Kaplan-Meier and Crow-AMSAA trend, each proven against reference values computed independently; results in `kpi_snapshot`. No new table.
2. [Engine] A critical-spares list per machine from failure history (spares used on breakdown reports, ranked by how often and how much downtime they caused), in `kpi_snapshot`.
3. [Browser] The machine page shows the reliability fit (or "not enough history") and its critical spares; both drill to the breakdowns behind them.

## M6 — AI (India only)

**55 M6 schema and AI provider** · Blocked by: 51, 53, 54, 67 (M4b gate) · External: capability alignment and numeric thresholds T1–T6 (Nimish), residency record
Delivers: the one M6 migration: `ai_suggestion`, `document`, `document_chunk`, the `pg_trgm` extension.

1. [API] The migration applies and reverts; suggestions are tenant-scoped; suggestions older than 2 years are purged (fake clock).
2. [API] `AiProvider` with a fake provider; a real provider call is refused until the residency record is filed, and an endpoint outside India is always refused; input is redacted before send.
3. [API] The erasure function is extended so erasing a person replaces their name in `ai_suggestion` text, keeping only the ticket link (DATA-MAP §5).

**56 Evaluation harness and confirm** · Blocked by: 55

1. [API] Pseudonymised evaluation files in the repo run in CI on the fake provider and give a score per feature; real-ticket shadow runs happen only on staging.
2. [Browser] A shadow suggestion is not shown; a live one is shown on the ticket, changes nothing until a person confirms, and then calls the owning command marked `suggested_by: ai`.

Split from draft ticket 39: the schema and adapter must land before any feature lane (ARCHITECTURE §8: M6 is one lane, then three).

**57 Find past jobs** · Blocked by: 56

1. [API] Search by words, transliterated Gujarati included, finds past jobs at or above T2 on the evaluation set; a duplicate report is caught at or above T3 (shadow until then).
2. [Browser] The Fix Finder screen from 43 shows evidence: similar jobs, what fixed them and how often it held; no second screen.

**58 Code suggestion** · Blocked by: 56

1. [API] A failure code is suggested from the words, validated against the tenant's `failure_code` items or dropped; the person's code is in the top 3 in at least T1 % of evaluation cases.
2. [Browser] It goes live per tenant only above T1; below it, agreement is measured in shadow.

**59 Ask and brief** · Blocked by: 56

1. [Browser] A manager asks a question and sees the answer, its view and its SQL; every number on screen comes from `kpi_snapshot` or ticket ids through `analytics.figuresByIds`, never from model text.
2. [API] Each role's daily briefing summarises that role's Today items (38), each line carrying its ticket or snapshot ids, and is pushed through `notify`.
3. [API] Questions go live per tenant only above T4 and the briefing only above T5 (as named in 55); below, they run in shadow.

**60 Manuals** · Blocked by: 56

1. [API] A plant's uploaded manual is searchable by page for that plant only (two-tenant test); PDF text extraction is under an ADR.
2. [Browser] A PM plan draft cites its manual pages and waits for a person (`pm.createDraftPlan`).
3. [API] Drafts go live per tenant only above T6 (as named in 55); below, they run in shadow.

## M3 — WhatsApp and voice (parked: not in the current build, Nimish 13 Nov)

**61 M3 schema and webhook** · Blocked by: 57, 58, 59, 60 (M6 gate) · External: Meta verification, number, templates (N8)
Delivers: the one M3 migration: `wa_message` (unique per tenant and provider message id); E.164 check on `person.phone` after non-conforming numbers are listed for the admin (item 37).

1. [API] The migration applies and reverts; a non-E.164 number is refused by the database.
2. [API] A bad signature answers 401; the verification handshake works; the webhook is rate-limited and on the public allowlist; the same payload twice gives one message.

**62 WhatsApp people and outbound** · Blocked by: 61 · External: N8, consent text (N14)

1. [API] A message is tied to a person by `person.phone`; an unknown number gets a polite reply and no ticket; first contact gets the consent text, and consent and opt-out are `wa_message` rows; messages older than 1 year are purged.
2. [API] The WhatsApp adapter registers with `notify`: escalations, assignments and sign-off requests go out (templates outside 24 hours, English and Gujarati) and replies end in the normal commands; at the monthly cap the channel falls back to push and the admin is told.

Split from draft ticket 44 (five draft tickets): the schema and the signed webhook land first.

**63 Report by WhatsApp** · Blocked by: 62

1. [API] An operator reports by chat (machine, situation, problem) and a ticket is raised with channel `whatsapp`; a printable QR sheet opens `?m=` or the chat per machine.
2. [API] A closed ticket's PDF and the day reports arrive on WhatsApp on schedule.

**64 Voice** · Blocked by: 63 · External: voice notes (N6), speech key (N9)

1. [API] A voice note is stored as a `file`, transcribed in India (client under an ADR), read back and counted only once confirmed; the daily minutes cap is checked first and three failures ask the person to type; recordings go 90 days after confirmation.
2. [API] Accuracy per language on the consented test set is recorded by a test in the repo; a corrected word is proposed as a glossary term for the admin.

**65 Email and deletion** · Blocked by: 64 · External: mail domain (N7)

1. [API] The plant head gets escalations and reports by email through `notify`.
2. [API] On request a person's messages and recordings are deleted and audited.

## What can run at the same time

| Window  | Parallel tickets                                                               |
| ------- | ------------------------------------------------------------------------------ |
| Start   | 02, 08, 10, 13 (after 01)                                                      |
| M0      | 04, 05, 06 after 03; 11 after 04 and 10; 07 then 09; 14 last                   |
| M1      | 15 and 16; then 17 → 18 → 19 with 20; then 21, 22, 23, 25 together; 24, 26, 27 |
| M2      | 30 and 32 after 29; then 31, 34 and 66; 33; 35                                 |
| M4a     | 38, 39, 40, 41 after 37; then 42 and 43; then 44 and 45                        |
| M4b     | 47, 49, 51, 52 after 46; then 48 and 50; then 53, 54 and 67                    |
| M6 / M3 | 57–60 after 56; 62 after 61, then 63 → 64 → 65                                 |

One milestone migration at a time; one browser-test stack; Nimish previews every user-visible slice.

**G46 decided (Nimish, 13 Nov):** build all three — lockout checklist (ticket 66), critical-spares list and Weibull fits (ticket 67); no new table.
**Note for the schema reviewer:** D17 (corrected) allows 12 new tables, 40 in total; this plan adds exactly those 12.

## Rejected findings

| Finding                 | Reason                                                                                                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TB-05 (now 10)          | The "≤ 800 lines" size rule is the old draft's, not a binding source; kit components are copied from shadcn, the authored part (tokens, status, gallery) fits                |
| TB-18 (now 25)          | Board, push and PWA are already on `main` (HANDOFF, M1b); the ticket moves them onto the kit and adds the changeover hold                                                    |
| TB-19 (now 26)          | Each item is a small independent change (a limit, a route, a check); paging moved to 16, the review is External                                                              |
| TB-25 (now 34)          | The sign-off clock kind is in 29; what remains is one command, a timeout and two figures                                                                                     |
| TB-30 (now 41)          | Four pure engine functions, each proven by its fixture; screens are `DashboardPage` configuration; storage decided in 36                                                     |
| TB-31 (now 42)          | Same: pure, seeded functions with fixtures, one screen config; drill-down moved to 37                                                                                        |
| TB-32 (now 43)          | Same; Team Focus storage decided in 36                                                                                                                                       |
| TB-40 (now 57)          | Search is Postgres full-text plus `pg_trgm` (extension in 55); duplicates reuse the same search; the screen exists (43)                                                      |
| TB-46 (now 64)          | Storage reuses `file`, the glossary reuses `glossary_term`; the speech call is one adapter                                                                                   |
| NV-01 (01 not vertical) | BRIEF scope item 1 (harness re-baseline: one process, issues as the queue, true status) is process work by definition; the product owner allows it in M0's first ticket only |

## Coverage map

Ids: G gap, O overlap, Q other quality, TB too big (old ticket number), NV not vertical, UT untestable goal, E edge.
The earlier coverage review's too-big table listed 26 tickets; all 26 are mapped below.
Old → new: 01→01, 02→09, 03→08, 04→06+07, 05→10, 06→11+12, 07→13+14, 08→13+14, 09→15, 10→16, 11→17, 12→18,
13→19, 14→20, 15→21, 16→22+23, 17→24, 18→25, 19→26, 20→27, 21→28, 22→29+30, 23→31, 24→32+33, 25→34, 26→35,
27→36+37, 28→37+38+39, 29→40, 30→41, 31→42, 32→43, 33→44+45, 34→47+48, 35→49+50, 36→51, 37→52+53, 38→54,
39→55+56, 40→57, 41→58, 42→59, 43→60, 44→61+62, 45→63, 46→64, 47→65.

**Gaps → owner.** G1→02, 03 · G2→02 · G3→04 · G4→04 · G5→05 · G6→05 · G7→09 · G8→03 · G9→06 (header), 07 g1 (full revoke list, RESTRICT tests), 07 g3 (definer functions incl. customer offboarding)
· G10→06 (stop), 07 (drop) · G11→29 (stop), 36 (drop) · G12→29 · G13→07 (erasure function and script), 21 (switch-off), 37 g1 (history tickets), 55 g3 (`ai_suggestion`)
· G14→14 (session, idempotency, import, audit), 31 (roster), 32 (notification), 55 (AI), 62 (WhatsApp), 64 (voice)
· G15→26 (benchmark), 16 (paging) · G16→01 · G17→01 · G18→26 · G19→21 · G20→15 · G21→22 · G22→37 · G23→39
· G24→36 · G25→37 · G26→39 (document numbers), 42, 43 (kept exports) · G27→39 (page), 42 (forecast), 43 (health),
50 (tasks) · G28→38 · G29→52 · G30→49 · G31→13 · G32→62 (WhatsApp cap), 64 (speech cap) · G33→61 · G34→21
(validate), 61 (constraint) · G35→36 (`kpi_snapshot`), 46 (`forecast`) · G36→25 · G37→10 · G38→12 · G39→01 (scan),
08 (fixtures) · G40→14 · G41→20 · G42→32 · G43→31 · G44→21 · G45→26 (External sign-off) · **G46 → 66, 67 (decided 13 Nov)** — was not placed:
product question above.\*\* Split owners are distinct parts, each with one ticket.

**Overlaps → single owner.** O1→24 (15 only uses keys) · O2→43 (57 adds evidence) · O3→20 · O4→18 (work
requests), 19 (tasks with stopped minutes) · O5→19 · O6→20 (21, 22, 23 blocked by it) · O7→50 (48 owns backlog
only) · O8→32 (25 makes no second path) · O9→14 · O10→37 · O11→37 (alias load; 47 reuses).

**Other quality → fixed.** Q1→29, 36, 46, 55, 61 (schema-first tickets) · Q2→07 (support columns), 29 (M2
migration alone) · Q3→56 · Q4→36 (homes for Why-Why, Team Focus, nudges), 62 (consent as `wa_message` rows) ·
Q5→ADRs named in 10, 12, 45, 50, 60, 64 · Q6→24 (15 carries no Gujarati goal) · Q7→27 (cap of five).

**Too big → fixed** by split: TB-06 (11, 12), TB-07 (13, 14), TB-16 (22, 23), TB-22 (29, 30), TB-24 (32, 33), TB-27
(36, 37), TB-28 (37, 38, 39), TB-33 (44, 45), TB-34 (47, 48), TB-35 (49, 50), TB-37 (52, 53), TB-39 (55, 56), TB-44
(61, 62); by narrowing: TB-02 (staging load to 14), TB-15 (devices to 35, erasure to 07), TB-21 (day-3/7 checks are the
gate, importer move to 09), TB-29 (drill system to 37). Rejected: TB-05, 18, 19, 25,
30, 31, 32, 40, 46 (table above).

**Not vertical → fixed.** NV-08→14 (Nimish sees real tickets on staging) · NV-27→37 (history shows on the desk) ·
NV-39→56 (confirm flow on the ticket). NV-01 rejected.

**Untestable → fixed.** UT-01g3→01 g2 (docs check) · UT-05g3→M0 gate · UT-09g2→15 g2 (parity ids) · UT-18g1→25 g1
(parity ids) · UT-20g2→27 g2 · UT-37g2→53 g1 (contents named) · UT-38g1→54 g1 (control group defined) ·
UT-39g1→55 External · UT-41g1→58 (T1 metric; number set at 55) · UT-42g2→59 g2 (contents named).

**Edges → fixed.** E1 09←08 · E2 09←07, 14←09, 28←14 · E3 warning moved to 19 (19←15) · E4 18←08 · E5 21, 22, 23←20 ·
E6 26←16, 25 · E7 27←14, 16 · E8 28←14 (restore drill) · E9 54←50 · E10 48 has no schedule compliance · E11 53←50 ·
E12 36←33, 34, 35 (M2 gate) · E13 55←51, 53, 54 (M4b gate) · E14 61←57–60 (M6 gate) · E15 device sign-out in 35 ·
E16 13←01 only · E17 51←46 only.

**Re-verification fixes (round 2).** R1 order→15, 16 blocked by 05, 12, 13, 14 and the M0 gate; order note rewritten ·
R2 G9→07 g1, g3 · R3 module names per ARCHITECTURE §2→02 g2, 03 g1, 04 g2 (`accountability` owns `sla`); 20 keeps
`ops.audit.record` · R4 `ticket_tag` drop→07 (removed from 29), 03 g2 dated exception · R5 sign-off timeout only in
34 g2 (removed from 30 g2) · R6 shadow below threshold→59 g3 (T4, T5), 60 g3 (T6) · R7 `analytics.registers.03`→39 g1 ·
R8 `analytics.registers.05`→37 g2 · R9 meter and checklist homes→46 g3 · R10 erasure→37 g1, 55 g3 · R11 wording→18 g1,
15 g1, 25 g2, NV-01 reason.
