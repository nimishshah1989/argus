# Maintenance OS — Build Specification v1

Nov 9, 2026 · @Nimish Shah

The document a Claude Code session starts from. It supersedes the build-plan sections of "Core Product & Build Spec" (28 Oct); the research brief and capability matrix stay as background.

## 0. Stack decision

**Decided (Nimish, 9 November): we build our own TypeScript stack around Bhavin's ticket model; the Atlas fork becomes a reference we read, not a codebase we ship.** On 28 October I backed the Atlas fork. Bhavin's version 3 (built 6 November) changes the facts, and I would be doing you a disservice to keep the old answer.

**What changed**

1. **The ticket core already exists and is proven with operators.** Version 3 has sign-in with four roles, personal and shared-phone logins, a ticket timeline, pause and resume with reasons, transfer, crews (join as primary or support, per-person work time), "machine running again" with downtime that stops and restarts, follow-up tasks as child tickets, admin corrections with reasons kept in history, cancellation and restore, day reports and breakdown PDFs, push alerts, offline caching and in-app updates. Its data model is richer than Atlas's work order and fits our loop better. Porting it into Atlas's Java entities would lose fidelity and take longer than porting it into our own schema.
2. **Everything Bhavin has written is JavaScript.** The analytics platform, the ticket app and the report form are all JS. Our analytics engine port was already going to be TypeScript. One language across the whole product is a large advantage when the code is written by AI agents and reviewed by a non-technical founder. The Atlas route meant Java plus Spring plus two React codebases plus our TypeScript services.
3. **What Atlas gave us is smaller than it looked.** The proof of concept found ten structural gaps (cells, effective-dated moves, shift-calendar KPIs, breakdown fields, phone identity, and so on). Its real value was CRUD for assets, PM, parts and purchase orders, which AI agents build quickly against a schema we control.
4. **No AGPL obligations, no upstream drift, no lawyer review of the licence boundary.** We still cannot copy Atlas code, but we can read it for design ideas; reading is allowed.

**What we lose:** Atlas's React Native mobile app (Bhavin's progressive web app approach serves the floor better and needs no app store), its parts and purchasing screens (Phase 2 to 3 for us anyway), SSO and white-label (built later if a customer asks).

**Recorded as decision record 0001.** This document is written for the TypeScript stack. Atlas's source stays in the discovery pack for reading only; the comparison that settled it:

|  | Own TypeScript stack (recommended) | Atlas fork |
| --- | --- | --- |
| Languages | TypeScript only | Java, TypeScript, two React variants |
| Ticket model | Bhavin's, ported as is | Re-expressed in Atlas work orders, with losses |
| Mobile | PWA (as Bhavin does today) | React Native app plus PWA |
| Licence | Ours | AGPLv3 fork, public source offer, legal review |
| Time to Cosmos parity | Shorter: port, do not translate | Longer: translate into another model, then patch gaps |
| Risk | We build CRUD ourselves | Upstream changes break our patches |

## 1. What we are building

A maintenance operating system for Indian factories, sold per plant. A breakdown is reported in three taps or a voice note (Gujarati, Hindi or English, on the phone or on WhatsApp), becomes a ticket with a named owner, two clocks and an escalation path, is closed with a coded report and signed off by production, and feeds analytics that forecast the next breakdown and prove whether maintenance is working.

- **First tenant:** Cosmos Engitech, about 150 machines across CNC, conventional, process, utility, DG and robot segments. Its data, people and both of Bhavin's tools are loaded on day one. Nothing is re-typed.
- **Second tenant:** a plant from a different industry, onboarded by configuration and import alone. That is the test that we built a product, not a Cosmos tool.
- **Users:** operators and technicians who do not use computers; supervisors and a maintenance head who live on their phones; a plant head who wants one scorecard a month.

**Principles**

1. The accountability loop ships first: report, own, clock, close, hand back. Analytics reads from it.
2. Every number the old tools show is reproduced exactly before any number is improved.
3. Everything plant-specific is configuration: machine segments, groups, shifts, codes, wait reasons, work types, SLA targets, roles. No Cosmos constant in code.
4. Phone first, offline tolerant; English and Gujarati from the start, Hindi when a plant needs it. A PWA, not an app store app.
5. AI suggests; a person confirms. Codes are selected from our lists; numbers come from code.

**Not building:** sensors or IoT in the first year, an ERP, a general helpdesk, 3D or BIM, "AI predictive maintenance" claims. Forecasting without sensors is a ranked risk from history, published with its hit-rate.

## 2. The goal post: parity with both of Bhavin's tools

The minimum product is everything Bhavin's two tools do today, on our stack, with Cosmos's data loaded. Not a feature less. The line-by-line list is in Parity checklist; this is the shape of it.

**Tool 1: the live ticket app (version 3, 6 November 2026).** Read from its full source and from the live system on 9 November. It is in daily use: about 150 breakdown tickets (BD-0001 onward) and about 100 work requests (WR-) since launch, 194 jobs closed in the last 30 days by 15 people, 192 machines on the board.

| Area | What it does today | Our stance |
| --- | --- | --- |
| Sign-in and roles | Username and password; five roles (report, maintenance, supervisor, admin, view board); personal logins record the name, shared phones ask who is acting; 30-day session; change password; sign out | Keep all. Move role checks to the server; add phone-number identity for WhatsApp |
| Reporting | Three taps: machine group, machine, stopped or needs support; search that ignores dashes and spaces; recent machines; quick problem chips; Gujarati dictation with English check; "Other work" requests with location, work type, urgency; duplicate detection on send | Keep the exact flow and copy |
| Ticket life | Start (back-datable to report time), post update with spare and expected date, pause with six wait reasons and assignment, resume (second tap if assigned to someone else), transfer with handover note, join as primary or support, leave with reason, machine running again and stopped again, close with report, close without report, mark done, late report, cancel, admin restore within 7 days, admin correction with reason and arithmetic checks | Keep every transition and its rules; they become the state machine in `packages/domain` |
| Follow-up tasks | A task left at close becomes a child ticket with expected date and reason; Tasks tab; overdue and done boxes on the parent; machine-stopped minutes asked when a task is done | Keep |
| Time accounting | Downtime counts only stopped periods; repair time excludes pauses and transfer waits; per-person work time via crew segments; response, waiting, vendor, follow-up minutes; server clock skew | Keep exactly (defined in the Domain model tab) |
| Views | Open (breakdowns, tasks, work), Mine, Team (working now, waiting, not started, cancelled 24h, closed 30 days with monthly totals per person), Live board by segment and group, My complaints for the floor, full ticket detail with timeline and people | Keep; restyle in the design system |
| Reports | Breakdown report PDF with QR for the platform, ticket facts block, timeline page, signature; day report PDF per person or team, by day or shift, with pending-at-end | Keep both; render server-side so they can be sent on WhatsApp and stored |
| Alerts and offline | Web push (new breakdown, complaint fixed), WhatsApp share text (short and full history), 30-second refresh, cached state and config, offline queue for closes, in-app update banner | Keep; replace the share button with real WhatsApp messages in M3 |
| Configuration | Company, logo, language, features on and off, wait reasons, work types, quick problems, segments, groups, shift times, team shifts, glossary; master data pushed from the platform | Becomes `packages/config` with a settings screen; no more pushing from a desktop HTML |

**Tool 2: the analytics platform (the single-file HTML).** Every screen, table, alert and forecast it shows is reproduced, with its Guide page (lines 3473 to 3796) as the written specification and our 39,000-word inventory as the checklist: dashboard KPIs, the A1 to A3 analysis tables, health scores, bad actors, forecasts with plan-for hours and risk bands, Action Center nudges, PM calendar with checklists and load spreading, cost views, ISO register exports, Excel import and export.

**How parity is proven.** Three tests, all automated where possible: (1) data: imported counts and totals match the source machine by machine; (2) numbers: at one frozen as-of date every figure the platform displays is reproduced exactly in legacy mode; (3) features: every row of the Parity checklist marked keep has a screen and a test. Differences we choose (for example availability on the shift calendar rather than 24 hours) are logged with old value, new value and reason.

**What parity does not mean.** Matching Bhavin's numbers makes them our starting point, not proof they are right. His forecasts rest on history that was never coded consistently; once ported we measure them and improve what the scorecard shows is weak. The inventory also lists his bugs and dead code; parity means matching intent, not defects.

## 3. Beyond the baseline: what we add to what Bhavin built

