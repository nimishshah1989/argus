# Parity checklist

Everything Bhavin's two tools do today. The product is not ready for Cosmos until every "keep" row here has a working screen and a test.

## 1. Bhavin's ticket app, version 3

Source: the full page source (`app.js` 1,654 lines, `ref.js`, `voice.js`, build `10.4 · 6 Nov 2026`) and the live system on 9 November. The line-referenced inventory (about 7,600 words) is `docs/discovery/bhavin-v3/INVENTORY.md` in the pack. **Keep** = same behaviour; **Improve** = same behaviour plus a listed change; **Replace** = same job, different mechanism; **Drop** = not carried, with reason.

**Sign-in, roles, identity**

| Feature today | Ours | Milestone |
| --- | --- | --- |
| Username and password; 30-day sliding session; "Show password"; last username remembered | Keep; Argon2id; sessions table; device list and revoke | M0 |
| Five roles: report, maint, supervisor, admin, board; role decides the screens | Keep; add maintenance head and plant head; checks move to the server | M0 |
| Personal login records its name; shared phone asks who is acting (team select on desk, free-text name plus role chip on floor) | Improve: acting person chosen from the plant's people, never free text | M0 |
| Change password (min 6); other phones signed out | Keep; min 8 with common-password check | M0 |
| Any 401 signs the phone out with a message | Keep | M0 |
| Company id and API address from the link or the page, saved on the phone | Replace: tenant from the session, served per tenant; no URL overrides | M0 |
| `/api/brand` public with company and logo | Keep, rate-limited | M0 |

**Reporting (floor and desk)**

| Feature today | Ours | Milestone |
| --- | --- | --- |
| Step 1 machine: search ignoring spaces and dashes, ranked exact, ends-with, contains; recent machines (last 5, 3 shown); segment sections with group tiles and counts; hint text per group | Keep | M1 |
| "Already reported. Tap to view the ticket." on a machine with an open ticket | Keep | M1 |
| Step 2 situation: Machine has stopped (downtime starts) or Running, needs support | Keep | M1 |
| Step 3 problem: textarea, quick chips (six defaults, configurable), mic "Speak in Gujarati", who is reporting (name and role) | Keep; chips and roles from lists | M1 |
| Pending-task warning on a machine that already has a task | Keep | M1 |
| Other work (not a machine): where (locations, cells, free text), type of work (eight defaults, configurable), what is needed, urgent | Keep | M1 |
| Maintenance raising a ticket can say "I am starting work on it now" | Keep (`self_started`) | M1 |
| Duplicate on send returns the existing ticket | Keep; also checked live while typing | M1 |
| Sent screen: ticket number, WhatsApp share, cancel own, report another, see my complaints, see live | Keep | M1 |
| Deep link `?m=VC-17` pre-selects a machine | Keep, as the QR per machine | M1, M3 |
| Gujarati dictation in Chrome; translate via relay, on-device, or public Google; the person checks the English | Replace: server transcription (Sarvam) and our glossary; the check step stays; no public translation service | M3 |

**Ticket actions (desk)**

| Feature today | Ours | Milestone |
| --- | --- | --- |
| Start work, back-dated in 5-minute steps to the report or transfer time, with response preview | Keep | M1 |
| Pick up transferred work (time counted from the transfer) | Keep | M1 |
| Post update with text, spare, expected date | Keep | M1 |
| Pause: six reasons, note, expected back, assign to; repair stops, downtime continues (feature flag) | Keep | M1 |
| Resume; second tap if assigned to someone else | Keep | M1 |
| Transfer with handover note and optional target or next shift; ticket back to open as handed over | Keep | M1 |
| Join as primary or support; add a person (lead); per-person time, job time not doubled | Keep | M1 |
| Leave with reason; primary takes over if the lead leaves | Keep | M1 |
| Machine running again (downtime stops, amber, ticket open); machine stopped again (clock restarts) | Keep | M1 |
| Write report and close (pre-screen with times, finish time adjust, pending task) | Keep | M1 |
| Close without report (reason) with 7-day "needs report" list and late report | Keep | M1 |
| Mark done for work requests and tasks; machine-stopped minutes for a task | Keep | M1 |
| Cancel with reason (desk any; floor own un-started) | Keep | M1 |
| Admin restore within 7 days | Keep | M1 |
| Admin correction: reported, started, closed times, started by, closed by, work and waiting minutes, problem; reason; arithmetic warnings; history entry | Keep; old and new values stored | M1 |
| Report only (PDF without a ticket) | Keep, as a form that creates a closed imported ticket so nothing lives outside the system | M1 |
| Pending tasks: left at close with reason and expected date; Tasks tab; follow-up boxes pending, in progress, overdue, done | Keep | M1 |
| Who may close: lead, a primary, supervisor, admin; shared phone anyone | Keep, server-side | M1 |

