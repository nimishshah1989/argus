# Milestones and tickets — Uptimo

**This is the development goal post and the core tracking document.** Scope, order, every ticket's goals and blockers, and live status all live here. It is the one plan we follow; `CLAUDE.md` says how it is worked.

Made with the `to-tickets` skill (Matt Pocock): tracer-bullet vertical slices, each a complete path through
schema, API, UI and tests, demoable on its own, sized to one fresh context window, with its blocking edges.
Prefactoring comes first ("make the change easy, then make the easy change"); the one wide refactor (module
boundaries) runs expand → contract. Status: **the plan we follow (Nimish, 13 Nov 2026), extended to v1 on 19 Nov 2026 (tickets 69–98)**; GitHub Issues mirror it, with `ready-for-agent` on the
current milestone's tickets. Binding inputs: `docs/BRIEF.md`, `docs/ARCHITECTURE.md`,
`docs/DATA-MAP.md`, `docs/decisions/D01–D17` (table budget), `docs/spec/parity.yaml`, SPEC §3/§9, real data in
`docs/discovery/real-2026-11-13/`. The coverage map is at the end; the
47-ticket draft is in git history (`a9dfe3c`), the 176-ticket draft at `9b1c3b2`.

## Road to v1 (Nimish, 19 Nov 2026)

**v1 is Cosmos running on Uptimo in production, with five years of history, the rebuilt frontend and the M4b loop.**
WhatsApp (M3) and plant two (M5) stay parked. AI (M6) runs in shadow in v1 and goes live one feature at a time, when
that feature clears its threshold. The rulings behind this section are D33 (visual language), D34 (validation on the
whole database) and the ledger's 19 Nov entries. A ticket is `done` only when every one of its goals has met its
number. Nothing here is judged by eye: the proof is a command, a test, or a recorded `impeccable critique` score.

### v1 is done when these nine numbers hold

| #   | Measure                 | Target                                                                                                                                                       | Today (19 Nov, `1d51ad2`)                                                                                           | Proved by                                                    |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | Figures are right       | 2026: parity 0 problems and no done row regresses. 2022–2025: 100 % of the workbooks' machine-months equal or named; 0 unexplained                           | 2026 exact; no history loaded                                                                                       | 69, 79                                                       |
| 2   | Figures are fast        | A figures request answers in ≤ 300 ms (p95) with the whole history and 30 readers; 0 engine runs inside a figures read                                       | 2.8 s per request at 1,350 rows; recomputed on every request                                                        | 75, 98                                                       |
| 3   | The floor is fast       | Open and Live in under 2 s on a low-end Android profile; `/state` p95 under 300 ms at 500 machines                                                           | `/state` budget tested; phone timing never measured                                                                 | 26, 98                                                       |
| 4   | Operators find the keys | 100 % of the controls on every floor and desk workflow sit in v3's order and v3's part of the screen                                                         | locked by `docs/design/LOCK.md` rule 1; not measured                                                                | 88, 89                                                       |
| 5   | One design language     | 0 screens choose their own colour or card (57 copies in 39 files today); 51 of 51 figures show unit and tone, and each figure with a prior period its change | 0 of 51; percentages print without `%`                                                                              | 82, 87 (the guard fails from the end of 87); the figures: 86 |
| 6   | Every screen holds up   | Every template scores ≥ 32 of 40 on `impeccable critique` with 0 P0; axe 0 violations; no list paints more than 50 rows                                      | never scored; the Breakdown Log paints 1,343 rows                                                                   | 83–89                                                        |
| 7   | Nothing fails silently  | A planted failing job is on screen within 60 s and alarms within 5 min                                                                                       | no screen, no alarm                                                                                                 | 78                                                           |
| 8   | The plant can come back | A restore drill at most 7 days old at cutover with equal row counts; one deploy and one rollback exercised on production                                     | one drill (14 Nov, migration 10 of 15); no production stack                                                         | 97, 28                                                       |
| 9   | People can use it       | 5 of 5 operators raise a breakdown unaided; 0 blank Gujarati strings on the floor and desk, signed by a Cosmos reviewer                                      | no session held; Gujarati blank 1,209 of 1,848: floor and tickets 191, admin screens 389, analytics 629 (ticket 24) | 24, 27                                                       |

### The stages

Sizes are estimates (± 40 %) in the repo's own unit: one reviewed change of about 150 lines. The backend lane works
E then H then I; the frontend lane works F beside it; each stage stops at its gate for Nimish. This table holds the
gates of V0, E, H, F, I, P, M4b and M6; the milestones table below refers to it. Stage E's gate counts 77a and 78a; 77b and 78b wait for 85 and close with F. The sizes cover the work left:
Changes sum to 206 and Lines to 28,600. Stage E was raised from 22 changes and 2,800 lines to 39 and 4,800 after slice 76 was planned (76 alone is about 23 changes and 2,830 lines).

| Stage | What it is                     | Tickets                    | Gate (Nimish checks)                                                                                 | Changes |      Lines |
| ----- | ------------------------------ | -------------------------- | ---------------------------------------------------------------------------------------------------- | ------: | ---------: |
| V0    | Truth and pipes                | 73, 74                     | A green CI run on a PR, and staging showing main's commit                                            |       5 |        300 |
| E     | Engine at history scale        | 75–79                      | The Breakdowns page opens in under 2 s on a 10,000-row plant                                         |      39 |      4,800 |
| H     | History in                     | 69                         | The reconciliation sheet: each year's workbook against what was loaded, year by year                 |      14 |      2,000 |
| F     | Frontend rebuild               | 80–89                      | One direction picked (80); then each of the four waves approved, before and after                    |      60 |     10,500 |
| M4b   | The loop, finished             | 50c, 53, 54                | The first monthly scorecard, from live data                                                          |      12 |      1,800 |
| I     | Intelligence                   | 90–96                      | Seven insights on real data, each naming machines and hours                                          |      16 |      2,200 |
| M6    | AI in shadow                   | 55–60, 72                  | Nimish agrees the capabilities and thresholds T1–T6, and sees shadow scores per feature against them |      30 |      4,000 |
| P     | Production                     | 24, 26, 27, 28, 68, 97, 98 | Day-3 and day-7 go/no-go                                                                             |      30 |      3,000 |
|       | **Total to v1 (M6 in shadow)** |                            |                                                                                                      | **206** | **28,600** |