Bhavin's tools are the floor, not the ceiling. They record what happened; they do not chase anyone, do not reach WhatsApp, do not learn, and cannot be sold to a second plant. Below is what we add on top, layer by layer, each traced to what the global leaders (IBM Maximo, SAP, MaintainX, Limble, Fiix, UpKeep, Tractian) do and to the 110-row capability matrix in the research brief.

**Frontend and experience**

| What he has | What we add | Who does it well today |
| --- | --- | --- |
| One page per role, English labels, Chrome-only dictation | Three installable faces plus a TV board; Gujarati, Hindi and English throughout, including transliterated Gujarati in search and codes; offline reads and queued writes on any phone; a design system with status colours, large targets and one action per screen | MaintainX (29 languages, offline), Limble (offline) |
| Lists that refresh every 30 seconds | Live updates pushed to open screens; a Today view per role that shows only what needs that person now; every number drills to its tickets | Tractian, MaintainX |
| Admin edits by hand | Settings screens for every list, segment, shift, role and rule; a configuration audit trail | Limble, Fiix |
| PDFs built on the phone, English only | Server-rendered PDFs with Gujarati text, stored and shareable; scheduled reports by email and WhatsApp | eMaint, Cryotos |
| Machine tiles | Machine pages with nameplate, history, health, forecast and open tasks; a QR on every machine that opens its page or reports a problem; nameplate photo to machine record (M5) | MaintainX (Asset Snap), Limble |

**Workflow and accountability (the loop)**

| What he has | What we add | Who does it well today |
| --- | --- | --- |
| Tickets with owners and timelines | **Severity S1 to S4** from machine criticality and stopped or running; **SLA clocks** for acknowledge and restore; **escalation ladder** L1 to L4 and vendor, driven by a **duty roster**; a transferred ticket nobody picks up escalates by itself | IBM Maximo, MaintainX Enterprise, Limble, Keep Wisely |
| Closed by maintenance | **Production handback**: the reporter confirms or disputes on the phone or WhatsApp; a dispute reopens the same ticket; turnaround measured both ways | Nobody in the market we checked |
| Free-text problem and a code at close | **Failure coding**: component, failure mode, cause, action from our list, with AI suggesting the code from the words typed or spoken | IBM Maximo (Work Order Intelligence), SAP, Fiix Enterprise |
| Follow-up tasks | Approvals for spend and planned stops; vendor and contractor tickets shared outside the plant; shift handover log; skills and certifications on people; lockout checklist before electrical work | IBM, SAP, MaintainX, Limble, Coast |
| PM calendar in the platform | PM plans by time and meter with checklists; PM compliance and **PM effectiveness** against a control group; nested plans and conditional procedures later | All leaders; effectiveness against a control group is ours |
| Spare used as text | Parts and critical-spares list per machine from failure history; warranty and AMC alerts; purchase orders later | Limble, Hexagon, UpKeep |

**Communication**

| What he has | What we add | Who does it well today |
| --- | --- | --- |
| Web push and a WhatsApp share button | **WhatsApp as a channel**: report by text or voice note, be assigned, be escalated, confirm handback, receive the PDF; templates in three languages; email and SMS as fallbacks; one notification service with retries and dead letters | Fracttal (notify only), Keep Wisely and Cryotos (top tiers) |
| Browser speech recognition and a public translator | Server-side Gujarati and Hindi transcription measured on our own test set; glossary learned from corrections; the text always shown back before it counts | MaintainX and UpKeep have voice in English and Hindi only |

**Analytics and intelligence**

| What he has | What we add | Who does it well today |
| --- | --- | --- |
| Counts and durations per ticket | Everything his platform computes, exactly, then: **shift-calendar KPIs** (MTBF, MTTR, availability on real working hours, SMRP-aligned), backlog and schedule compliance, Pareto and heatmaps by machine, cell, code and shift, cost and lifecycle views | Microsoft Dynamics, MaintainX, Limble |
| Forecast Lab in the platform | **Frozen monthly forecasts and a published scorecard**; inspection tickets raised from Hot machines and their outcomes fed back; **intervention ledger** that compares every PM change against similar machines; repeat-fault and recurrence checks; reliability fits (Weibull, trend tests) once enough history exists | IBM Maximo Predict (needs sensors or long history); the closed loop is ours |
| Fix Finder by text match | **Fix finder with evidence**: similar past jobs with what fixed them and how often it held; **plain-language questions** over curated views with the SQL shown; **daily briefing** per role; duplicate detection; PM drafts from the plant's own manuals; later a planning solver and an MCP connector for outside AI tools | IBM, SAP, IFS, MaintainX, Limble |
| One plant's data | Cross-plant benchmarks and industry packs built from anonymised, opt-in history: the moat nobody can buy | MaintainX shared assets is the nearest |

**Platform**

| What he has | What we add | Who does it well today |
| --- | --- | --- |
| One company on one Worker | **Multi-tenant** from the first migration with row-level security and isolation tests; per-plant configuration cascade; tenant onboarding wizard | All SaaS leaders |
| Settings pushed from a desktop HTML | **Importer**: drop Excel, CSV, PDF or photos; AI maps columns; a person reviews; commit with source pointers and undo; industry packs for CNC first | UpKeep (AI import clean-up), Limble |
| Client-side role checks, keys in URLs | Server-side permissions, sessions per device, audit log, backups and restore drills, India-only data, DPDP-ready consent and deletion | Enterprise suites |
| A Worker with no scheduler | A worker that fires timers, renders PDFs, runs the engine and sends messages; REST API with OpenAPI for partners; ERP, Tally and machine connectors later | All leaders |

**Deliberately not building:** 3D and BIM, linear assets, invoice matching, management of change, computer-vision inspection, AI-generated FMEA, sensors in year one. OEE, capital planning, 21 CFR Part 11, EHS incidents and cycle counts wait for a customer who needs them.

## 4. Milestones

Seven milestones, each an epic for Claude Code with a gate that must pass before the next begins. Two of them are split into halves with their own gates so no single gate hides months of work. **There is no parallel run.** M1 ends in a soft cutover: Bhavin's data is imported, his app goes read-only, ours is live, with a go or no-go check on day 3 and day 7 and a written revert plan. M2 then lands on a live system.

*(Diagram in the shared doc: roadmap · 7 milestones, each with a gate\.)*

No dates are set here. Each milestone is sized for a few weeks of agent sessions with review at the gate; the order matters more than the calendar. M4a depends on Bhavin's latest Excel export; until it arrives the answer key is built from the data embedded in the platform file and re-run when the export comes.

| Milestone | Builds | Gate (how it is verified) |
| --- | --- | --- |
| **M0 Foundation and walking skeleton** | Repo and tooling; schema v1 with `tenant_id` and row-level security on every table; sign-in (personal and shared-phone) with a bearer session; tenant settings (flat); Cosmos master data seeded from the two export files; infrastructure with one-command deploy, rollback and an executed restore drill; and one vertical slice: raise a ticket on the floor screen, see it on the Open list, on staging | Automated: isolation suite, seed counts (192 machines, 14 people), deploy and rollback scripts run in CI against staging. Gate-manual: Nimish raises one ticket on his phone |
| **M1a Ticket core** | The whole v3 state machine and figures in `packages/domain`; tickets API; floor and desk faces (report, Open, Mine, Team, ticket detail, actions); follow-up tasks; cancel, restore, correct | Automated: every transition and figure tested; Playwright runs one ticket through every action; parity rows for these sections green in `parity.yaml` |
| **M1b Parity complete and soft cutover** | Breakdown and day report PDFs; Live board; push; offline outbox; update banner; WhatsApp share text; Cosmos import from Bhavin's export (or the fallback described in section 12); Gujarati strings; cutover runbook and revert plan | Automated: all M1 parity rows green; import reconciliation report shows zero unexplained mismatches. External: Bhavin's export received. Gate-manual: cutover go or no-go on day 3 and day 7 |
| **M2 Accountability** | Machine criticality and severity; SLA policies and timers as delayed jobs; escalation rules, ladder and roster; production handback with confirm and dispute; push notifications for all of it (WhatsApp and email arrive in M3) | Automated: fake-clock tests for timers and escalation; dispute reopens the same ticket. Gate-manual: handback turnaround visible on live tickets |
| **M3 WhatsApp and voice** | Meta Cloud API webhook and templates (English and Gujarati, submitted for approval at M3 start); phone-to-person routing; report by text and voice; transcription with confirmation; QR per machine; PDFs on WhatsApp; email via SES for escalation to the plant head | Automated: webhook contract tests with recorded payloads. External: Meta verification, number, templates approved. Gate-manual: an operator raises a ticket by voice; transcription accuracy recorded in the repo |
| **M4a Analytics parity** | Answer-key fixtures; `packages/engine` legacy profile reproducing every platform calculation; analytics face screens | Automated: every fixture number matches exactly |
| **M4b The loop** | PM calendar, checklists and load spreading; failure-code taxonomy and coding at close; shift-calendar KPIs; frozen monthly forecasts; scorecard; inspection tickets; intervention ledger | Automated: forecast freeze and scorecard jobs tested with a fake clock. Gate-manual: first scorecard from live data |
| **M5 Plant two** | Importer; industry pack format and CNC pack; settings cascade and multi-plant tenants; onboarding wizard; Hindi strings; mid-market features (approvals, vendor sharing, scheduling board, warranty and AMC, skills, handover log) | External: a second plant live by configuration and import alone |
| **M6 AI layer** | Failure-code suggestion, fix finder, plain-language analytics, daily briefing, duplicate detection; evaluation harness | Automated: shadow-mode acceptance rate above the threshold set per agent before it suggests by default |