**Views**

| Feature today | Ours | Milestone |
| --- | --- | --- |
| Open: counts strip (Down, Waiting, Support, Running OK), Team now, tabs Breakdowns, Tasks, Work; sorting rules; "Closed without a report" block | Keep | M1 |
| Ticket card: type line, problem, reported by and when, elapsed, actions by state, WhatsApp | Keep | M1 |
| Ticket detail sheet: facts, full history, people and minutes, follow-up, WhatsApp full text, admin edit | Keep | M1 |
| Mine: in-progress for me (or everyone on a shared phone), waiting assigned to me, closed 30 days, day report | Keep; Mine badge counts crew too (today it does not) | M1 |
| Team: working now by person, waiting, not started, cancelled 24 hours, closed 30 days with monthly totals per person (primary and support split) | Keep | M1 |
| Live board: tiles by segment and group, counts, filter chips, search, work-request footer, tap for machine sheet | Keep | M1 |
| My complaints (floor): open with status chips, fixed or cancelled 24 hours, cancel | Keep; add confirm or dispute (M2) | M1, M2 |
| Account sheet: name, role, change password, alerts, team guide, update now, app version | Keep | M1 |
| "Ticket closed" stats screen | Drop: dead code, never reached | — |

**Reports and PDFs**

| Feature today | Ours | Milestone |
| --- | --- | --- |
| Breakdown report form: machine, date, shift, problem, observed by, corrective action, done by and supported by chips, downtime, category, response, repair, code, spare, signature, handover name; validation messages | Keep; add root cause (displayed today but never written) | M1 |
| Breakdown PDF: title, QR for the platform, fields, ticket facts block, timeline page, signature, file name `Breakdown_<machine>_<date>.pdf` | Improve: rendered on the server, stored, Gujarati text renders; QR kept for the transition, dropped once the platform is ours | M1 |
| Day report PDF: person or team, day or shift, stats boxes, jobs table, per-person totals, pending at end; share or save | Improve: server-rendered; window is the shift length, not 24 hours | M1 |
| PDF never uploaded, only its name | Replace: PDF stored in S3 and linked to the ticket | M1 |

**Alerts, offline, platform**

| Feature today | Ours | Milestone |
| --- | --- | --- |
| Web push: new breakdown (maintenance), complaint fixed (floor); iOS install guidance; test alert; re-subscribe when the acting name changes | Keep | M1 |
| WhatsApp share button with short status text and full history text (3,500-character cap) | Keep the text; add real sending in M3 | M1, M3 |
| 30-second refresh when visible, refresh on focus, server clock skew, soft re-render that never interrupts typing | Keep | M1 |
| Cached state and config for offline reading; offline queue for closes replayed with the chosen time | Keep | M1 |
| Update banner when a new build is deployed; "Update now" clears caches | Keep | M1 |
| Config fingerprint check; settings pushed from the desktop platform | Replace: settings screens in our app; fingerprint kept for cache invalidation | M0 |
| Feature flags `general`, `pause`; lists for wait reasons, work types, quick problems, reporters; segments, groups, group names, show and group-by per segment; shift times; team shifts; glossary; language | Keep all as configuration | M0 |
| Utility machines hidden by a hard-coded regex when no groups are configured | Replace: hidden flag on the group | M0 |

**Not carried (with reason):** public Google Translate fallback (data leaves the platform); API base and company id from URL parameters (phishing risk); free-text names (replaced by people); client-only role checks (server checks); 24-hour day-report window (shift length instead).