### Rules added on 19 Nov

1. **Every goal carries a number.** The proof is a command, a test, or a recorded `impeccable critique` score (the
   tool's own number, kept in the ticket's PR).
2. **Validation runs on the whole database (D34).** A pull request still runs the fast suite on the pseudonymised
   2026 data. A ticket that touches the engine, a figure, a report or an import is `done` only after `validate:full`
   (ticket 79) is green on staging against every ticket the plant holds, 2022 to today.
3. **The floor and the desk keep Bhavin's positions.** Flow, order, button position and words are v3's
   (`docs/design/LOCK.md` rule 1); colour, type, depth and motion are free under D33. Tickets 88 (the desk) and 89 (the floor) measure it.
4. **Analytics is free to change shape.** The dashboard, the analyses and the machine page are redesigned for a head
   reading on a laptop and a phone; their figures stay exact.
5. **Design work uses two skill sets.** `impeccable` sets the system (`init`, `shape`, `extract`, `colorize`,
   `typeset`, `layout`, `critique`, `audit`, `polish`, `harden`). Emil Kowalski's skills (MIT, installed in 80) set the
   craft: `prototype` for the three directions, `emil-design-eng` and `apple-design` for feel, `mobile-native` for the
   floor phone, `break-ui` for worst-case data, `animation-performance`, and `learn-taste` to write each of Nimish's
   corrections into `DESIGN.md`.
6. **The tracker changes in the pull request that changes the code.** Ticket 73 adds the check that enforces it, and
   every gate report states that the tracker rows were reconciled against the code (so a stale `in progress` row is
   caught there).

## Progress tracker

Updated by the orchestrator at every merge (status: `todo` → `in progress` → `done`; `parked` = not in the current build; `withdrawn` = dropped, not counted). GitHub Issues mirror this table for agents; this file wins if they differ. Rows 16–55 and 67 were reconciled against the code and its tests on 19 Nov at `1d51ad2` (the server and browser suites were not rerun in that session).