## 5. Architecture

One TypeScript monorepo, one server process, one static web app, one Postgres. The review council pushed this shape down from three deployables and eight packages to what fifteen users and 250 tickets a month need: a Fastify server that also runs the job queue in-process (a `ROLE` flag lets it split into api and worker later), a Vite-built React PWA served as static files, and Postgres on RDS. The phones talk to the server over HTTPS with a bearer token, as Bhavin's app does today; WhatsApp talks to the same server through a webhook. Nothing runs outside AWS Mumbai except the outside services named below.

*(Diagram in the shared doc: system architecture · 5 channels, 1 API, 1 worker, 3 stores\.)*

The job queue is the piece Bhavin's Cloudflare Worker does not have: scheduled and delayed jobs that fire SLA timers, escalate, render PDFs, run the analytics engine and send messages. pg-boss keeps the queue in Postgres, so there is no Redis, and it runs inside the same process in the pilot.

| Component | Responsibility | Technology | Notes |
| --- | --- | --- | --- |
| `apps/web` | Floor, desk, board, analytics and settings screens; two installable manifests (floor, desk) and a kiosk route for the board; one service worker | Vite, React, React Router, TanStack Query, Tailwind, shadcn/ui, ECharts, vite-plugin-pwa (Workbox) | A static single-page app, as Bhavin's pages are today. No server rendering: every screen is behind a login, and offline-first is simpler without it |
| `apps/server` | All business logic behind HTTP (auth, tenancy, tickets, config, files, imports, webhooks) and all background jobs | Fastify, Zod, better-auth, pg-boss, Playwright for PDFs | One Docker image; `ROLE=all` in the pilot, `api` or `worker` when load ever demands two processes |
| `packages/domain` | Pure functions: ticket state machine, figures, severity, SLA maths, permissions | TypeScript, no I/O, 100% unit-tested | The one place rules live |
| `packages/db` | Drizzle schema, SQL migrations with RLS policies, seed and import scripts, isolation test | Drizzle ORM on node-postgres | Every table has `tenant_id`; policies in the same migration as the table |
| `packages/shared` | Zod request and response schemas, tenant settings schema, i18n messages (en, gu; hi at M5), constants | TypeScript | Imported by web and server; a renamed field fails the build |
| `packages/engine` (from M4) | Port of the platform's analytics with a legacy profile that reproduces the answer key, then improved models; a Python sidecar for lifelines, statsmodels and PyMC behind one interface | TypeScript; Python 3 in its own container | Runs as jobs; writes result tables |
| Data stores | Postgres 16 on RDS (data and queue); S3 with versioning for PDFs, photos, voice notes, backups; Secrets Manager | AWS ap-south-1 | Data stays in India |
| Outside services | WhatsApp Cloud API (Meta), Sarvam speech-to-text, Amazon SES (sends from an AWS region; content is transactional), web push through the phone vendors' push services | HTTPS | Each behind one adapter interface; any error tracker that stores data outside India needs an ADR and PII scrubbing first |

**Verify before relying on:** library names here are ones I am confident exist (Vite, React, Fastify, Drizzle ORM, pg-boss, better-auth, Zod, ECharts, web-push, vite-plugin-pwa); the Claude Code session must still check current versions and APIs in the official docs rather than from memory.

## 5a. Borrow, don't build

A research pass on 9 November checked about 110 open-source projects and libraries for every layer, with licences read from each repository (research note 16 in the pack has the full tables, caveats and sources). The headline is uncomfortable but useful: **there is no actively maintained, permissively licensed CMMS in TypeScript or JavaScript.** Atlas CMMS is AGPL, Odoo Maintenance LGPL, ERPNext and GLPI GPL; the helpdesks that looked promising (Peppermint, Grafana OnCall, Netflix Dispatch) are archived or AGPL. So the domain layer is ours to write, and everything around it is borrowed. Rule: we copy or depend only on MIT, Apache-2.0, BSD, ISC or MPL-2.0 code; AGPL and GPL projects are read for ideas; source-available licences (BSL, SSPL, Elastic, "sustainable use") are not used.

| Layer | Pick (licence) | Fallback | What we actually borrow |
| --- | --- | --- | --- |
| CMMS domain | Build it; read Atlas CMMS and Odoo Maintenance schemas as completeness checks | Trudesk (Apache-2.0) for ticket-field ideas | Ideas only |
| Ticket state machine | A transition table plus Zod in `packages/domain`; XState (MIT) only for timed or approval flows | Robot (BSD-2) | Pattern |
| Escalation | GoAlert's model (Apache-2.0): policy, steps, delay, repeat, re-implemented on Drizzle | Keep's YAML workflow pattern | Data model |
| Notifications | Uptime Kuma's provider interface pattern (MIT): one adapter per channel |  | Pattern |
| Multi-tenancy | Postgres RLS with `set_config('app.tenant_id', ..., true)` inside a Drizzle transaction wrapper (copy the wrapper from rphlmr/drizzle-supabase-rls, Apache-2.0); Drizzle `pgPolicy` for policies | Tenant-id discipline without RLS (not recommended) | Code |
| Auth | better-auth (MIT) with its username, admin, organization and multi-session plugins; multi-session covers shared tablets. Lucia is deprecated; Auth.js v5 never left beta | Lucia's single-file session code as a reference | Library |
| Jobs and SLA timers | pg-boss (MIT) delayed jobs with `singletonKey` as the breach timers, plus a periodic sweep | Graphile Worker | Library; no TypeScript business-hours SLA library exists, so that maths is ours |
| PM recurrence | croner or cron-parser plus our own interval and meter logic | rrule.js (stale) | Library |
| PDF | Playwright with Noto Sans Gujarati and Devanagari fonts baked into the worker image; Chromium is the only JavaScript route that shapes Indic scripts correctly (react-pdf, pdfmake and pdfme break them) | Gotenberg; Typst for volume | Library |
| QR | node-qrcode (server), react-qr-code (UI); scanning with zxing-wasm and the barcode-detector ponyfill (MIT) | html5-qrcode | Library |
| PWA and offline | vite-plugin-pwa (MIT, on Workbox) for the service worker and manifests; an IndexedDB outbox (idb); web-push (MPL-2.0). Background Sync is Chromium-only, so the outbox also replays on app open and on reconnect | Hand-written service worker; PowerSync (now Apache-2.0) only if true offline editing is ever needed | Libraries |
| WhatsApp | whatsapp-api-js (MIT, active) with our own X-Hub-Signature-256 check via fastify-raw-body. Meta's official Node SDK is archived under a non-open licence; never Baileys | @great-detail/whatsapp (MIT) | Library |
| Speech | Sarvam `saaras` API (Gujarati, Hindi, Marathi; India-hosted) | Self-hosted AI4Bharat IndicConformer (MIT, gated download); Azure as commercial fallback. Google Chirp has no India region; Indic-Transcribe's licence needs written permission for hosted use | Service |
| Charts and grids | ECharts (Apache-2.0) through our own hook; TanStack Table and Virtual (MIT); AG Grid Community MIT packages only | Recharts; AG Grid Community | Libraries |
| Calendar and Gantt | FullCalendar standard plugins (MIT) for the PM calendar; vis-timeline (Apache/MIT) for resource views; DHTMLX Gantt Community (MIT) for shutdown plans. FullCalendar's premium resource views need a paid licence | Schedule-X; frappe/gantt | Libraries |
| Dashboard layout | react-grid-layout | gridstack.js | Library |
| Reliability statistics | Written in TypeScript in `packages/engine`: Weibull two-parameter maximum likelihood with censoring, Kaplan-Meier, Crow-AMSAA, Poisson regression (about 250 lines together); stdlib for distributions. JavaScript has none of these ready-made | A Python sidecar from M4 for lifelines (MIT), statsmodels (BSD), ruptures (BSD) and PyMC when the models outgrow TypeScript; the `reliability` package is LGPL (library use only); scikit-survival is GPL (read only) | Code we write, with Python behind an interface |
| Import | SheetJS Community Edition 0.20.x installed from cdn.sheetjs.com (the npm `xlsx` package is frozen at 0.18.5 with known vulnerabilities); PapaParse; Fuse.js for fuzzy matching; react-spreadsheet-import (MIT) for the mapping wizard | HelloCSV; ExcelJS for exports | Libraries |
| Admin UI and forms | shadcn/ui, react-hook-form, Zod, drizzle-zod; AutoForm for master-data screens | react-admin `ra-core` (MIT) | Libraries |
| Failure-code taxonomy | Our own list structured like ISO 14224 (which is paywalled); vocabulary from the IOF Maintenance Reference Ontology (MIT) and MaintIE (MIT: 224 leaf types, about 1,000 gold and 7,000 silver annotated work orders), which also trains the code suggester | NIST Nestor's tagging approach (public domain, dormant) | Data and definitions |