## 2. Bhavin's analytics platform

Source: the single-file HTML (data embedded at lines 533 to 540; Guide at lines 3473 to 3796) and our four-part inventory (`docs/discovery/prototype-inventory/part1..4.md`, about 39,000 words with line numbers for every formula). Every screen below is reproduced in the Analytics face; every calculation is ported into `packages/engine` with a legacy mode that must match the answer-key fixtures exactly. **A newer version of the platform exists** (it now has Settings > People & access and pushes configuration to the phones); Bhavin must send the current file before M4 starts, and this list is re-checked against it.

**Registers and master data**

| Screen or calculation | Ours |
| --- | --- |
| Dashboard: KPI tiles, bubble chart, register summaries, mixed all-years and latest-year figures | Keep; label every figure with its period (the mix is a known confusion) |
| CNC machines register with controller split and make split; Robots; Conventional, Process, Utilities; DG sets with kVA | Keep as one Machines screen filtered by segment; nameplate fields in `machine` |
| Machine form, move-cell form, cell change log with export and edit | Keep; moves become effective-dated `machine_move` rows |
| Footprint (A7) packing, expansion timeline, age analysis (A8) and age drill | Keep (M4) |
| Settings page: company, hours per day and days per year, cost per hour, thresholds, team, codes, categories; settings sync preview | Replace with the Settings face and the settings cascade; same values |
| Data Checklist page (what is missing or inconsistent) | Keep; becomes the data-quality agent's first rule set |

**Breakdown history and analysis**