| #   | Ticket                                            | Milestone | Status      | PR                                                                                                                                      |
| --- | ------------------------------------------------- | --------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 01  | Green, fast main                                  | M0        | done        | #145                                                                                                                                    |
| 02  | Module boundaries: expand                         | M0        | done        | #149                                                                                                                                    |
| 03  | Module boundaries: contract                       | M0        | done        | #151, #153, #154                                                                                                                        |
| 04  | One contract, reply parts                         | M0        | done        | #160                                                                                                                                    |
| 05  | Actions and words from the domain                 | M0        | done        | merged                                                                                                                                  |
| 06  | Stop destroying history                           | M0        | done        | merged                                                                                                                                  |
| 07  | History cannot be lost (cutover migration)        | M0        | done        | #169                                                                                                                                    |
| 08  | Real plant in                                     | M0        | done        | #150                                                                                                                                    |
| 09  | Real tickets in                                   | M0        | done        | #175                                                                                                                                    |
| 10  | One design kit                                    | M0        | done        | #147                                                                                                                                    |
| 11  | Page patterns: data, queue, detail, form          | M0        | done        | #162                                                                                                                                    |
| 12  | Page patterns: wizard, settings, dashboard, board | M0        | done        | #171                                                                                                                                    |
| 13  | Staging live                                      | M0        | done        | #146                                                                                                                                    |
| 14  | Staging holds Cosmos, safe to run                 | M0        | done        | #176; drill A passed 14 Nov (weekly dump carried into M1)                                                                               |
| 15  | Report a breakdown (floor)                        | M1        | done        | #179, #196, #205, #207                                                                                                                  |
| 16  | Desk lists and ticket detail                      | M1        | done        | #181, #194, #201, #203; reconciled 19 Nov (journeys `desk-lists`, `desk-paging`, `desk-detail`)                                         |
| 17  | Work the ticket                                   | M1        | done        | #185                                                                                                                                    |
| 18  | Close, report, PDFs                               | M1        | done        | #212, #216, #221 (past breakdown screen with slice 4 build)                                                                             |
| 19  | Follow-up tasks                                   | M1        | done        | reconciled 19 Nov (`e2e/tasks.spec.ts`)                                                                                                 |
| 20  | Admin fixes and audit                             | M1        | done        | API #191, #200; screens reconciled 19 Nov (`e2e/admin.spec.ts`, `settings-audit.spec.ts`)                                               |
| 21  | People, logins and sign-in                        | M1        | done        | API #199, #210; sign-in #213, who-is-acting #225; people screens reconciled 19 Nov                                                      |
| 22  | Plant settings: machines, groups, shifts          | M1        | done        | #187, #195; screens reconciled 19 Nov (`settings-plant.spec.ts`)                                                                        |
| 23  | Plant settings: lists and company                 | M1        | done        | #206; screens reconciled 19 Nov (`settings-lists.spec.ts`, `settings-company.spec.ts`)                                                  |
| 24  | Gujarati                                          | M1        | in progress | goal 1 done (translation screen); goal 2 open: 1,209 of 1,848 strings blank, N5 sign-off                                                |
| 25  | Live board and alerts                             | M1        | done        | #229; reconciled 19 Nov (`board.spec.ts`, `account.spec.ts`)                                                                            |
| 26  | Hardened                                          | M1        | in progress | goal 1 done; goal 2 half (no low-end phone timing); N10 review open                                                                     |
| 27  | Usability round                                   | M1        | todo        | —                                                                                                                                       |
| 28  | Cutover                                           | M1        | todo        | —                                                                                                                                       |
| 29  | M2 schema                                         | M2        | done        | #228                                                                                                                                    |
| 30  | Clocks live                                       | M2        | done        | clocks on card/detail (`sla-timers.spec.ts`), pause breach #251; Cosmos SLA targets are an admin staging step                           |
| 31  | Roster, ladder, acknowledge                       | M2        | done        | server #241; screens #284; acknowledge #285; design calls #287                                                                          |
| 32  | Notification service                              | M2        | done        | #230                                                                                                                                    |
| 33  | Escalation                                        | M2        | done        | #249, #252; history and desk state #285; Set the ladder #287                                                                            |
| 34  | Production sign-off                               | M2        | done        | #244, #261, #262; the waiting feed #283                                                                                                 |
| 35  | Run it safely                                     | M2        | in progress | devices and support access #231; goal 1 (failed jobs, timer lag) is ticket 78                                                           |
| 36  | M4a schema and answer key                         | M4a       | done        | triage + answer key #267; migration part A #268                                                                                         |
| 37  | History, engine and drill-down                    | M4a       | done        | shell #265; snapshot + drill #289; face/Guide/profile #290; 37c 2026-log load #314                                                      |
| 38  | Dashboard and Today                               | M4a       | done        | answer-key seam #293; formulas #295, #298; screen + role homes #297; charts/cards/checklist #299; 38.5 draws the object figures #308    |
| 39  | Registers and machine pages                       | M4a       | done        | engine #304, screens #305, correction API #309, correction screen #311                                                                  |
| 40  | Breakdown analyses                                | M4a       | done        | figures exact: seam #316, log #317, A1+S2 #318, A2 #319, A3 #320; screens #322, #325                                                    |
| 41  | Manpower, energy, root cause                      | M4a       | done        | plan + 41h #327, 41h-2 #331, A4 #329, A5 #333, A6 #335, save+PDF #337, A10 #338/#339, screens #340/#342                                 |
| 42  | Forecast                                          | M4a       | done        | A9 #344/#345/#346, Forecast Lab #347, screens #350                                                                                      |
| 43  | Compare, team, money, Fix Finder                  | M4a       | done        | figures exact: compare #352, team #355, money #351, fix #353; screens #357                                                              |
| 44  | Action Center                                     | M4a       | done        | engine #358; figure #359; ack/snooze #360; screen #361                                                                                  |
| 45  | Reports, export, Guide                            | M4a       | done        | plan #362; monthly #363; annual #366; workbook #364/#365; routes #369; screens #367; Guide #368                                         |
| 46  | M4b schema                                        | M4b       | done        | #374, #375, #377                                                                                                                        |
| 47  | Coded closes                                      | M4b       | done        | #379, #384, #388                                                                                                                        |
| 48  | Shift-calendar KPIs                               | M4b       | done        | #391, #398, #401                                                                                                                        |
| 49  | PM plans on the phone                             | M4b       | done        | #380, #385, #393, #400                                                                                                                  |
| 50  | PM calendar and compliance                        | M4b       | in progress | data and move #397, compliance #403; the calendar screen #407 (50c, built before 85 on today's components; 87 restyles it); 50d: polish |
| 51  | Registers                                         | M4b       | done        | #390, #392, #394                                                                                                                        |
| 52  | Forecast freeze and inspections                   | M4b       | done        | #395, #402, #405; the Action Center accept button rides in 87                                                                           |
| 53  | Monthly scorecard                                 | M4b       | todo        | —                                                                                                                                       |
| 54  | Interventions and ranking                         | M4b       | todo        | —                                                                                                                                       |
| 55  | M6 schema and AI provider                         | M6        | in progress | `ai_suggestion`, provider, cap and job merged ahead; purge, erasure, `document` tables todo                                             |
| 56  | Evaluation harness and confirm                    | M6        | todo        | —                                                                                                                                       |
| 57  | Find past jobs                                    | M6        | todo        | —                                                                                                                                       |
| 58  | Code suggestion                                   | M6        | todo        | —                                                                                                                                       |
| 59  | Ask and brief                                     | M6        | todo        | —                                                                                                                                       |
| 60  | Manuals                                           | M6        | todo        | —                                                                                                                                       |
| 61  | M3 schema and webhook                             | M3        | parked      | —                                                                                                                                       |
| 62  | WhatsApp people and outbound                      | M3        | parked      | —                                                                                                                                       |
| 63  | Report by WhatsApp                                | M3        | parked      | —                                                                                                                                       |
| 64  | Voice                                             | M3        | parked      | —                                                                                                                                       |
| 65  | Email and deletion                                | M3        | parked      | —                                                                                                                                       |
| 66  | Lockout before electrical work                    | M2        | done        | server #248; ticket #264; settings (flag on categories, step list) #284                                                                 |
| 67  | Reliability and critical spares                   | M4b       | done        | #396, #399, #404                                                                                                                        |
| 68  | Gujarati text understood                          | M1        | todo        | —                                                                                                                                       |
| 69  | Legacy history 2022–2025                          | H         | in progress | re-planned 19 Nov: 69a–69c build now, 69d (staging) after 79                                                                            |
| 70  | (withdrawn)                                       | —         | withdrawn   | withdrawn in `docs/plan/CLAUDE-ADOPTION.md`                                                                                             |
| 71  | Real Claude provider                              | M6        | done        | merged with 55b/55c; production stays gated                                                                                             |
| 72  | Diagnosis on the ticket                           | M6        | in progress | 72a, 72b and the queue merged (stored in shadow); route and card todo                                                                   |
| 73  | The plan tells the truth                          | V0        | done        | #408, #409 (73b), #410, the tracker check (73d)                                                                                         |
| 74  | Pipes proven                                      | V0        | in progress | goal 1 and the code of goal 2 in the PR; the staging runs wait for a person                                                             |
| 75  | Figures are served, not recomputed                | E         | todo        | —                                                                                                                                       |
| 76  | The engine reads many years                       | E         | in progress | —                                                                                                                                       |
| 77  | Machines out of production data                   | E         | todo        | —                                                                                                                                       |
| 78  | Failed jobs are seen                              | E         | todo        | —                                                                                                                                       |
| 79  | Validation on the whole database                  | E         | todo        | —                                                                                                                                       |
| 80  | Design foundations                                | F         | in progress | —                                                                                                                                       |
| 81  | Tokens                                            | F         | todo        | —                                                                                                                                       |
| 82  | Meaning map and its guard                         | F         | todo        | —                                                                                                                                       |
| 83  | Elements                                          | F         | todo        | —                                                                                                                                       |
| 84  | Charts                                            | F         | todo        | —                                                                                                                                       |
| 85  | Page templates                                    | F         | todo        | —                                                                                                                                       |
| 86  | Wave 1: every analytics figure                    | F         | todo        | —                                                                                                                                       |
| 87  | Wave 2: the twelve analytical screens             | F         | todo        | —                                                                                                                                       |
| 88  | Wave 3: desk, ticket, board, settings             | F         | todo        | —                                                                                                                                       |
| 89  | Wave 4: the floor phone                           | F         | todo        | —                                                                                                                                       |
| 90  | Year on year and seasonality                      | I         | todo        | —                                                                                                                                       |
| 91  | Utility loss                                      | I         | todo        | —                                                                                                                                       |
| 92  | Reliability on five years                         | I         | todo        | —                                                                                                                                       |
| 93  | The forecast, proven                              | I         | todo        | —                                                                                                                                       |
| 94  | Which fix held                                    | I         | todo        | —                                                                                                                                       |
| 95  | PM effectiveness                                  | I         | todo        | —                                                                                                                                       |
| 96  | Subsystem and controller trends                   | I         | todo        | —                                                                                                                                       |
| 97  | Production stack                                  | P         | todo        | —                                                                                                                                       |
| 98  | Load proof on the whole database                  | P         | todo        | —                                                                                                                                       |

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