**Consequences for this spec:** better-auth with its bearer plugin provides sessions (30-day sliding, shared logins; device revoke later); the web app is a Vite build, so the PWA layer is vite-plugin-pwa rather than a Next.js add-on; the Python sidecar is an explicit M4 component; the PM calendar uses FullCalendar's free plugins only; `THIRD_PARTY.md` lists every dependency with its licence and is checked in CI. Library versions move fast; every session verifies the current API in the official docs before use.

## 6. Backend

One Fastify server that also runs the job queue, one Postgres, one S3 bucket. Business rules live in `packages/domain` as pure functions, so the API, the jobs and the tests run the same code.

**Stack**

| Concern | Choice | Why |
| --- | --- | --- |
| Runtime and language | Node 22 LTS, TypeScript strict | One language across the product |
| HTTP | Fastify with Zod type-provider; schemas shared with the web app from `packages/shared` | Schema-first; the OpenAPI document is generated only when an outside consumer appears |
| Database | Postgres 16 (RDS), Drizzle ORM, SQL migrations in `packages/db`, policies written in plain SQL | RLS policies live next to the tables |
| Jobs | pg-boss in-process (Postgres-backed queue and scheduler); `ROLE=api`, `worker` or `all` | No Redis; delayed jobs are the SLA timers (`singletonKey` per ticket and timer); cron for nightly jobs |
| Auth | better-auth with the username, admin, organization and multi-session plugins and its bearer plugin; one mechanism: bearer token for every client, stored by the web app in IndexedDB; 30-day sliding sessions; device labels, with per-device revoke in M2 | One middleware path, works offline with the service worker, matches what users do today |
| Tenancy | Tenant resolved from the host name (`cosmos.<domain>`, `cosmos.staging.<domain>`), never from a URL parameter or header; the server sets `app.tenant_id` with `set_config(..., true)` inside every transaction before any query | Pre-login screens (brand, login) know the tenant without trusting the client |
| Files | S3 with versioning and lifecycle rules; pre-signed uploads; metadata in `file` | PDFs, photos, voice notes, imports, backups |
| PDFs | HTML templates rendered by headless Chromium (Playwright) in the job role; Noto Sans Gujarati and Devanagari (OFL) baked into the image; one browser instance, concurrency 1, `shm_size` set; instance with at least 4 GB RAM (verify sizing) | Only route that shapes Indic scripts correctly; the operational cost is named so it is budgeted |
| Messaging | Adapters behind one interface: web push (M1), WhatsApp Cloud API and SES email (M3), SMS later | Each channel swappable; a monthly spend cap per channel in settings |
| Speech | Sarvam speech-to-text (M3) behind a provider interface; a daily minutes cap | Measured on our own test set before it is switched on |
| Observability | JSON logs with tenant and request ids to CloudWatch; `/health`; an external uptime ping; a failed-jobs page in Settings (M1); one alarm on timer lag (M2). Any error-tracking service that stores data outside India needs an ADR and PII scrubbing first | Enough for a pilot a solo operator can watch |

**Modules in `apps/server`** (each a Fastify plugin with routes, schemas and tests): `auth`, `tenancy`, `config`, `people`, `machines`, `tickets`, `tasks`, `reports`, `files`, `notifications`, `whatsapp` (M3), `imports`, `analytics` (M4), `admin`, plus `jobs` (queue handlers). Every handler receives `{tenantId, login, actingPersonId, now}`.

**Tenancy mechanics, precisely.** Every tenant table has `tenant_id` and a policy `tenant_id = current_setting('app.tenant_id')::uuid`, enabled and forced. The application role cannot bypass RLS. A request's transaction begins with `set_config('app.tenant_id', $1, true)`; a dev-mode assertion throws if a query runs without it, because the failure mode of RLS is an empty list, not an error. Three places legitimately work across tenants and get a separate `app_router` role with narrow `SECURITY DEFINER` functions: session lookup by token (returns the tenant), WhatsApp inbound routing by phone number (returns tenant and person), and the job runner, which reads the tenant from the job payload and then sets it. pg-boss's own tables and the `tenant` table are the documented exceptions to the `tenant_id` rule. One generic isolation test introspects the schema and tries every table as two tenants; a new table is covered automatically.

**The ticket state machine** is a pure function `transition(ticket, events, command, ctx) → {ticket, newEvents, segmentChanges, jobs}` in `packages/domain`. Commands: `raise`, `start`, `join`, `leave`, `pause`, `resume`, `transfer`, `update`, `machineRunning`, `machineStopped`, `upgradeKind` (support to stopped), `closeWithReport`, `closeWithoutReport`, `markDone`, `lateReport`, `recordPastBreakdown` (the old "report only"), `cancel`, `restore`, `correct`, and from M2 `acknowledge`, `escalate`, `handbackConfirm`, `handbackDispute`. The API loads the ticket row `FOR UPDATE`, replays the command, appends events with a per-ticket `seq`, updates segments and cached figures, and commits in one transaction; a second person starting the same ticket gets a 409 with the current ticket. Every command carries a client-generated idempotency key, so an offline replay never applies twice. Role and ownership checks happen here, on the server.

**Figures** (response, hands-on, repair, waiting, vendor, handover wait, downtime, follow-up, per-person minutes) are computed by `figures(events, segments, overrides, now)` and cached on the ticket at every transition. Events are the truth; `work_segment` rows (one per person per working stretch) are the only interval table; stopped periods, pauses and handover waits are derived from event pairs. An admin correction writes explicit overrides into the `edit` event, which the function applies last, so Bhavin's corrected figures import exactly. A nightly job recomputes and reports drift, excluding overridden fields.

**Background jobs** (pg-boss): `sla.timer` (one delayed job per ticket per timer kind, cancelled or rescheduled on each transition, M2); `escalation.notify`; `notify.send` with retries, a dead-letter table and a per-channel cap; `pdf.render`; `engine.run` nightly and `engine.freeze` on the 1st (M4); `import.process`; `figures.drift` nightly; `whatsapp.inbound` (M3); `asr.transcribe` (M3). No polling sweeper is needed for timers; a daily consistency job re-arms any timer that should exist and does not.

**Deployment and operations**