| Screen or calculation | Ours |
| --- | --- |
| Breakdown log with filters; breakdown form; downtime conversions; classification rules including NO DT (repaired outside production hours, zero lost hours) | Keep; NO DT stays its own case; new breakdowns come from closed tickets, not typing |
| PDF import of the breakdown report via QR (preview, apply) | Keep through the transition; unnecessary once tickets create reports |
| A1 BD percent and PM split; A2 by category and cell with detail; A3 MTTR and MTBF with machine table; A4 manpower; A5 energy heatmap; heat-grid components | Keep all; A3 gains a shift-calendar basis as a second, labelled figure |
| A6 Why-Why root-cause analysis with candidate selection | Keep; later linked to recurrence checks |
| A9 Bottleneck analysis with scoring, downtime forecast for planning, Laplace trend test, repeat faults | Keep; these are differentiators |
| A10 Problem analysis with charts; table sorting | Keep |
| Drill-down system (any figure to its rows) | Keep; every number on every screen drills to its tickets |
| Compare machines with age-adjusted health score; Team Focus; Money Matters (cost per hour, turnover impact) | Keep; money figures visible only to head, plant head and admin |
| Fix Finder ranking (similar past fixes) | Keep; grows into the retrieval agent in M6 |
| Action Center: rule-based nudges (13 alert types in the inventory's count) | Keep the rules as the first version of the nudge engine; each nudge becomes an inspection or work ticket when accepted |
| Monthly and annual maintenance reports with PDF export | Keep; server-rendered; scheduled sending (M3) |
| Excel import and export of the whole data set | Keep export; import becomes the importer (M5) with the same mapping as its first case |

**Forecasting (Forecast Lab and Planning forecast)**

| Calculation | Ours |
| --- | --- |
| Machine rate pooled with category rate (180-day prior, an empirical-Bayes idea); repeat entries merged into episodes | Keep exactly in legacy mode; hierarchical model as the first improvement, judged on the backtest |
| 2,000-run Monte Carlo (seeded `mulberry32`) for 80 percent and 90 percent plan-for hours; risk bands Hot, Likely, Watch, Stable | Keep; the seed and generator are part of the port so numbers match |
| Forecast Lab backtest | Keep; becomes the standing scorecard |
| Per-machine fits shown only above about 5 to 8 failures; class figure below | Keep; thresholds verified on real data and recorded |

**Guide page.** Reproduced as the in-app Guide with the same explanations, updated wherever a definition changes; every KPI tile links to its Guide entry.

**Known issues carried into the backlog, not into the product:** the hard-coded Cosmos constants (document numbers, 20 hours by 300 days, robot exclusion, English keyword lists, team and code clean-up lists), the data-quality patches, and the bugs listed in each inventory part's section 6.

## 3. Master data to carry over (Cosmos)

Read from the live phone configuration on 9 November 2026 and from the platform export of 28 October. The live configuration wins where they differ; the seed script records the source of every row.

| List | Live value (9 Nov) | Notes |
| --- | --- | --- |
| Machines | 192 on the phones (191 in the 28 Oct export) | Fields on the phone: id, category, cell, seg. The platform export adds make, model, serial, controller, year, purchase date, power, location, cell, asset code, kVA |
| Segments | CNC, Conventional, Process, Utility, DG, Robot | Default order and names as in the app; show and group-by per segment are settings |
| Groups (CNC by prefix) | VC Vertical Machining Center, TC Turning Center, VTL Vertical Turning Lathe, GRD grinding, TMC Turnmill, HMC, DCMC, S sliding head, CAM, WJ WaterJet, Robot | From the 28 Oct export: 125 CNC machines; verify against the live list |
| Groups (other segments by category) | Conventional 16 (Bandsaw, Drilling, Lathe, Hydraulic Press, Broaching, Circular, Plate cutting); Process 17 (Ultrasonic Washing, Blasting, Marking, Magnetic Deburring, Polishing, HTP, Laser, Helium, Copper spray); Utility 30 (Stabilizer, Air Dryer, Air Compressor, Air Receiver Tank, UPS); DG 3 | Counts from the export |
| Shifts | 1, 2, 3 | Shift times are in the phone config (`shiftTimes`); to be exported with Bhavin's login |
| Team | 14 people on the phones; 15 names appear in this month's closed jobs | Names become `person` rows; one vendor team appears as a person today and becomes a vendor contact |
| Observed-by roles | Operator, Setter, Supervisor, Engineer | `list_item` list `observed_by` |
| Breakdown categories | E, M, E/M, PM |  |
| Maintenance codes | E, M, AX, SP, RT, ATC, PC, LB, CON, PM, HY, MIS, CHI, HUM, LIK, PNU, TUR, NO DT, RINT (19 live; the 28 Oct export also had ELE, HYD, ROT) | Keep both sets, mark the three as inactive; codes gain descriptions in Settings |
| Wait reasons | Waiting for spare; Sent to vendor for repair; Waiting for approval / PO; Waiting for utility (power, air); Machine not released by production; Other | `list_item` list `wait_reason`; vendor flag on the second |
| Work types | Electrical; Plumbing / water; Air line; Civil / building; Fabrication / welding; Installation / shifting; Material Collection; Other | Cosmos added "Material Collection" to the defaults |
| Quick problems | Not starting; Unusual noise; Alarm on screen; Coolant problem; Oil leak; Tool problem | Defaults; per plant |
| Task reasons | Waiting for spare; Waiting for vendor; Needs a planned stop; Other |  |
| Locations and cells | 7 locations (434, 435/4, 445, 486, 841-A, 841-B, 381) and cells 1 to 9 in the export; the live work requests also use "Workshop 5s", "841/2", "Cell1" | Free text today; becomes `list_item` with the live values added |
| Features | general on, pause on; floor Live board off | Settings |
| Language | Gujarati (gu-IN) for dictation | Tenant language |
| Ticket numbering | BD-0149 and WR-0098 reached by 9 November | Sequences continue from the imported maximum |

**Collected from the live configuration on 9 November** (saved as `docs/discovery/bhavin-v3/live-config-2026-11-09.json`): shift windows are two, not three: shift 1 08:00 to 18:30 and shift 2 18:29 to 05:00, while the report form still lists shifts 1, 2, 3 (ask Bhavin which is right); team shifts for 13 of 14 people; a glossary of about 90 English misspelling corrections (for example "bering" to "bearing", "spindal" to "spindle") and about 60 Gujarati-script terms mapped to English (for example સ્પિંડલ to spindle); no group names, groups or segment overrides are set, so the app's defaults apply; the one machine added since the 28 October export is VC-57. **Still to collect:** the people list with roles and which logins are shared (only visible to an admin in the platform), and the full nameplate fields for VC-57.