| #   | Milestone                 | Goal                                                                                       | Gate (Nimish checks)                                                                                 |                                                                                                                                                 Tickets |
| --- | ------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------: |
| M0  | Foundation                | Modules and contracts in CI, history protected, one kit, staging with Cosmos               | Opens staging on his phone, sees Cosmos's real tickets, approves the `/gallery` and picks the accent |                                                                                                                                                      14 |
| M1  | Cutover                   | Cosmos raises and works every ticket on Uptimo; Bhavin's app read-only                     | Day-3 and day-7 go/no-go                                                                             |                                                                                                                                                      15 |
| M2  | Accountability            | Two clocks, escalation ladder and roster, production sign-off, lockout                     | Sign-off turnaround visible on live tickets                                                          |                                                                                                                                                       8 |
| M4a | Analytics parity          | Every platform figure Cosmos uses, exact, drillable                                        | Ten figures spot-checked against Bhavin's platform                                                   |                                                                                                                                                      10 |
| M4b | The loop                  | PM, registers, coded closes, reliability, forecasts, scorecard, ranking                    | As in the stages table above                                                                         |                                                                                                                                                      10 |
| M6  | AI (India only)           | Suggestions a person confirms, each above its threshold                                    | As in the stages table above                                                                         |                                                                                                                                                       8 |
| V0  | Truth and pipes           | The tracker matches main; CI and staging run again                                         | As in the stages table above                                                                         |                                                                                                                                                       2 |
| E   | Engine at history scale   | Served figures, many years, excluded machines, visible failures, whole-database validation | As in the stages table above                                                                         |                                                                                                                                                       5 |
| H   | History in                | 2022–2025 loaded and reconciled                                                            | As in the stages table above                                                                         |                                                                                                                                                       1 |
| F   | Frontend rebuild          | One design language, thirteen elements, five templates, four waves                         | As in the stages table above                                                                         |                                                                                                                                                      10 |
| I   | Intelligence              | Seven figures only five years of data can give                                             | As in the stages table above                                                                         |                                                                                                                                                       7 |
| P   | Production                | A real stack, a load proof, and M1's open tail                                             | As in the stages table above                                                                         |                                                                                                                                                       2 |
| M3  | WhatsApp and voice (last) | Report and be chased on WhatsApp, by text or voice                                         | An operator raises a ticket by voice                                                                 |                                                                                                                                                       5 |
|     | **Total**                 |                                                                                            |                                                                                                      | **97** (92 active, 5 parked: 61–65; ticket 70 is withdrawn and not counted, so 98 numbers hold 97 tickets; 69–72 were added before 19 Nov, 73–98 on it) |

From 19 Nov the order is the road to v1's stages (above): V0, then E → H → I on the backend lane beside F on the
frontend lane, with M4b's tail (50c after 85, then 53 and 54), M6 in shadow and P; M1's open tickets (24, 26, 27, 28, 68) finish inside P. The earlier BRIEF order (M0 → M1 → M2 → M4a → M4b → M6 → M3) and its rule that every ticket of a
milestone waits for the previous milestone's gate applied only to M0, M1, M2, M4a and M4b, and it was not always kept:
M2's tickets ran ahead of M1's open tail. Those milestones' first tickets (15 and 16 for M1; 29, 36, 46) name the gate
in "Blocked by", and every other ticket descends from them. 55 and 61 still name the gate before them (the M4b gate,
and the M6 gate), so M6 waits for the M4b gate: 53, 54 and 50c. Nothing before M3 depends on M3.

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
2. [Browser] 0 blank floor and desk strings in English-key coverage, signed by a Cosmos reviewer (N5); Cosmos's wording is Uptimo's default Gujarati and the floor journey of 15 passes in Gujarati. Counted on 19 Nov from `packages/shared/src/i18n` (the `.gu.ts` files): 1,209 of 1,848 keys are blank. Filled, 0 blank: `common`, `desk`, `desk-lists`, `floor`, `report-floor`, `ticket`, `detail`, `sla`, `actions`, `report`, `board`, `settings`, `signin`, `admin` and the status namespaces. Blank on the floor, sign-off and tickets (191): `pm` 53, `signoff` 49, `tasks` 23, `lockout` 22, `account` 35, `live-board` 3, `app-update` 3, `desk-wide` 2, `closes` 1. Blank on the admin and settings screens (389): `plant` 162, `people` 76, `lists` 66, `audit` 43, `company` 33, `crud` 9. Blank on analytics (629): the eight `analytics*` namespaces. Assumption for Nimish to confirm: "floor and desk" covers the first two blank groups (580 blank); the analytics screens stay English in v1.