- One EC2 instance per environment (staging, production) running Docker Compose: `caddy` (TLS, static web files), `server` (`ROLE=all`), a Python sidecar from M4. RDS Postgres with automated backups and point-in-time recovery. Infrastructure described in Terraform under `infra/` (account bootstrap by Nimish; then scripts).
- `deploy:staging` runs from CI on every merge to `main`. `deploy:production <tag>` runs from CI when Nimish tags a release at a milestone gate. `deploy:rollback <tag>` re-pulls the previous images. Every migration is expand-and-contract (backward compatible with the previous app version) so rollback never needs a down-migration.
- Production deploys and RDS maintenance run between 05:00 and 08:00 IST, the only quiet window in a plant that runs 08:00 to 05:00. The in-app update banner is shown outside shift changeovers.
- Restore drill executed in M0 and once a quarter; S3 versioning protects against bad deletes.
- Running cost estimate for two environments: roughly USD 110 to 150 a month plus per-message and per-minute fees (verify against the AWS calculator); a billing alarm at ₹30,000 a month.
- Production data fixes: sessions never touch production. Corrections go through the `correct` command (which may also change the machine and the kind), `import:undo` for a batch, or a logged admin script that Nimish runs from a runbook. Destructive scripts refuse to run unless `APP_ENV=staging` or a `--production-confirm` flag is passed by a human.

## 7. Frontend

One static React app built with Vite, with four faces as route groups. Bhavin's two installable pages become two manifests (floor and desk) served from fixed paths; the board is a kiosk route inside the desk build; analytics and settings are desktop routes. One service worker at the root caches the app shell and the last state and config, and holds the offline outbox.

| Face | Route root | Who | Home screen | Installable |
| --- | --- | --- | --- | --- |
| Floor | `/floor` | operators, setters, shared cell phones | Which machine? (three-tap report); My complaints | Yes, manifest "Report" |
| Desk | `/desk` | technicians, supervisors, maintenance head, admin | Open (Breakdowns, Tasks, Work) with Mine, Team, Report, Live tabs | Yes, manifest "Maintenance" |
| Board | `/desk/board?kiosk=1` | a TV or tablet on the wall | Live status tiles by segment and group, no navigation | Opened in kiosk mode |
| Analytics and Settings | `/app` | maintenance head, plant head, admin | Dashboard, Action Center, machines, PM calendar, reports, scorecard; People and access, machines, lists, shifts, SLA, WhatsApp, imports, failed jobs, audit | Desktop web |

**Design system.** Tailwind with a small token set and components copied in from shadcn/ui (MIT). Status colours are tokens matching the meanings users already read: stopped red, in progress blue, support and follow-up amber, transferred violet, waiting orange, running neutral. Floor type 18 to 26 px, buttons at least 52 px tall, one action per screen. Charts use ECharts through one hook with one palette; tables use TanStack Table. No custom chart code.

**Languages.** English and Gujarati in M1; Hindi at M5 when a plant needs it. English copy comes from Bhavin's app as inventoried; Gujarati strings are written or reviewed by Cosmos's team through a translation screen in Settings, and until a string is translated the floor shows English with a "needs translation" list visible to the admin. The agent never machine-translates silently. Transliterated Gujarati typed in Latin letters ("haydrolik oil chek") is common in the live data and must be accepted in every free-text field, in search and in failure-code suggestion. A lint rule (eslint, no string literals in JSX) enforces that all copy lives in `packages/shared/i18n`.

**Offline and the outbox.** Reads work from the cached state with an "offline" marker. Writes that may happen offline are the ones Bhavin queues today: close with report, close without report, mark done and late report; everything else requires a connection and says so. Each queued command carries its idempotency key and the time the person chose; on reconnect or app open the outbox replays in order; a 409 (the ticket changed meanwhile, for example closed by someone else) turns the queued report into a draft the person is shown, never a silent drop. The update banner appears when a new build is deployed and is suppressed in the 30 minutes around shift changeover.