**25 Live board and alerts** · Blocked by: 12, 16

1. [Browser] The TV board shows the same tickets as Open and refreshes every 30 seconds; the WhatsApp share text matches `v3.views.06, 08`.
2. [Browser] New-breakdown and complaint-fixed push go through the existing push module's one send call (32 later takes it over; no second path); the account sheet works; the update banner waits out the shift changeover; floor and desk install as two apps.

**26 Hardened** · Blocked by: 13, 16, 25 · External: security reviewer signs off ASVS L1 and the DPDP checklist (N10)

1. [API] Login and `/brand` are rate-limited per client; a session cannot cross tenants; `/files/{id}` serves stored PDFs and logos with a permission check; a common password is refused; a high-severity dependency advisory fails CI.
2. [Browser] Open and Live render in under 2 seconds on a cheap Android over 3G on staging; `/state` p95 is under 300 ms on a 500-machine fixture.

**27 Usability round** · Blocked by: 14, 15, 16, 17, 18 · External: sessions (N15)

1. [Browser] 5 operators and 3 technicians run the floor and desk journeys on staging; times and errors are recorded against each journey spec; 5 of 5 operators raise a breakdown unaided.
2. [Browser] Each stumble fixed here first becomes a failing journey, then passes; at most five are fixed, the rest are filed as issues.

**28 Cutover** · Blocked by: 14, 15–27, 68, 78, 97, 98 · External: N7

1. [API] Production runs and a deploy outside 05:00–08:00 IST is refused by the pipeline; a production restore drill at most 7 days old, with equal row counts, is executed and logged.
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

**50 PM calendar and compliance** · Blocked by: 49; the calendar screen (50c) also by 85, the page templates (Ruling, 19 Nov: 50c is built on a template, and 87 only restyles it; so the M4b gate, 53, 54 and 50c, waits for 85 but not for waves 86–89, and M6 waits for the M4b gate)

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

**71 Real Claude provider** · `done` · Blocked by: 55 · merged with 55b and 55c (slice `docs/slices/55.md`, tests 16–49)

1. [API] Done: the server calls Claude through `AiProvider` on staging (a fake answers when no key is set); the redactor strips names, usernames, phone numbers and the plant's name before any text is sent; a monthly spend cap stops the calls; a failed call retries, and one answer is stored per subject (`changes/84-ai-foundation-schema-redaction.md`, `85-ai-provider-claude.md`, `86-ai-suggest-job.md`, `87-ai-key-only.md`).
2. [API] Done: logs never hold a prompt or an answer; a real call in production stays refused until the residency record, Cosmos's consent (N14) and signed terms are in place (55 goal 2).