**State and data.** TanStack Query with a 30-second refetch when visible and refetch on focus, as today; the full `/state` payload each time in M1 (a delta protocol only if a plant's size demands it). Optimistic updates only for the ticket actions a person just took. The bearer token lives in IndexedDB so the service worker can replay with it; a 401 clears it and shows the sign-in screen with the message Bhavin's users know.

**Key screens, by face** (the Parity checklist has every element)

- **Floor:** machine search and groups; situation; problem with voice and quick chips; work request; sent confirmation with ticket number and WhatsApp share; My complaints with confirm or dispute of a fix (from M2).
- **Desk:** Open with counts strip and three lists; ticket card with state-dependent actions; ticket detail sheet with timeline, people, follow-up box, WhatsApp text, admin edit; Mine; Team; Live; Report (the old form, pre-filled); day report sheet; account sheet.
- **Board:** tiles, counts, filter chips, machine search, work-request footer; read-only.
- **Analytics:** every screen of the platform HTML, re-laid out by job: Today, Machines, Breakdowns, Forecast and scorecard, PM, Cost, Reports, Guide.
- **Settings:** people and logins (personal or shared, role, phone, shift, cell), machines (segments, groups, criticality, cells), lists (codes, categories, wait reasons with their flags, work types, quick problems, task reasons), glossary and translations, shifts and roster, SLA and escalation (M2), WhatsApp (M3), imports (M5), failed jobs, audit log.

**Devices.** Tested on a low-end Android phone in Chrome and on an iPhone as an installed PWA (iOS push needs installation, as the current app already explains). Touch targets, contrast and font sizes follow the floor-first rule; the desk works one-handed.

## 8. Data model and API

The full entity tables, state machine, permissions matrix and endpoint contract are in Domain model & API. The rules that shape them:

1. **Events are the truth.** Every ticket change is an append-only `ticket_event` row with a per-ticket `seq` (type, login, acting person, at, payload). The `ticket` row carries the current state and cached figures; `work_segment` is the one interval table (per person per working stretch). Stopped periods, pauses and handover waits are derived from event pairs, not stored twice.
2. **People are rows, not strings.** `person` (name, kind: staff, production or vendor; phone; cell; shift; title) is separate from `login` (username, hash, role, shared flag, person link, cell for a shared cell phone). A shared login records the acting person on every action. Floor reporters who are not in the list are created as `production` persons flagged `pending` for the admin to merge or confirm, so neither the floor nor the import ever stalls on a name. Bhavin's free-text names are mapped at import by an alias file reviewed once.
3. **Two ticket families, one table.** `kind` is `stopped`, `support` or `general`; a follow-up task is a `general` ticket with `parent_id`. A support ticket whose machine then stops is upgraded in place (`upgradeKind`) so downtime is recorded on the same ticket. References are `BD-0001` and `WR-0001` per tenant from a `ref_counter` row locked in the transaction; the import sets each counter to the imported maximum.
4. **Configuration is data.** `setting` rows keyed by tenant and key hold features, SLA defaults, language and cost constants; `list_item` rows hold every option list with flags (`is_vendor`, `pauses_sla`, `tag`); the five-scope cascade and multi-plant tenants arrive in M5 as a migration, not now. One tenant is one plant until then.
5. **Imports remember where rows came from.** `import_batch` and `source_ref` on imported rows make any batch reviewable and reversible from M1.
6. **Corrections are events with overrides.** An admin correction writes old and new values into an `edit` event; figures the admin set directly (hands-on, waiting) are stored as overrides applied after recomputation, so corrected numbers import and display exactly as Bhavin's.
7. **API shape.** REST over JSON at `/api/v1`, one resource per noun, commands as sub-resources (`POST /tickets/{id}/pause`), bearer sessions, an `Idempotency-Key` header on every command, cursor pagination (`?cursor=&limit=`, default 50, maximum 200, envelope `{items, nextCursor}`), one error envelope with codes `unauthenticated`, `forbidden`, `not_found`, `conflict`, `validation`, `rate_limited`, `internal`; a row in another tenant is a `not_found`, never a `forbidden`. Bhavin's 29 endpoints map one-to-one onto this.

Schema v1 (M0 and M1) covers tenancy, people, machines, lists and settings, tickets and the event log, work segments, tasks, reports, files, push subscriptions, audit, import batches, the reference counter. Schema v2 (M2) adds criticality, SLA policy, timers, escalation, roster and handback. Schema v3 (M3) adds WhatsApp contacts, conversations and messages. Schema v4 (M4) adds PM plans and tasks, failure codes with aliases, engine result tables. Each lands as a numbered migration with its RLS policies; the generic isolation test covers every table automatically.

## 9. Non-functional requirements

| Area | Requirement | How it is checked |
| --- | --- | --- |
| Tenant isolation | No query can return another tenant's row; RLS enabled and forced on every tenant table; the application role cannot bypass it; cross-tenant work only through the `app_router` role's narrow functions | One generic isolation test introspects the schema and tries every table as two tenants, in CI; a dev-mode assertion throws when a query runs without `app.tenant_id` |
| Authorisation | Every command checks role and ownership on the server in `packages/domain`, never only in the browser | Unit tests per command per role; the permissions matrix is the test table |
| Concurrency and idempotency | The ticket row is locked per command; every command carries an idempotency key; a replay returns the first result | Tests: two starts on one ticket, one replayed close |
| Auditability | Every change has actor, acting person, time and, where required, a reason; corrections keep old and new values; events and audit kept at least one year | Event log and `audit_log`; export per tenant |
| Availability | Target 99.5% monthly for the pilot (about 3.5 hours a month); phones keep working read-only from cache during an outage; production deploys only between 05:00 and 08:00 IST | `/health`, external uptime ping, offline-mode test, rollback script tested in CI |
| Performance | Open and Live render in under 2 seconds on a low-end Android over 3G; `/state` under 300 ms for a 500-machine plant; lists paginate beyond 200 rows | Measured on staging before cutover; a synthetic 10-plant load test before M5 |
| Data retention | Tickets and events kept indefinitely; voice notes 90 days after confirmed transcription unless the tenant opts to keep; PDFs kept; sessions 30 days sliding | S3 lifecycle rules; a retention job for voice notes |
| Backups | RDS automated backups with point-in-time recovery, 14 days; weekly logical dump to S3 with versioning; restore drill executed in M0 and once a quarter | Runbook plus the drill's log in the repo |
| Data protection (DPDP Act 2023 and rules) | Data in ap-south-1; voice notes and phone numbers are personal data: consent text on first WhatsApp contact, purpose limited, deletion on request; we act as processor for the tenant with a short agreement | Checklist in the repo |
| Security | Hashed passwords, 8-character minimum with a common-password check; sessions revocable; rate limits on login, `/brand` and the WhatsApp webhook; webhook signatures verified; no secrets or ids in URLs; dependency audit in CI; staging credentials only in agent sessions | OWASP ASVS level 1 self-check before cutover; a penetration test before plant two |
| Cost rails | AWS budget alarm at ₹30,000 a month; per-channel monthly caps for WhatsApp and SMS and a daily minutes cap for speech, after which the channel falls back to push and the admin is told; escalation `repeat_minutes` at least 15 with a maximum repeat count | Caps are settings with tests; alarms in Terraform |
| Observability | JSON logs with tenant and request ids; `/health`; uptime ping; failed-jobs page; one alarm on timer lag (M2) | Reviewed at each gate |
| Internationalisation | All user-facing strings in `packages/shared/i18n`; English and Gujarati from M1, Hindi at M5; dates and durations in the plant's time zone (Asia/Kolkata default) | Lint rule forbidding string literals in components; untranslated strings listed in Settings |
| Accessibility | Floor screens usable with one thumb, 52 px targets, WCAG AA contrast | Axe checks in Playwright tests |

## 10. Repository, tooling and rules for Claude Code

**Layout** (pnpm workspaces; no build orchestrator until builds hurt)

```
maintenance-os/
  apps/web            Vite + React PWA: floor, desk (with board), analytics, settings
  apps/server         Fastify API + pg-boss jobs (ROLE=api|worker|all)
  packages/domain     state machine, figures, severity, SLA maths, permissions (pure, 100% tested)
  packages/db         Drizzle schema, SQL migrations with RLS, seeds, import scripts, isolation test
  packages/shared     Zod schemas, settings schema, i18n messages, constants
  packages/engine     analytics port (from M4); python/ sidecar beside it
  docs/spec           SPEC.md, DOMAIN.md, PARITY.md, parity.yaml, QUESTIONS.md, DIFFERENCES.md
  docs/plan           backlog.md, STATUS.md, NEEDS.md, gates/M0.md ...
  docs/discovery      the research pack, both HTML sources, inventories, exports, answer-key fixtures
  docs/adr            0001-stack.md, 0002-... 
  infra/              Terraform (AWS), Docker Compose, Caddyfile, deploy and rollback scripts, .env.example
  CLAUDE.md           the rules below
```

**Tooling:** TypeScript strict; ESLint (with the no-literal-strings rule) and Prettier; Vitest; Playwright for end-to-end and PDF tests; Testcontainers Postgres for database and isolation tests; a local S3 stand-in (MinIO) in Docker Compose for development; GitHub Actions for lint, typecheck, test, build, migration check, licence check and deploy; Conventional Commits; dependency updates batched monthly by a bot into one pull request so sessions are not spent on version bumps; `pnpm` scripts for every routine action (`dev`, `test`, `migrate`, `seed:cosmos`, `import:bhavin`, `import:undo`, `deploy:staging`, `deploy:production`, `deploy:rollback`). Environment variables are listed in `infra/.env.example` with a one-line purpose each; secrets come from AWS Secrets Manager in staging and production and from `.env.local` in development.

**Spec-driven workflow.** Session 1 turns section 11 and the Parity checklist into `docs/plan/backlog.md` (one ticket per row, acceptance criteria copied in, dependencies, a `verification` field of `auto`, `gate-manual` or `external`) and `docs/spec/parity.yaml`. Each later session takes the first unblocked ticket, re-reads its spec section and parity rows, writes or updates the tests first, implements, runs the full suite, updates docs, changelog and `parity.yaml`, opens a pull request and, when every check is green, **merges it itself** (squash to `main`), then takes the next ticket. Merge to `main` deploys staging automatically. Nimish reviews behaviour on staging and reads the gate report; he does not review code or merge. Nothing merges with a red check.

**Four files make the loop self-correcting**

- `docs/plan/STATUS.md`: what the last session did, what is in progress, what it was about to do. Read first, written last, every session.
- `docs/plan/NEEDS.md`: every input only Nimish or Bhavin can supply (an account, a credential, a file, a decision), with exactly what is needed and in what format. A ticket that hits one is marked `blocked-external` and the session moves to the next unblocked ticket; it never fabricates the input. Synthetic fixtures may be used only where the ticket allows and are labelled as such.
- `docs/spec/QUESTIONS.md`: conflicts between spec, parity and code, each with the resolution the session proposed and followed. Changes that alter stored data, money or an outside account wait for Nimish; everything else proceeds on the proposed resolution.
- `docs/spec/DIFFERENCES.md`: every deliberate departure from Bhavin's behaviour with old, new and why.

**`parity.yaml`** has one entry per Parity checklist row: `id` (tab.section.row, for example `v3.actions.07`), `feature`, `disposition` (keep, improve, replace, drop), `milestone`, `status` (todo, in-progress, done, waived), `evidence` (test ids and pull-request numbers). A CI script fails a pull request that references an unknown id, counts rows by status, and prints the counts into the gate report. Progress is measured, not claimed.

**Gate report** (`docs/plan/gates/<milestone>.md`, written by the session that completes the last ticket of a milestone and committed with it): scope done and not done; parity counts by status; test counts; open items in QUESTIONS and NEEDS; how to try it on staging in ten steps; known risks; the go or no-go question for Nimish. Nimish answers by starting the next session with his decision; the agent cannot message him.

**Definition of done for any ticket:** tests pass (unit, isolation, end-to-end where a screen changed); no new table without `tenant_id` and RLS (the generic isolation test covers it); strings in i18n; changelog line; `parity.yaml` updated; merged; on staging.

**CLAUDE.md** (paste as is)

1. Read `docs/plan/STATUS.md`, then the `docs/spec/SPEC.md` section and the parity rows for the ticket, before writing code. If the spec and the ticket disagree, write the conflict and your resolution in `docs/spec/QUESTIONS.md` and proceed, unless the change alters stored data, money or an outside account; then mark the ticket blocked and move on.
2. Every tenant table has `tenant_id` and row-level security in the same migration. The generic isolation test must pass. Cross-tenant access only through the `app_router` role's documented functions.
3. Business rules live in `packages/domain` as pure functions with tests; handlers and components never contain rules.
4. Nothing plant-specific in code. Segments, groups, codes, lists, shifts, SLA targets, roles, numbering prefixes and the Cosmos legacy constants are configuration or test fixtures.
5. Never invent library APIs, function names or citations. Check the current docs; if unsure, say so in the pull request.
6. Numbers come from code, not from a language model; failure codes are selected from the list, never generated; AI output is a suggestion a person confirms.
7. No secrets, ids or keys in URLs or code. Secrets Manager in staging and production; `.env.local` in development; agent sessions hold staging credentials only.
8. Data stays in AWS Mumbai. No new outside service without a decision record and a data-protection note.
9. Do not copy code from AGPL or GPL projects (Atlas CMMS included); reading for ideas is fine. Allowed licences: MIT, Apache-2.0, BSD, ISC, MPL-2.0, OFL for fonts. Every dependency is listed in `THIRD_PARTY.md` and checked in CI.
10. One ticket at a time: tests first, implement, full suite green, docs and `parity.yaml` updated, pull request, merge when green, next ticket. Stop only at a milestone gate, where you write the gate report. No rewrites across many tickets without a decision record.
11. Migrations are expand-and-contract and never destructive in the same release. Destructive scripts refuse to run unless `APP_ENV=staging` or a human passes `--production-confirm`. Sessions never run anything against production.
12. Parity rule: match the intent of the Parity checklist row; log any deliberate difference in `docs/spec/DIFFERENCES.md` with old, new and why.
13. Inputs you do not have (accounts, credentials, Bhavin's files, a human decision) go in `docs/plan/NEEDS.md` with the exact format needed; mark the ticket `blocked-external` and continue with the next. Never fabricate data to get past a blocker.
14. Write `docs/plan/STATUS.md` before the session ends, every time.

## 11. Build order for Claude Code

Epics in sequence. Each is a few sessions and has acceptance criteria tagged **auto** (a test or script proves it), **gate-manual** (Nimish checks it on staging at the gate) or **external** (needs an input from outside; tracked in NEEDS.md). Session 1 turns this list into `docs/plan/backlog.md`.

**M0 Foundation and walking skeleton**

| # | Epic | Acceptance |
| --- | --- | --- |
| 0.1 | Monorepo scaffold: the layout in section 10, lint with the no-literal-strings rule, Vitest, Playwright, Testcontainers, CI running lint, typecheck, test, build, licence check | auto: `pnpm test` green on the empty repo; CI runs on every pull request |
| 0.2 | `docs/adr/0001-stack.md`, `docs/adr/0002-outside-services.md`, `CLAUDE.md`, `docs/plan/backlog.md`, `docs/plan/STATUS.md`, `docs/plan/NEEDS.md`, `docs/spec/parity.yaml` generated from PARITY.md | auto: parity.yaml validates and its row count equals the checklist's rows; gate-manual: Nimish reads the two decision records |
| 0.3 | Schema v1 migrations with RLS: tenant, person, login, session (better-auth tables), machine, segment, machine\_group, machine\_move, list\_item, shift, setting, glossary\_term, ticket, ticket\_event, crew\_member, work\_segment, breakdown\_report, file, push\_subscription, audit\_log, import\_batch, ref\_counter; `app_router` role and its functions | auto: generic isolation test passes for every table; dev assertion fires on a query without tenant |
| 0.4 | Auth: tenant from host, login, logout, me, change password, 30-day sliding bearer sessions, shared logins with acting person; `/brand` by host | auto: contract tests; end-to-end sign-in on two tenants on staging |
| 0.5 | Settings API and the first Settings screens: lists with flags, people and logins, machines, shifts, features; translation screen with the untranslated list | auto: a list edited in Settings is returned by `/config` with a new fingerprint |
| 0.6 | Cosmos seed from `docs/discovery/source/cosmos-platform-export-2026-10-28.json` (191 machines with nameplate fields, team, lists, settings), `docs/discovery/bhavin-v3/live-config-2026-11-09.json` (192 ids, segments, cells, shift windows, team shifts) and `glossary-2026-11-09.json`; live ids win, attributes from the export, VC-57 left blank, every conflict in a seed report | auto: counts match the sources (192 machines by segment, 14 people, 19 codes); seed report committed |
| 0.7 | Infrastructure: Terraform for RDS, S3 with versioning, IAM, Secrets Manager, EC2; Docker Compose with Caddy and the server; `deploy:staging`, `deploy:production`, `deploy:rollback`; expand-and-contract migration check in CI; restore drill executed and logged; billing alarm; `.env.example` | auto: deploy and rollback run from CI against staging; migration check fails a destructive migration. external: AWS account, domain, GitHub secrets from Nimish |
| 0.8 | Walking skeleton: floor screen raises a stopped ticket on one machine; desk Open list shows it; both deployed on staging under `cosmos.staging.<domain>` | gate-manual: Nimish raises a ticket from his phone and sees it on the Open list |

**M1a Ticket core**

| # | Epic | Acceptance |
| --- | --- | --- |
| 1.1 | `packages/domain`: state machine with every command in the Domain tab, figures from events and segments with overrides, permissions | auto: a test per transition and per figure definition; property test that cached figures equal recomputed ones; the v3 rules in INVENTORY.md sections 3 and 14 each have a named test |
| 1.2 | Tickets API: every command with idempotency keys and row locks; state, ticket detail, lists with cursor pagination; day-report data | auto: contract tests; concurrency test (two starts) and replay test |
| 1.3 | Floor face: machine search and groups, situation, problem with quick chips, work request, sent screen, My complaints, cancel own un-started, pending production persons | auto: Playwright raise, see ticket number, cancel |
| 1.4 | Desk face: Open (three lists, counts strip, team now), ticket card with state-dependent actions, ticket detail with timeline and people, Mine, Team, account sheet | auto: Playwright drives one ticket through start, update, pause, resume, join, leave, transfer, pick up, running again, stopped again, close with report |
| 1.5 | Follow-up tasks: leave at close, Tasks list, follow-up boxes, machine-stopped minutes on done; cancel, restore, correct (including machine and kind) | auto: tests for pending, overdue, done; correction writes old and new values |

**M1b Parity complete and soft cutover**

| # | Epic | Acceptance |
| --- | --- | --- |
| 1.6 | Report form and breakdown PDF (QR payload identical to ref.js v1), day report PDF with shift-length windows, server-rendered and stored in S3 | auto: PDF text extraction checks fields; a rendered-page image test proves Gujarati glyphs with the bundled fonts |
| 1.7 | Live board and kiosk route | auto: tiles and counts match a fixture's Open lists |
| 1.8 | Web push with the acting-person re-subscribe rule; WhatsApp share text (short and full) | auto: push payload contract test. gate-manual: a push received on Android and on an installed iOS PWA |
| 1.9 | PWA: two manifests, service worker, cached state and config, offline outbox with idempotency keys and 409 drafts, update banner | auto: Playwright offline test closes a ticket offline and replays it; a replay onto a closed ticket produces a draft |
| 1.10 | Import of Bhavin's live tickets: the export format is defined in `docs/spec/import/bhavin-export.schema.json` (one JSON object per ticket with events, crew, reports); alias file for free-text names; figures recomputed and compared with his stored values, overrides created where admin edits explain a difference; reference counters set to the imported maximum; `import:undo` | auto: reconciliation report with zero unexplained mismatches on his export. external: the export and the Worker source. Fallback if the export is late: an admin-login crawl of `/api/state`, `/api/ticket` and `/api/mywork?team=1` for the last 30 days, clearly labelled |
| 1.11 | Gujarati strings for the floor and desk from Cosmos's team via the translation screen | external: translations entered; auto: untranslated list empty for the floor face |
| 1.12 | Cutover runbook: import, his app read-only, ours live, day-3 and day-7 checks, revert plan (re-enable his app, export the week's tickets as CSV) | gate-manual: Nimish and Bhavin run the runbook; go or no-go recorded in the gate report |

**M2 Accountability**

| # | Epic | Acceptance |
| --- | --- | --- |
| 2.1 | Machine criticality and the severity matrix in Settings; severity on every ticket | auto: matrix tests |
| 2.2 | SLA policies; timers as delayed jobs re-armed on every transition; which wait reasons pause the clock (list flag); restore timer stops at machine running; business hours optional | auto: fake-clock tests for every timer path |
| 2.3 | Escalation rules, ladder L1 to L4 and vendor, roster, escalation events, acknowledge; push notifications | auto: missed acknowledge notifies L2, missed restore L3, critical still down L4; repeat caps enforced |
| 2.4 | Production handback from My complaints and the board QR: confirm or dispute; dispute reopens the same ticket; timeout rule; turnaround figures | auto: dispute returns the ticket to working with a new segment for the last lead |
| 2.5 | Failed-jobs page, timer-lag alarm, per-device session revoke | auto: alarm fires in a test |

**M3 WhatsApp and voice**

| # | Epic | Acceptance |
| --- | --- | --- |
| 3.1 | Meta Cloud API: webhook verification and signature check, inbound routing by phone, consent message, templates (English and Gujarati) for every message sent outside the 24-hour window, outbound queue with per-message cost logged and a monthly cap | auto: contract tests on recorded webhook payloads; cap test. external: verification, number, template approvals (started in M1) |
| 3.2 | Voice notes: download, Sarvam transcription behind the provider interface, text shown back, confirm, glossary applied; daily minutes cap | auto: provider mocked; external: accuracy measured on the consented notes and recorded |
| 3.3 | QR per machine; PDFs and day reports delivered on WhatsApp; SES email for plant-head escalation | auto: delivery job tests |

**M4a Analytics parity**

| # | Epic | Acceptance |
| --- | --- | --- |
| 4.1 | Answer key: a Playwright script opens the platform HTML from disk, loads the data set (the embedded seed first, Bhavin's Excel export when it arrives) through the page's own import, fixes the clock at one as-of date, visits every screen and extracts the figures named in the prototype inventory into `fixtures/answer-key/<screen>.json` | auto: fixtures committed and reproducible |
| 4.2 | `packages/engine` with a legacy profile (the Cosmos constants as a fixture, not product code) reproducing every calculation in the Guide | auto: every fixture number matches exactly |
| 4.3 | Analytics face | auto: each screen's figures come from the engine's result tables and match the fixtures |

**M4b The loop**

| # | Epic | Acceptance |
| --- | --- | --- |
| 4.4 | PM calendar, checklists, load spreading, PM compliance | external: the PM tool from Bhavin; auto: parity rows green |
| 4.5 | Failure-code taxonomy and coding at close; shift-calendar KPIs beside the legacy ones | auto: codes required on close; KPI definitions tested |
| 4.6 | Frozen monthly forecasts, scorecard, inspection tickets from Hot machines, intervention ledger | auto: fake-clock tests; gate-manual: first scorecard from live data |

**M5 Plant two** and **M6 AI layer** are detailed when M4 is done; their scope is in section 3.

## 12. Cosmos as tenant zero

Cosmos is loaded before anyone else touches the product, from the files we already hold plus one export from Bhavin, and nothing is re-typed.

| Source | What it holds | How it comes in | When |
| --- | --- | --- | --- |
| `docs/discovery/source/cosmos-platform-export-2026-10-28.json` | 191 machines with nameplate fields, 1,158 historical breakdowns, settings, cell log | `seed:cosmos` in M0 for master data; the breakdown history loads in M4a for the engine | M0, M4a |
| `docs/discovery/bhavin-v3/live-config-2026-11-09.json` and `glossary-2026-11-09.json` | The 192 live machine ids with segment, category and cell; lists; shift windows; team shifts; glossary | `seed:cosmos`; live ids win, attributes from the export, conflicts in the seed report | M0 |
| Bhavin's live ticket store (about 150 BD and 100 WR tickets with events, crew, pauses, reports) and his Worker source | The ticket history since launch and the exact semantics of his figures | `import:bhavin` against the schema in `docs/spec/import/bhavin-export.schema.json`; names mapped through a reviewed alias file; figures recomputed and reconciled; reference counters set to the imported maxima | M1b, on cutover day |
| His latest Excel export and the current platform HTML | The answer key for every analytics figure | The Playwright answer-key script (epic 4.1); until they arrive, the embedded seed data stands in | M4a |

**The cutover, one story.** At the end of M1b, on an agreed morning before the first shift: run `import:bhavin` on the export taken that morning; verify the reconciliation report; set his app to read-only (he keeps it for reference); point the team at ours (new icons on their phones; same usernames). Day 3 and day 7: go or no-go on three numbers: tickets raised through ours versus the week's normal volume, time-to-start, and complaints from the team. **Revert plan:** re-enable his app, export the week's tickets from ours as CSV and keep them as our history only, record the reasons in QUESTIONS.md, fix, and retry. No double entry at any point.

**Checks that must pass before cutover:** machine counts by segment match; ticket counts per month and per person match his Team screen; every imported ticket's recomputed figures match his stored response, repair, waiting and downtime within one minute, with every mismatch either explained by an `edit` event (then stored as an override) or listed; impossible dates and overlaps listed, not silently fixed; the 191-versus-192 difference (VC-57) and the 14-versus-15 people difference (a vendor team recorded as a person) resolved in the seed report.

**Transliterated Gujarati.** The live data shows people type Gujarati in Latin letters ("haydrolik oil chek", "beral chadavu"). Search, duplicate detection, failure-code suggestion and the glossary must handle this from day one; the voice test set should include it.

## 13. Decisions, accounts and inputs

**Decided (9 November):** own TypeScript stack; Bhavin's two tools are the minimum product; Cosmos is tenant zero; no parallel run but a soft cutover at the end of M1 with day-3 and day-7 checks and a revert plan. **Still to decide:** the product name and the private repository name (everything is "maintenance-os" until then).

**Bhavin's path into the build.** His product sense is worth more on our codebase than on a parallel one: a seat in the GitHub organisation, access to staging, and his ideas filed as backlog tickets that the same loop picks up. His own tool stays frozen at version 3 after cutover. The review council flagged two codebases moving at once as the biggest schedule risk, and this is the answer to it.

**What we need from Cosmos, cut to the core.** Everything else we already hold: the full source of the ticket app, its live configuration, the 192 machine ids with segment, category and cell, the team list, the glossary, the 28 October platform export, and the older platform HTML. Criticality, SLA targets, roles and shift definitions start from sensible defaults in Settings and are tuned with Bhavin in the first weeks after cutover, so they are not asked for now.

| Needed | Why we cannot get it ourselves | When |
| --- | --- | --- |
| Export of the live ticket store (every ticket with events, crew, pauses, reports) and the Worker source | It sits in his Cloudflare account; the client never sees history beyond 30 days | Before M1 import |
| The current platform HTML and his latest Excel export | His live data is in his browser, not in the file we have | Before M4 (answer key) |
| The PM tool, if it is a separate file | We have never seen it | Before M4 |
| Later, for M3: staff mobile numbers with consent, and 50 to 100 voice notes from the floor | Personal data and recordings only he can collect | During M2 |

**Accounts to set up (Nimish), the easiest way.** Set everything up in your own name or your consulting entity now; nothing here is hard to move to a product company later (AWS accounts join an Organisation, domains transfer, Meta assets can be shared or re-created; the WhatsApp number can be migrated between business accounts, though verify the current Meta procedure before relying on it).

| Account | Easiest path now | Needed by |
| --- | --- | --- |
| GitHub organisation and private repository | Free organisation under your GitHub account; name it after the product | M0, session 1 |
| Domain name | Buy one at any registrar (Cloudflare Registrar or Route 53 are the least fuss); it is needed for the app address, for sending email and for Meta's business verification later | M0 |
| AWS account, region ap-south-1 (Mumbai) | Personal account with your card is fine; turn on MFA and a billing alarm at ₹30,000 a month; add a GST number later for invoices. Services: EC2, RDS Postgres, S3, SES (starts in sandbox; request production access when email goes live), Route 53, Secrets Manager, CloudWatch | M0 |
| Meta developer app with WhatsApp, inside a Meta Business Portfolio | Create a Business Portfolio from your personal Facebook login (no verification needed to create it), then an app with the WhatsApp product. Meta gives a **free test phone number** that can message up to five registered recipients; all development and the M1 to M2 demos run on it with zero verification. **Business verification** (company registration or GST, address proof, the domain) and a **real phone number** (a fresh SIM not registered on any WhatsApp app) are needed only when real operators are messaged in M3; allow two weeks for verification. INR billing on the account before live use (mandatory from 31 December 2026; verify on Meta's pricing page). Limits for unverified businesses are low; verify the current numbers before planning the pilot on them | Developer app M0; verification and number by M3 |
| Alternative for M3 if Meta's process stalls | A Business Solution Provider (for example Gupshup, Interakt, AiSensy or Twilio) onboards the number and handles INR billing for a per-message markup; our adapter design lets us switch without changing the product | Decide at M3 |
| Sarvam AI | Pay-as-you-go API key | M3 |
| Error tracking (Sentry or similar), status page | Free tiers | M0 |
| Not needed: app store accounts (PWA), SMS provider until a fallback is wanted |  |  |

**Risks kept on the record:** two codebases moving at once (freeze his scope at version 3); the answer key depends on his browser data; voice accuracy on this vocabulary is unproven; WhatsApp pricing and rules change; OEM manuals stay tenant-scoped; one milestone at a time for a solo founder.