**72 Diagnosis on the ticket** · Blocked by: 55 (its `ai_suggestion` table, provider and `ai.suggest` job, all merged; 55's purge, erasure and `document` tables are not needed here) and, for going live, 56 · External: a diagnosis threshold, a number Nimish adds to N19 · plan `docs/slices/72.md`

1. [API] Done (72a, 72b and the queue): a stopped report queues exactly 1 diagnosis job; a support ticket, an upgrade and a replayed report queue 0 more; in production nothing is queued without a key, a residency record, consent and a cap (`apps/server/test/ai-diagnosis-queue.test.ts`).
2. [API] Done: the stored shadow answer holds a safety flag and at most 3 likely causes, each citing past tickets of this machine or its same-model machines that the tenant can still see, or marked a guess; at most 25 past tickets reach the model, redacted (`ai-diagnosis.test.ts`, `ai-diagnosis-rules.test.ts`).
3. [API] Todo (72c): `GET /api/v1/tickets/:id/diagnosis` answers 200 to a supervisor, head and admin and 403 to a technician, operator, plant head and board; 404 for an unknown or other-tenant ticket; in production a `shadow` row reads as none (slice tests 27–31, 33).
4. [Browser] Todo (72c): on staging a supervisor, head or admin opening the ticket sees the lockout line first, then the causes, then the evidence, first check and expected fix; a technician sees no card and sends 0 requests to `/diagnosis` (slice tests 34–35).
5. [API] Live per tenant only above the diagnosis threshold, measured in shadow by 56's harness; below it the card shows on staging only. The threshold is not yet set (N19).

## V0 — Truth and pipes

**73 The plan tells the truth** · Blocked by: none
Delivers: one tracker that matches `main`, and a check that keeps it so.

1. [Process] This file, `docs/HANDOFF.md` and the ledger agree with `main`: 0 tracker rows contradict a merged commit (18 rows were wrong on 19 Nov).
2. [Process] `pnpm docs:check` fails when `main` holds a `feat(NN…)` commit and ticket NN's row still says `todo`; proven by one planted row. Honest limit: this catches `todo` rows only. A stale `in progress` row is caught by the milestone gate report, which states the rows were reconciled against the code (rule 6), not by this check.

**74 Pipes proven** · Blocked by: 73
Delivers: every merge is tested again, and staging runs what `main` holds.

1. [Process] Ruling R10 is withdrawn: 0 merges without a green CI run on the pull request; the full suite is green on `main` (2,803 tests was the last local count).
2. [API] Staging's health answer names `main`'s commit and migration 15 of 15; the weekly dump runs, and one dump is restored into an empty database with equal row counts on the ten largest tables (drill B, never yet run).

## E — Engine at history scale

**75 Figures are served, not recomputed** · Blocked by: 74
Delivers: a head opening analytics no longer stalls the floor.
Ruling, 19 Nov: 75 and 76 both rewrite `packages/domain/src/analytics`, so they run 76 then 75, and together only if the file lists in their two plans are disjoint.

1. [API] `GET /analytics/figures` answers in ≤ 300 ms (p95) on a 10,000-row plant with 30 concurrent readers, and a test counts 0 engine runs inside a figures read: `POST /analytics/run` and the nightly job are the only callers of the engine (today: one full run per request, 2.8 s at 1,350 rows).
2. [Engine] One full run of the 51 figures takes ≤ 20 s on 10,000 rows (30.5 s at 13,500 rows today; the forecast simulation is about 60 % of it).
3. [API] A ticket closed now is in the served figures within 5 minutes; the workbook, both report PDFs and every drill read the same stored run.

**76 The engine reads many years** · Blocked by: 74
Delivers: five years of history give five years of figures, not one year's figures inflated.
Ruling, 19 Nov: runs before 75 unless the two plans' file lists are disjoint (see 75).

1. [Engine] Every figure takes an explicit period. On a hand-computed two-year fixture (at least 200 rows, one month with no records) 100 % of the period figures equal the hand values.
2. [Engine] 0 figures bucket by month number alone or divide many years' downtime by one year's hours (9 such sites; re-read on 19 Nov and listed in the ledger's correction of that day. 3 more places are one year by design, the annual report, PM compliance and the breakdown map, and take their period under goal 1). A month with no records prints "no records", never 0.
3. [Engine] The 2026 answer key stays whole: parity 0 problems and no done row regresses, no test edited.
4. [Engine] (76x, the history-gap tail; added 19 Nov, packets 76a–76y merged) Three leftovers are closed with hand values on the two-year fixture: the Forecast Lab's exposure days count 0 no-records days (`forecast-lab-sim.ts`), the 90/180-day health trends in Team Focus and Compare scale each window by its observed days (a fixture with a gap inside the latest 180 days), and `cellFrac` stops counting a gap month's days. Until then "history figures count a no-records month as observed time" stays written in the ledger.

**77 Machines out of production data** · Blocked by: 74 (77a); 85 (77b)
Delivers: Bhavin's setting — a spare-capacity machine is recorded but does not move the plant's figures.
Ruling, 19 Nov: two parts. 77a is the API and engine part (backend lane); 77b is the screen part (frontend lane, after 85). Stage E's gate counts 77a; 77b closes with F.

1. [Browser] (77b) An admin marks any machine "not counted in production data" on the machine settings screen; the dashboard prints how many are excluded.
2. [Engine] (77a) With five machines excluded, their breakdowns count in 0 of BD %, MTTR, MTBF and availability, and in 2 of 2 of manpower hours and the energy list; hand-computed fixture.
3. [API] (77a) Changing the setting writes 1 audit row, and the figures read reports how many machines are excluded.

**78 Failed jobs are seen** · Blocked by: 74 (78a); 85 (78b)
Delivers: ticket 35's first goal, carried twice and never built.
Ruling, 19 Nov: two parts. 78a is the API part (backend lane); 78b is the screen part (frontend lane, after 85). Stage E's gate counts 78a; 78b closes with F.

1. [API] (78a) A planted failing job is in the failed-jobs list within 60 s with its error, and the retry command runs it once.
2. [API] (78a) The same failure raises the alarm within 5 minutes; a timer more than 2 minutes late raises it too; 0 job handlers fail without a log line (a check counts them).
3. [Browser] (78b) The planted failure appears on the failed-jobs screen within 60 s with its error, and Retry runs it once.

**79 Validation on the whole database** · Blocked by: 75, 76
Delivers: D34 — one command that tests every figure on every ticket the plant holds.

1. [API] `pnpm validate:full` on staging runs the 51 figures for every year and month with records and reports: tickets read (100 % of the database), figures run, mismatches against each reference, and the time each took.
2. [API] Its references are the 2026 answer key (exact), the legacy workbooks' own summary sheets (ticket 69) and the ten figures Nimish spot-checks against Bhavin's platform; it prints counts and machine codes only, never a name.
3. [Process] It runs nightly, from a scheduled workflow in `.github/workflows/` (a new `validate-full.yml`, beside `backup.yml`); a red nightly run is a required status check on every pull request until the nightly run is green again, carried by `.github/workflows/ci.yml` (`pnpm main:check` runs after a merge, Q15, so it cannot be the gate; this is a plan, nothing is built); a ticket under rule 2 links its green run. `docs/TESTING.md` gains D34's nightly whole-database gate in its layers table.

## H — History in

**69 Legacy history 2022–2025** · Blocked by: 76; 79 for the staging load (69d) only · External: N16, N17 (switches with defaults, nothing waits)
Delivers: every workbook year Bhavin holds, as closed history. `docs/slices/69-legacy-history.md` is re-planned first; its 19 Nov amendment holds the measured facts.

1. [API] The 19 workbooks (2022: 4, 2023: 5, 2024: 5, 2025: 5) convert with 0 rows unaccounted: dated source rows = loaded + excluded, every exclusion counted under a named reason.
2. [API] A row dated in another year loads under its own date unless that year's workbook already holds it (about 75 late-2022 rows live only in the 2023 workbooks); each is listed for Bhavin.
3. [API] A power or air failure is one plant event with its machines and hours, not one breakdown per machine: 2023's roughly 1,820 utility rows become roughly 150 event-days and add 0 to any breakdown count. Ruling, 19 Nov: 69's re-plan names the home of a plant event from `docs/DATA-MAP.md` and D17, preferring an existing table; a new table needs the PR to say why no existing table fits (CLAUDE.md), and it would exceed D17's budget (this plan already adds its 12), so it also needs a D17 amendment. Ticket 91 reads the same home. Tickets 69 and 91 are not built before the home is named; if no existing table fits (`docs/DATA-MAP.md` defines a ticket as single-machine and `ticket_event` as ticket history), the first packet of 69's re-plan records the D17 amendment.
4. [API] 0 codes with a meaning in the workbooks' own legend are folded into MIS: TR, T, FS, MS, NI, PP, CP, PAR, PC and HM load as switched-off codes that still show on old reports (ticket 47's rule).
5. [API] For 100 % of the machine-months on the workbooks' MTTR and MTBF sheets, the recomputed count and hours equal the sheet, or the pair is printed on the named-difference list; 0 unexplained.
6. [API] 0 personal names in any stored text (sentinel test); a second run of the same files adds 0 rows; February and March 2022 show no records (held out as a gap, 22 rows) until N17 answers.

## F — Frontend rebuild

Every ticket here holds three constants: all browser journeys stay green (317 passed at the M4a gate), axe reports 0 violations, and each screen change shows its 360 px before and after.

**80 Design foundations** · Blocked by: 73
Delivers: the design file everything else is built from. No application code.

1. [Process] `PRODUCT.md` (via `impeccable init`) names each user, device and setting; a new `docs/DESIGN.md` replaces the 22-line one and defines 100 % of the roles later tickets use: colour, four status tones, type, space, depth, motion, icons, charts, density for phone, laptop and TV, light and dark.
2. [Process] D04, D27 and `docs/design/LOCK.md` are amended under D33; approval moves from one mockup per screen to one per template, so `CLAUDE.md` (its line "Screens are built only from mockups Nimish approved") and `docs/design/LOCK.md` are amended to "one approved mockup per template" (D33 §4; this ticket's PR makes the `CLAUDE.md` edit with Nimish's go); Emil Kowalski's skills are installed with their licence in `THIRD_PARTY.md`.
3. [Browser] Three directions of the same three screens (Today, a machine page, Breakdowns) at 360 and 1440 px sit behind the `prototype` picker; Nimish picks 1.

**81 Tokens** · Blocked by: 80 (Nimish's pick)

1. [Browser] Every colour, size, radius and shadow is a named token in light and dark: 4 status tones each with ink, tint and fill; a chart palette of 8 categorical colours, 1 sequential and 1 diverging ramp; 3 depth levels.
2. [Browser] 100 % of ink-on-tint pairs reach 4.5:1 and chart marks 3:1 (`tokens.test`); the 70 gallery baselines are regenerated once, in this ticket only.

**82 Meaning map and its guard** · Blocked by: 81

1. [Browser] One table gives tone, icon, word, unit and good direction for 100 % of statuses, severities and the 51 figures; a percentage prints `%`.
2. [Process] `pnpm ui:check` covers `screens/` and `components/`: 0 raw colours and 0 hand-written card classes (57 copies in 39 files today). It warns from this ticket and fails from the end of 87.

**83 Elements** · Blocked by: 82

1. [Browser] Thirteen elements exist in the kit, each with a gallery section at 360 and 1440 px, light and dark: KPI tile, status chip, sparkline, trend delta, heat grid, ranked list, timeline, insight banner, empty, loading and error states, data table, period picker, grouped navigation, drill trail.
2. [Browser] Each passes `break-ui` with 0 overflow or clipped text on a 40-character Gujarati label, a 7-digit number and 0 items; every tap target is at least 44 px.
3. [Browser] The data table pages, sorts and filters: no list paints more than 50 rows first (the Breakdown Log paints 1,343 today), and a list that can pass 200 rows pages on the server.

**84 Charts** · Blocked by: 81

1. [Browser] The one chart door draws stacked and horizontal bars, lines, scatter, heatmap and Pareto with a legend and a tooltip, in the 8-colour palette; `use-chart.ts` is split so no file passes 400 lines (394 today).
2. [Browser] 100 % of charts keep "Show the numbers"; the sum of the chunks `use-chart.ts` loads (the 8 lazy chunks behind its four `echarts/*` imports), each gzipped at level 6 (`gzip -6`), does not grow by more than 15 % from the baseline measured in ticket 81's PR; reduced motion draws with no animation. Baseline measured on 19 Nov with `pnpm build:web` at `58161f2`, in `gzip -6` bytes: the sum is 364,192 B and the largest single chunk is 83,894 B. Vite's own report (368.04 kB in all, 84.7 kB the largest) is a different unit and is not the baseline. The earlier "220 KB, 174 KB today" figure is withdrawn.

**85 Page templates** · Blocked by: 83, 84

1. [Browser] Five templates — overview, analysis, register, entity, work queue — each score ≥ 32 of 40 on `impeccable critique` with 0 P0, at 360 and 1440 px.
2. [Browser] A screen is a short description of its figures and layout: at least 19 of the 27 analytics screens (70 %) render from one with 0 markup of their own.

**86 Wave 1: every analytics figure** · Blocked by: 85

1. [Browser] 51 of 51 figures show unit and tone, and every figure that has a prior period shows its change against it (30 of the 51; the 21 exceptions are below); the 8 analytics groups use the grouped navigation; Nimish approves the before and after.

Exceptions, proposed on 19 Nov by reading `packages/domain/src/analytics/registry.ts` (51 keys), because they are a list, a state of now or a forecast with no earlier period: the six fleet counts (`dashboard.total-machines`, `utilities`, `dg-sets`, `cnc-machines`, `conventional-machines`, `process-machines`), `data-checklist`, `registers`, `cell-change-log`, `a7-footprint`, `a8-age`, `machine-page`, `breakdown-log`, `dashboard.bubble-chart`, `dashboard.expansion-timeline`, `action-center`, `action-center.spares-spend`, `fix-finder`, `forecast-lab`, `a9-bottleneck-forecast` and `reliability`. The ticket's plan confirms each one.

**87 Wave 2: the twelve analytical screens** · Blocked by: 86 (the PM calendar's screen was built earlier, in 50c on today's components; 87 restyles it and adds the keyboard "Move to date" that 50c lacks)

1. [Browser] Today, Action Center (with the accept button from 52), Team Focus, the machine page, the registers, Breakdowns, the forecast, Money, Reports, Energy, the PM calendar and the Guide are rebuilt on templates (the PM calendar already stands on one from 50c); each scores ≥ 32 of 40 with 0 P0; Nimish approves each.
2. [Process] `ui:check` now fails on a raw colour or a hand-written card anywhere in `screens/`.
3. [Browser] Every job that can be moved on the PM calendar has a keyboard "Move to date" control (0 jobs are movable by drag only); a journey moves one job with the keyboard alone.

**88 Wave 3: desk, ticket, board, settings** · Blocked by: 82

1. [Browser] The new tokens reach the desk lists, the ticket detail, the live board and TV, and every settings screen with 0 changes to flow, order, button position or words; the 70 gallery baselines and every desk journey pass.
2. [Browser] Measure 4 covers the desk as well as the floor: a check renders Bhavin's desk views (`docs/discovery/bhavin-v3/maint.html`: the Open, Mine, Team and needs-report lists, the ticket detail with its action bar, and the live board) and ours at 360 × 740 and 1440 × 900 px, and finds 100 % of controls in the same order and the same third of the screen. Settings screens have no v3 view and are not checked.

**89 Wave 4: the floor phone** · Blocked by: 83

1. [Browser] A check renders Bhavin's phone tool and ours at 360 × 740 px for every floor workflow (report a breakdown, other work, my complaints, PM job, sign-off) and finds 100 % of controls in the same order and the same third of the screen.
2. [Browser] The `mobile-native` list has 0 open items (no input zoom, no 100vh jump, safe areas, no stuck hover, no tap flash); primary buttons stay 52 px; the floor journey passes in Gujarati and in dark.

## I — Intelligence

Each figure here reconciles to its rows (the drill's sum equals the figure, 100 %), has a Guide entry, and is `done` only on a green `validate:full`.

**90 Year on year and seasonality** · Blocked by: 69, 76

1. [Engine] Breakdowns, hours, MTTR and MTBF by year and by month for every machine, cell and category across 2022–2026; a hand-computed fixture agrees; a gap month is shown as a gap.

**91 Utility loss** · Blocked by: 69

1. [Engine] Machine-hours and rupees lost to power and air failures by month, from the plant events of 69 (the home 69's re-plan names); 2023's total equals the workbooks' own UTI-hours sum (about 1,480 h, to be confirmed by the load).

**92 Reliability on five years** · Blocked by: 67, 69

1. [Engine] The fit of ticket 67 reads the whole history: 100 % of machines with at least 10 failures get their own fit, the rest their category's; failures by machine age use the purchase year.

**93 The forecast, proven** · Blocked by: 52, 69

1. [Engine] The monthly forecast is replayed for every month from January 2023 to October 2026 (at least 40 months) and its hit rate is printed with its denominator; when the 80 % band holds fewer than 70 % of outcomes, the screen says "low confidence".

**94 Which fix held** · Blocked by: 69

1. [Engine] For the 20 most repeated problems in each category: each corrective action, how many times it was used and the median days until the problem returned; every line drills to its tickets.

**95 PM effectiveness** · Blocked by: 54, 69

1. [Engine] PM hours per machine against the breakdown hours of the next 90 days, 2022–2026, judged through ticket 54's control-group rule.

**96 Subsystem and controller trends** · Blocked by: 69

1. [Engine] Yearly hours and counts for turret, spindle, tool changer, axis and lubrication, and for Fanuc against Mitsubishi systems, from the real codes kept in 69.

## P — Production

Tickets 24, 26, 27, 28 and 68 (M1) finish here; 28 now also waits for 78, 97 and 98.

**97 Production stack** · Blocked by: 74 · External: N7

1. [API] Production is its own stack: its own secrets, deletion protection on, the history-owner role of D24 §3 in place, and 0 secrets a Terraform apply can erase (planted apply on staging).
2. [API] The site sends CSP, HSTS and frame headers; base images are pinned; a deploy outside 05:00–08:00 IST is refused (the only allowed window: SPEC, ARCHITECTURE, INFRASTRUCTURE and ticket 28); one deploy and one rollback are run and logged.
3. [Process] The repository returns to private before cutover (ticket 28 waits for this ticket) only once GitHub Actions billing is fixed: private-repository Actions was refused runners on 13 Nov (a $0 budget) and stopped or stalled on 14 and 18 Nov for causes the ledger does not confirm, which is why R10 existed. Until then it stays public and nothing waits on it (Nimish, 19 Nov). Proved by a green CI run on a pull request after the switch. Moved here from 74, which blocks the E stage and cannot wait for cutover.

**98 Load proof on the whole database** · Blocked by: 69, 75

1. [API] Thirty simulated users for 30 minutes on staging with every year loaded: `/state` and figures p95 ≤ 300 ms, 0 errors, the connection pool never exhausted.
2. [Browser] Open and Live paint in under 2 s on the low-end Android profile (ticket 26's second goal, measured at last).

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

| Window  | Parallel tickets                                                                                                                                                                                                                                                                                                           |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start   | 02, 08, 10, 13 (after 01)                                                                                                                                                                                                                                                                                                  |
| M0      | 04, 05, 06 after 03; 11 after 04 and 10; 07 then 09; 14 last                                                                                                                                                                                                                                                               |
| M1      | 15 and 16; then 17 → 18 → 19 with 20; then 21, 22, 23, 25 together; 24, 26, 27                                                                                                                                                                                                                                             |
| M2      | 30 and 32 after 29; then 31, 34 and 66; 33; 35                                                                                                                                                                                                                                                                             |
| M4a     | 38, 39, 40, 41 after 37; then 42 and 43; then 44 and 45                                                                                                                                                                                                                                                                    |
| M4b     | 47, 49, 51, 52 after 46; then 48 and 50 (but 50c, the calendar screen, after 85); then 53, 54 and 67; the M4b gate (53, 54, 50c) waits for 85 and not for waves 86–89, and M6 waits for that gate                                                                                                                          |
| M6 / M3 | 57–60 after 56; 62 after 61, then 63 → 64 → 65                                                                                                                                                                                                                                                                             |
| V0      | 73, then 74                                                                                                                                                                                                                                                                                                                |
| E / H   | At most two backend builders at once (CLAUDE.md): two of 76, 75, 77a and 78a, or one of them with 69's converter. 76 comes before 75 (both rewrite `packages/domain/src/analytics`; together only if their plans' file lists are disjoint). 79 after 75 and 76; 69's load after 79. 77b and 78b are frontend work after 85 |
| F       | 80 after 73; 81; then 82 and 84; 83; 85; then 50c, 77b and 78b; waves 86 → 87, with 88 and 89 beside them                                                                                                                                                                                                                  |
| I / P   | 90–96 after 69 (two at a time); 97 after 74; 98 after 69 and 75; then 27; 28 last, after 78, 97 and 98                                                                                                                                                                                                                     |

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
