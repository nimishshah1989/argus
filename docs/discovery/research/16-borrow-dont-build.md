# 16 — Borrow, don't build: open-source shortlist for the maintenance SaaS

*Research date: 9 November 2026. Stack: Next.js (App Router) web/PWA, Fastify API, Postgres 16 + RLS, Drizzle ORM, pg-boss worker, S3, WhatsApp Cloud API, Playwright HTML→PDF.*

## How to read this

- **Licence rule.** We may copy from or depend on MIT, Apache-2.0, BSD, ISC and MPL-2.0 code. AGPL, GPL and LGPL projects are **read-only references** (design ideas only, never copy code). Source-available / fair-source licences (BSL, SSPL, FSL, Elastic, Sustainable Use, MSCL) are **not freely usable** and are flagged.
- **Verification.** Licence, stars, last push and archived flag come from GitHub metadata (ecosyste.ms mirror, 9 Nov 2026); wherever the metadata said "other" I read the repo's actual `LICENSE` file; npm versions/licences were read from `package.json` on the registry CDN. Stars are rounded; "pushed" over-states health for repos that only merge bot PRs. Anything I could not confirm is marked **verify**.
- **Headline.** There is **no actively maintained, permissively licensed CMMS in TypeScript/JavaScript**. Every full CMMS worth reading (Atlas, openMAINT, Odoo Maintenance, ERPNext Asset, GLPI) is copyleft. Strategy: depend freely on infrastructure libraries, borrow *designs* from the copyleft apps, and write the domain layer (work orders, PM schedules, SLA engine, reliability maths) ourselves — it is smaller than it looks.

---

## 1. Full CMMS / EAM / field-service apps

| Name | URL | Licence | Maintained? | Borrow what | Caveat |
|---|---|---|---|---|---|
| Atlas CMMS (Grashjs) | https://github.com/Grashjs/cmms | **AGPL-3.0** + commercial dual licence (it is AGPL, not plain GPL) | Yes — Oct 2026, ~850★; Java Spring Boot + React/TS + React Native | **Ideas only**: entity model (assets, locations, WOs, requests, PM triggers, meters, parts, vendors, teams), WO status flow, mobile screens | Copyleft; Java backend, so even a "port" is risky |
| Odoo Maintenance | https://github.com/odoo/odoo | **LGPL-3.0** (LICENSE) | Yes — ~55k★, Nov 2026 | **Ideas only**: request stages, equipment MTBF/MTTR fields, cron-generated periodic PMs | LGPL is still copyleft for copied code; Python |
| ERPNext Asset Maintenance / Frappe | https://github.com/frappe/erpnext · https://github.com/frappe/frappe | ERPNext **GPL-3.0**; Frappe framework **MIT** | Both Nov 2026 (~41k★ / ~11k★) | ERPNext: ideas only. Frappe (MIT): DocType-style metadata-driven master-data screens are a useful design | Python; a second runtime |
| GLPI | https://github.com/glpi-project/glpi | **GPL-3.0** | Yes — ~6.6k★, Nov 2026, PHP | **Ideas only**: ticket→problem→change, SLA/OLA levels with escalation levels and business-calendar arithmetic | Copyleft |
| openMAINT | openmaint.org (GitHub location **verify**) | **AGPL-3.0** (verify) | Java/CMDBuild | Ideas: asset classification, location hierarchy | Copyleft, heavyweight |
| ShiftLog (City of Sault Ste. Marie) | https://github.com/cityssm/shiftlog | **MIT** | Oct 2026 but 5★, "Under Development", TypeScript/Node | Small borrows: work-order + shift-activity + timesheet schema shape; SMTP/Teams/ntfy notification fan-out | Municipal, single-tenant, DB not confirmed (verify), one maintainer |
| Trudesk | https://github.com/polonel/trudesk | **Apache-2.0** (LICENSE) | Sporadic — ~1.5k★, May 2026, Node + MongoDB | Ticket lifecycle, priorities with SLA minutes, tags, groups, canned notices | Mongo models, old React, infrequent releases |

**Dead / not usable:** Peppermint (§2, archived Jul 2026); gantt-task-react (archived); sub-50★ "CMMS" repos are abandoned student projects; the G2/SourceForge "free CMMS" lists are commercial free tiers.

---

## 2. Ticketing, helpdesk, incident and state machines

| Name | URL | Licence | Maintained? | Borrow what | Caveat |
|---|---|---|---|---|---|
| Peppermint | https://github.com/Peppermint-Lab/peppermint | **AGPL-3.0** + commercial (LICENSE) | **Archived 17 Jul 2026**, ~3.2k★ | Nothing | Dead and copyleft |
| FreeScout / Zammad | https://github.com/freescout-help-desk/freescout · https://github.com/zammad/zammad | **AGPL-3.0** both | Yes (PHP / Ruby) | **Ideas only** — Zammad has the best open SLA implementation (first-response/update/solution timers over business calendars, recomputed on change) | Copyleft |
| Chatwoot | https://github.com/chatwoot/chatwoot | **MIT** outside `enterprise/` (LICENSE) | Yes — ~39k★, Nov 2026, Rails + Vue | Assignment/auto-assignment, automation rules, macros, webhook payload shapes | **SLA code is commercial**: `enterprise/app/models/sla_policy.rb` and `enterprise/app/services/sla/…` exist, the community path does not (checked) |
| Grafana OnCall | https://github.com/grafana/oncall | **AGPL-3.0** | **Maintenance mode Mar 2025, archived 2026** | Ideas only | Dead + copyleft |
| Keep | https://github.com/keephq/keep | **MIT** outside `ee/` (LICENSE) | Yes — ~12.5k★, Nov 2026, Python API + Next.js UI | Alert dedup/enrichment ideas; YAML workflow engine ("if alert X then notify Y after N min") as a template for escalation rules; Next.js UI is copyable | Python backend; AIOps scope |
| GoAlert (Target) | https://github.com/target/goalert | **Apache-2.0** | Yes — ~2.9k★, Oct 2026, Go | **Best escalation data model to port**: policy → ordered steps → delay minutes → repeat; rotations (daily/weekly, handoff time), overrides; per-user notification rules | Go — port the schema and algorithm, not code |
| Netflix Dispatch / LinkedIn Oncall | https://github.com/Netflix/dispatch · https://github.com/linkedin/oncall | Apache-2.0 / BSD-2 | **Dispatch archived Sep 2025**; Oncall stale (Aug 2025) | Incident-timeline and roster schema ideas | Both effectively dead |
| Uptime Kuma | https://github.com/louislam/uptime-kuma | **MIT** | Very active — ~93k★, Nov 2026, Node | **Notification-provider abstraction** (90+ providers: SMTP, Telegram, ntfy, Teams, webhooks, WhatsApp gateways) — copy the interface and a few providers | Take the `server/notification-providers` pattern only |
| Cal.com | https://github.com/calcom/cal.com | **AGPL-3.0** + commercial `ee` (verify) | Yes | Ideas only for availability/rota UI | Copyleft |
| XState | https://github.com/statelyai/xstate | **MIT** | Yes — ~30k★, Nov 2026, v5 | Statecharts for WO/ticket lifecycle (guards, delayed transitions, serialisable config, `@xstate/store`) | Overkill if the lifecycle is a 7-state enum; a transition table + Zod is often enough |
| Robot / javascript-state-machine | https://github.com/matthewp/robot · https://github.com/jakesgordon/javascript-state-machine | BSD-2 / MIT | Robot active (Oct 2026, ~2.2k★); JSM **unmaintained** (Jun 2025) | Robot: ~1 KB functional FSM | Avoid JSM |

**Escalation pattern (no library):** `sla_policy` per tenant/priority with a business-hours calendar → compute `first_response_due_at` / `resolve_due_at` on create and on every priority/calendar change → one delayed pg-boss job per deadline (§4). GoAlert supplies the step model; Zammad the recomputation logic (read only).

---

## 3. Multi-tenant Postgres RLS and auth

| Name | URL | Licence | Maintained? | Borrow what | Caveat |
|---|---|---|---|---|---|
| Drizzle ORM RLS | https://orm.drizzle.team/docs/rls | Apache-2.0 | Yes — ~36k★, Nov 2026 | `pgPolicy`, `pgTable.withRLS()`, `pgRole`; docs show a transaction wrapper doing `set_config(…, true)` + `set local role`, reset in `finally` | The wrapper is example code — we own it. Use `set_config('app.tenant_id', $1, true)` (transaction-local, pooler-safe) and `FORCE ROW LEVEL SECURITY` so the owner role cannot bypass |
| drizzle-supabase-rls (rphlmr) | https://github.com/rphlmr/drizzle-supabase-rls | Apache-2.0 | Example — 115★, Oct 2024 | The `createDrizzle()` wrapper Drizzle's docs point at; ~80 lines to copy and de-Supabase | Not a maintained library |
| AWS SaaS Factory RLS references | https://github.com/aws-samples/aws-saas-factory-ref-solution-serverless-saas (+ older `aws-saas-factory-postgresql-rls` — verify) | MIT-0 | Jul 2025 | The written pitfalls: superuser/`BYPASSRLS` skip RLS, owner bypass, pooled connections must reset settings, index `tenant_id` | Lambda sample, not drop-in |
| Nile | https://github.com/niledatabase/niledatabase | Apache-2.0 (repo) | ~1.1k★, Oct 2026 | **Ideas**: `tenant_id` on every table, tenant context per connection | Managed Postgres fork → lock-in. Read, don't adopt |
| ZenStack | https://github.com/zenstackhq/zenstack | **MIT** | ~3k★, Oct 2026 (v3 on Kysely) | ORM-layer access policies as belt-and-braces | Young v3; duplicates RLS — probably skip |
| better-auth | https://github.com/better-auth/better-auth | **MIT** | Yes — ~30.6k★, Nov 2026, npm v1.7.x | **Pick.** `username` (no email for operators), `admin` (ban, impersonate, roles), `organization` (tenants, members, teams, invites), `multi-session` (several accounts on one shared tablet, switch without logout), `phone-number` + OTP via custom WhatsApp sender, Drizzle adapter | API moves between minors; its CLI wants to own auth tables; PIN re-auth on shared devices is a custom plugin |
| Lucia | https://lucia-auth.com | MIT | **Deprecated as npm package Mar 2025**; now a learning resource (site updated Jul 2026) | Copy the single file `code/auth_session.ts` (hashed tokens, sliding expiry) if we ever drop better-auth | No package |
| Auth.js (next-auth) | https://github.com/nextauthjs/next-auth | ISC | Jul 2026, ~28k★; **npm `latest` is still 4.24.x — v5 never left beta** | OAuth providers if customers want Google login | OAuth-first, credentials second-class, JWT sessions by default — wrong shape for shift-floor logins |
| Arctic / Oslo | https://github.com/pilcrowonpaper/arctic | MIT | Arctic active (Aug 2026); **Oslo archived Jan 2025** | OAuth client code only | — |
| Kratos / Keycloak / Zitadel; Cerbos / OpenFGA | ory/kratos, keycloak/keycloak (Apache-2.0); **zitadel/zitadel AGPL-3.0**; cerbos/cerbos, openfga/openfga (Apache-2.0) | As listed | All active | Nothing — external IdPs and policy engines are over-weight; RLS + a `role` column covers us | Note Zitadel's licence |
| Boilerplates | nextjs/saas-starter (MIT, Drizzle+Postgres, ~16k★, Dec 2025); boxyhq/saas-starter-kit (Apache-2.0, Jul 2026); vercel/next-forge (MIT, May 2026); epicweb-dev/epic-stack (MIT, Oct 2026); wasp-lang/open-saas (MIT, Oct 2026) | Permissive | Mixed | Team/invite/role UI, settings pages, Stripe wiring | **None uses RLS** — they filter by `teamId` in app code. Borrow UI, not tenancy |

**Shared-device logins:** better-auth `multi-session` + `username` gets 80% of the way; the remaining 20% (4–6 digit PIN re-auth after idle, kiosk session with operator switch) has no permissive library — a ~150-line plugin on better-auth's session API.

---

## 4. Background jobs and SLA/escalation timers on Postgres

| Name | URL | Licence | Maintained? | Borrow what | Caveat |
|---|---|---|---|---|---|
| pg-boss | https://github.com/timgit/pg-boss | **MIT** | Yes — ~4.1k★, Nov 2026; npm **v12.38** | **Pick.** Delayed jobs (`startAfter`), `singletonKey` dedupe, retry/backoff, cron in Postgres, archiving, dead-letter | Majors move fast (v9→v10 rewrote the schema; now v12) — pin and read release notes; polling → second-level latency, fine for SLA |
| Graphile Worker | https://github.com/graphile/worker | MIT | Yes — ~2.4k★, Nov 2026; npm v0.18 | `job_key` upsert + `run_at` = same "reschedule the breach timer" primitive; LISTEN/NOTIFY | Still 0.x after years (stable in practice); pick one queue |
| pg_cron | https://github.com/citusdata/pg_cron | PostgreSQL licence | ~3.9k★, Sep 2026 | DB-side nightly sweeps (overdue PMs, refresh reliability matviews) | Needs extension privileges — verify host |
| pgmq | https://github.com/pgmq/pgmq | PostgreSQL licence | ~5.4k★ | SQS-style queue in SQL | Redundant with pg-boss |
| croner / cron-parser | https://github.com/Hexagon/croner · https://github.com/harrisiirak/cron-parser | MIT / MIT | Both Nov 2026 | Next-occurrence maths for calendar PMs | — |
| rrule.js | https://github.com/jkbrzt/rrule | BSD-3-Clause (LICENCE) | **Stale — Jun 2024**, ~3.7k★, npm 2.8.1 | RFC 5545 recurrence ("every 2nd Tuesday") | Timezone edge cases; for interval/meter PMs write it ourselves |
| Workflow engines | temporalio/temporal (MIT), hatchet-dev/hatchet (MIT), triggerdotdev/trigger.dev (Apache-2.0), kestra-io/kestra (Apache-2.0), activepieces (MIT outside `packages/ee`) | Permissive | Active | Durable multi-step flows if ever needed; Activepieces' piece pattern for customer automations | Infrastructure weight far beyond pg-boss |
| **Not freely usable** | inngest/inngest **SSPL-1.0** (LICENSE.md); n8n **Sustainable Use Licence**; windmill AGPL + Apache mix; River MPL-2.0 (Go-centric) | — | — | — | Flagged |

**SLA timer pattern:** compute deadlines with date-fns/Luxon (MIT) over a `business_hours` table, then `pgboss.send('sla.breach', {ticketId, kind}, {startAfter: dueAt, singletonKey: \`${ticketId}:${kind}\`})`; resolve → cancel; reprioritise → cancel + resend; escalation steps (GoAlert model) are further delayed jobs; a pg_cron sweep catches misses. No maintained TS library does business-hours SLA arithmetic.

---

## 5. PDF generation (Gujarati/Hindi) and QR codes

| Name | URL | Licence | Maintained? | Borrow what | Caveat |
|---|---|---|---|---|---|
| Playwright `page.pdf()` | https://github.com/microsoft/playwright | Apache-2.0 | ~99k★, Nov 2026 | **Pick.** Chromium does full HarfBuzz shaping — Devanagari conjuncts and Gujarati matras render correctly once fonts are installed | Chromium-only; one shared browser in the pg-boss worker; ~300 MB image; await `document.fonts.ready` |
| Noto Sans Devanagari / Gujarati | https://github.com/notofonts/devanagari · https://github.com/notofonts/gujarati | **OFL-1.1** | Yes | Bake into the worker image with `fonts.conf`; `@font-face` for HTML preview | OFL forbids selling the font alone — bundling is fine |
| Gotenberg | https://github.com/gotenberg/gotenberg | MIT | ~13.5k★, Nov 2026 | Docker HTTP API over Chromium + LibreOffice (also converts customer .docx/.xlsx) | One more service; same font step |
| @react-pdf/renderer | https://github.com/diegomura/react-pdf | MIT | ~16.9k★, Nov 2026, npm v4.9 | JSX layout for Latin-only documents | fontkit shaping — **Indic shaping is known to break**; test with real Gujarati first |
| pdfmake / pdfkit | https://github.com/bpampuch/pdfmake · https://github.com/foliojs/pdfkit | MIT / MIT | Nov 2026 | Declarative tables | Same fontkit limitation |
| pdfme | https://github.com/pdfme/pdfme | MIT | ~5k★, Nov 2026 | **WYSIWYG template designer** (JSON) + generator + viewer — tenant-editable checklist/report layouts | pdf-lib + fontkit → same Indic risk; repo shows 7 security alerts (verify) |
| Typst / WeasyPrint | https://github.com/typst/typst (Apache-2.0, ~57k★) · https://github.com/Kozea/WeasyPrint (BSD-3, ~9.8k★) | Permissive | Both active | Typst: best shaping (rustybuzz), fast CLI for high-volume reports. WeasyPrint: HTML→PDF with Pango, lighter than Chromium | New markup language / Python sidecar |
| node-qrcode / react-qr-code / qr-code-styling | https://github.com/soldair/node-qrcode (MIT, idle Aug 2024, ~8.2k★) · https://github.com/rosskhanas/react-qr-code (MIT, Aug 2026) · https://github.com/kozakdenys/qr-code-styling (MIT, Feb 2026) | MIT | As listed | Server PNG/SVG for asset tags; inline SVG in React; branded labels | node-qrcode idle but stable |
| zxing-wasm + barcode-detector (Sec-ant) | https://github.com/Sec-ant/zxing-wasm · https://github.com/Sec-ant/barcode-detector | MIT (wrapper; zxing-cpp Apache-2.0) | Both Oct 2026 | **Pick for scanning**: `BarcodeDetector` ponyfill → native on Android Chrome, WASM on iOS | ~250–300★, one maintainer |
| html5-qrcode / jsQR / @zxing/library / nimiq qr-scanner | mebjas/html5-qrcode (Apache-2.0, Dec 2025, ~6.2k★); cozmo/jsQR (Apache-2.0, QR-only, frozen); zxing-js/library (Apache-2.0, Oct 2026); nimiq/qr-scanner (MIT, stale Mar 2024) | Permissive | Mixed | Fallbacks | html5-qrcode's UI is opinionated and slowing |

---

## 6. PWA / offline for Next.js (2026)

| Name | URL | Licence | Maintained? | Borrow what | Caveat |
|---|---|---|---|---|---|
| Serwist (`@serwist/next`) | https://github.com/serwist/serwist | **MIT** | ~1.5k★, Oct 2026; npm v9.5.x, peer `next >= 14` | **Pick.** next-pwa's successor; precache + runtime caching; App Router `app/sw.ts`; has a separate Turbopack guide | Small community; Next 16 defaults to Turbopack — follow that guide, not the webpack quick-start |
| Workbox | https://github.com/GoogleChrome/workbox | MIT | ~13k★, Oct 2026 (low velocity) | `BackgroundSyncPlugin` queue semantics; Serwist wraps it | Background Sync API is Chromium-only — **not on iOS Safari** |
| next-pwa / @ducanh2912/next-pwa | https://github.com/shadowwalker/next-pwa · https://github.com/DuCanhGH/next-pwa | MIT / MIT | **Dead (Jul 2024) / dormant (Sep 2024; author moved to Serwist)** | Nothing | Avoid |
| Next.js official PWA guide | https://nextjs.org/docs/app/guides/progressive-web-apps | MIT | Current | Hand-written SW + `manifest.ts` + server-action web push — the no-plugin route | You write the caching strategy |
| web-push | https://github.com/web-push-libs/web-push | **MPL-2.0** (LICENSE) | ~3.6k★, Oct 2026 | VAPID keys + push send from the worker | MPL file-level copyleft is fine as a dependency |
| idb / Dexie.js | https://github.com/jakearchibald/idb (ISC, ~7.4k★) · https://github.com/dexie/Dexie.js (Apache-2.0, ~14.7k★) | Permissive | Both Oct 2026 | IndexedDB **outbox** (queued breakdown reports + photos) replayed on `online`; Dexie for live queries | Hand-rolled sync; Dexie Cloud is commercial |
| TanStack DB + ElectricSQL | https://github.com/TanStack/db (MIT) · https://github.com/electric-sql/electric (Apache-2.0) | Permissive | Nov / Oct 2026 | Read-path sync of Postgres "shapes" + optimistic mutations | Write path is yours; shape `where` filters must mirror RLS |
| PowerSync | https://github.com/powersync-ja/powersync-service · https://github.com/powersync-ja/powersync-js | **Apache-2.0** (LICENSE; earlier releases were FSL — history verify) | Nov 2026 | SQLite-on-device, Postgres source of truth, tenant-scoped sync rules | Heavier (sync service + its own storage); only if offline *editing* is required |
| RxDB / Zero / TinyBase / WatermelonDB | pubkey/rxdb (Apache-2.0 core, paid plugins), rocicorp/mono (Apache-2.0), tinyplex/tinybase (MIT), Nozbe/WatermelonDB (MIT) | Permissive | Active | Alternatives | RxDB premium plugins paid; WatermelonDB is RN-centric |

**Recommendation:** Serwist (app-shell) + `idb` outbox for offline ticket creation + `web-push`. Adopt PowerSync or Electric+TanStack DB only if operators must edit data offline.

---

## 7. WhatsApp Cloud API SDKs and Indian-language ASR

| Name | URL | Licence | Maintained? | Borrow what | Caveat |
|---|---|---|---|---|---|
| Meta WhatsApp-Nodejs-SDK (official) | https://github.com/WhatsApp/WhatsApp-Nodejs-SDK | **Meta Platform Licence** (not OSI; "in connection with" Meta services only) | **Archived Jun 2023** | Nothing | Dead + non-standard licence |
| whatsapp-api-js (Secreto31126) | https://github.com/Secreto31126/whatsapp-api-js | **MIT** | ~360★, Oct 2026, npm v6.3, zero-dependency TS | **Pick.** Typed builders (text, template, interactive, media), webhook `get()`/`post()` helpers incl. signature verification (exact API verify), Node/Bun/Deno | Single maintainer |
| @great-detail/whatsapp | https://github.com/great-detail/WhatsApp-Nodejs-SDK | **MIT** (Great Detail Ltd) | v9 (Node 22+, Cloud API v23), 1.4k commits, 42★ | Began as a fork of Meta's SDK: messages, media, webhook registration + **signature verification**, template creation examples | Its own TODO lists template management, WABA webhook-subscription and phone-number management as unimplemented |
| whatsapp-business-sdk (MarcosNicolau) | https://github.com/MarcosNicolau/whatsapp-business-sdk | MIT | Feb 2026, ~170★ | Webhook typing, media helpers | Slower cadence |
| Baileys | https://github.com/WhiskeySockets/Baileys | MIT | ~11.6k★, very active | — | **Unofficial WhatsApp Web protocol → account bans; never for a paid SaaS** |

**DIY bits:** GET handshake (`hub.verify_token` → echo `hub.challenge`); POST verification = HMAC-SHA256 of the **raw body** with the App Secret vs `X-Hub-Signature-256` (`fastify-raw-body`, MIT); templates via Graph `POST /{WABA_ID}/message_templates`, category `UTILITY` for ticket updates; respect the 24-hour service window; persist `statuses` callbacks for the audit trail.

**Indian-language ASR — facts only**

| Option | gu / hi / mr | Self-host? | Licence / terms | Notes |
|---|---|---|---|---|
| Sarvam Speech-to-Text (`saaras:v4`, `v3`) | 23 codes incl. `gu-IN`, `hi-IN`, `mr-IN`, `en-IN`, `unknown` auto-detect | No — hosted API (India) | Commercial; weights not open (verify) | Sync endpoint <30 s, Batch API for longer; 16 kHz best; cookbook repo Apache-2.0 |
| AI4Bharat IndicConformer 600M | 22 languages incl. all three | **Yes** — HF `transformers` + `trust_remote_code`, CTC/RNNT; GPU | **MIT** (model card + github.com/AI4Bharat/IndicConformerASR); HF download gated | Card now recommends Indic-Transcribe; code last pushed Jun 2025 |
| Indic-Transcribe-core/-flex (Bodhan AI + AI4Bharat) | 25 languages incl. all three; auto language-ID | Yes — 1.2B (canary-1b-v2 base), 4.6 GB, ≤45 s/pass + long-form helper | **"Indic Open Model License v1.0"** (HF: other) — attribution, share-alike, **written permission before offering as a hosted API to others**, separate licence >500M MAU/$250M | Publisher benchmark: hi 3.5 / gu 9.2 / mr 5.7 OIWER vs Saaras v3 avg 10.7 (unverified). The hosted-API clause is ambiguous for a SaaS transcribing its own users' audio — **legal read or written permission first** |
| Meta Omnilingual ASR | 1,600+ languages incl. all three | Yes | **Apache-2.0** (LICENSE; github.com/facebookresearch/omnilingual-asr, ~3k★, Dec 2025) | Only *permissive* self-hostable option with all three; Bodhan's benchmark puts its 7B CTC far behind (62.5 avg) — test on shop-floor audio |
| AI4Bharat IndicWhisper/Vistaar, IndicWav2Vec | 12 / 9+ incl. all three | Yes | MIT | Research-grade packaging |
| Bhashini (GoI ULCA) | 22 languages | No | Free with registration; terms verify | Quality varies by language/domain |
| Google Speech-to-Text v2 | Chirp 3: all three listed **only in the `eu` location**; Chirp 2 in `asia-southeast1`/`europe-west4`; **no Chirp in `asia-south1`** | No | Commercial | No India residency for Chirp today |
| Azure AI Speech | `gu-IN`, `hi-IN`, `mr-IN` | Containers for some languages (verify) | Commercial | Custom speech for factory vocabulary |
| OpenAI Whisper large-v3 | Hindi good; **Gujarati WER poor**; Marathi middling | Yes | MIT | Not production-grade for Gujarati |
| Meta Seamless M4T | 100 languages | Yes | **CC-BY-NC 4.0** | Read-only |

---

## 8. Analytics front-end: charts, grids, calendars/Gantt, layout

| Name | URL | Licence | Maintained? | Borrow what | Caveat |
|---|---|---|---|---|---|
| Apache ECharts | https://github.com/apache/echarts | Apache-2.0 | ~68k★, Oct 2026 | **Pick** for Weibull probability plots, Pareto, control charts, heatmaps, big series | Tree-shake via `echarts/core` |
| echarts-for-react | https://github.com/hustcc/echarts-for-react | MIT | Jan 2026, ~5k★, npm 3.0.6 | Thin wrapper | Lags ECharts; a 40-line `useECharts` hook avoids it |
| Recharts | https://github.com/recharts/recharts | MIT | ~27.7k★, Nov 2026 | Simple dashboard charts (what shadcn "charts" wraps) | Weak for large data / log axes |
| Observable Plot / Vega-Lite / visx / nivo | ISC / BSD-3 / MIT / MIT | Permissive | Active | Alternatives | Pick one stack |
| TanStack Table (+ Virtual) | https://github.com/TanStack/table | MIT | ~28.6k★, Nov 2026 | **Pick**: headless tables, shadcn-styled | You build the UI |
| AG Grid Community | https://github.com/ag-grid/ag-grid | **MIT for `@ag-grid-community/*`** (LICENSE.txt); Enterprise commercial | ~15.7k★, Nov 2026 | Virtualised grid, CSV export, client-side row model | **Row grouping, pivot, Excel export, master/detail, range selection are Enterprise** |
| Glide Data Grid / react-data-grid | https://github.com/glideapps/glide-data-grid (MIT, ~5.4k★) · https://github.com/adazzle/react-data-grid (MIT) | MIT | Glide Nov 2026; react-data-grid npm `7.0.0-beta.64` | Canvas grid for 100k-row parts lists / spreadsheet-like editing | react-data-grid has been beta for years |
| FullCalendar | https://github.com/fullcalendar/fullcalendar | **Standard plugins MIT (`@fullcalendar/core` 7.1.x); Premium (resource timeline/scheduler) commercial** | ~20.8k★, Nov 2026 | Day/week/month PM calendar with drag-drop (standard) | v7 Premium: paid for for-profit use; free key only for registered non-profits (CC BY-NC-ND) or **AGPLv3** projects — not us |
| Schedule-X / react-big-calendar | https://github.com/schedule-x/schedule-x (MIT core, ~2.6k★, Nov 2026) · https://github.com/jquense/react-big-calendar (MIT, ~8.8k★, npm 1.20) | MIT | Active / slow (83 open PRs) | Lighter calendars | Schedule-X premium plugins (resource view) are paid; RBC API is dated |
| vis-timeline | https://github.com/visjs/vis-timeline | Apache-2.0 / MIT dual | ~2.6k★, Nov 2026 | **Resource timeline** (groups = technicians/machines) without FullCalendar Premium | Imperative API |
| **DHTMLX Gantt Community** | https://github.com/DHTMLX/gantt | **MIT** (LICENSE.md + README, © 2026 XB Software; npm `dhtmlx-gantt` 10.0.3) — **was GPLv2 before v10** | ~1.9k★, Sep 2026 | Full Gantt (dependencies, drag-drop, zoom, export) for shutdown/turnaround planning | Auto-scheduling, critical path, **resource management are PRO** |
| frappe/gantt | https://github.com/frappe/gantt | MIT | ~6.2k★, Jun 2026 | Lightweight SVG Gantt | Not React-native; wrap it |
| gantt-task-react / SVAR React Gantt / Bryntum | MaTeMaTuK/gantt-task-react (MIT, **archived Aug 2024**); svar-widgets/react-gantt (npm `wx-react-gantt` **GPLv3**); Bryntum commercial | — | — | Ideas only | Dead / read-only / paid |
| react-grid-layout / gridstack.js / dnd-kit | MIT (~22.5k★) / MIT (~9.2k★) / MIT (~17.8k★) | MIT | All Oct–Nov 2026 | Draggable KPI dashboard layout | react-grid-layout is the React-idiomatic pick |
| Tremor | https://github.com/tremorlabs/tremor | Apache-2.0 | Low — Oct 2025 (Vercel-owned) | Copy-paste KPI cards | Maintenance mode; copy, don't depend |
| Embedded BI (later) | evidence-dev/evidence (MIT), lightdash (MIT outside `ee`), cube-js/cube (Apache-2.0/MIT), apache/superset (Apache-2.0); **metabase AGPL** | As listed | Active | Semantic-layer ideas | Metabase read-only |

---

## 9. Reliability statistics: what exists in JS, what does not

**JavaScript/TypeScript**

| Name | URL | Licence | Maintained? | Borrow what | Caveat |
|---|---|---|---|---|---|
| simple-statistics | https://github.com/simple-statistics/simple-statistics | ISC | ~3.5k★, Nov 2026 | Descriptive stats, regression, t-test, quantiles, Poisson/Bernoulli basics | **No Weibull, no survival** |
| jStat | https://github.com/jstat/jstat | MIT | Feb 2026, ~1.8k★ | `jStat.weibull.pdf/cdf/inv`, gamma/beta, chi-square | No fitting; untyped |
| stdlib | https://github.com/stdlib-js/stdlib | Apache-2.0 | ~6k★, Nov 2026 | `@stdlib/stats-base-dists-weibull-*`, random generators, incomplete gamma, KS test; typed, tree-shakeable | Distributions only — **no MLE, no censoring** |
| ml-levenberg-marquardt | https://github.com/mljs/levenberg-marquardt | MIT | Oct 2026 | Non-linear least squares → Weibull via median-rank regression | Meta-package `mljs/ml` stale (Oct 2024) |
| fmin | https://github.com/benfred/fmin | BSD-3 | Idle Oct 2024, ~370★ | Nelder–Mead / CG — copy the ~200-line file for MLE | Idle but complete |
| mathjs | https://github.com/josdejong/mathjs | Apache-2.0 | ~15k★, Nov 2026 | Matrix algebra for IRLS (Poisson GLM), `gamma()` | Bundle size |
| danfo.js / arquero / tfjs | MIT (Apr 2026) / BSD-3 (May 2025) / Apache-2.0 (Jun 2026) | Permissive | Slowing | DataFrame grouping | Postgres does this better; tfjs not needed |

**Honest gaps in JS (nothing maintained exists):** Weibull MLE with right/interval censoring; Kaplan–Meier / Nelson–Aalen with CIs; Cox PH; negative-binomial regression; PELT/BinSeg changepoint (search found only R/Python/Julia/Rust/Go); MCMC/Bayesian.

**Write ourselves (small):** Weibull-2P MLE with right-censoring ≈ 60 lines (Newton on β, closed-form η); Kaplan–Meier ≈ 30; Crow-AMSAA (NHPP power law) is closed-form; Poisson GLM via IRLS ≈ 80 lines with mathjs. Unit-test against lifelines/reliability.

**Python, out of process (tiny FastAPI sidecar called from a pg-boss job)**

| Name | URL | Licence | Maintained? | Use for | Caveat |
|---|---|---|---|---|---|
| lifelines | https://github.com/CamDavidsonPilon/lifelines | MIT | Mar 2026, ~2.6k★ | KM, Nelson–Aalen, Weibull/log-normal AFT, Cox PH, interval censoring | Slowing |
| SurPyval | https://github.com/derrynknife/SurPyval | MIT | Nov 2026, 55★ | Parametric fits with all censoring types (MLE/MPP/MSE) | Tiny community |
| reliability | https://github.com/MatthewReid854/reliability | **LGPL-3.0** | Mar 2025, ~440★ | Richest API: `Fit_Weibull_2P/3P`, mixtures, competing risks, ALT, Crow-AMSAA, optimal replacement | LGPL → import in the sidecar, never vendor; slowing |
| statsmodels | https://github.com/statsmodels/statsmodels | BSD-3 | ~11.7k★, Nov 2026 | **Poisson / NB / ZIP GLMs** for failure counts vs load/age | — |
| ruptures | https://github.com/deepcharles/ruptures | BSD-2 | ~2.1k★, Oct 2026 | **PELT, BinSeg, kernel CPD** — "did the rate shift after the overhaul?" | — |
| PyMC + Bambi | https://github.com/pymc-devs/pymc (Apache-2.0) · https://github.com/bambinos/bambi (MIT) | Permissive | Active | Hierarchical Bayesian failure rates across machines with few events | Heavy; analytics tier only |
| scipy | https://github.com/scipy/scipy | BSD-3 | Active | `weibull_min.fit`, optimisers | — |
| scikit-survival | https://github.com/sebp/scikit-survival | **GPL-3.0** | Active | — | Read-only |
| Pyodide | https://github.com/pyodide/pyodide | MPL-2.0 | ~15k★, Nov 2026 | Run scipy/statsmodels (and pure-Python lifelines) **inside the Node worker** via WASM — no second service | 2–5 s cold start, memory, version lag; a 50-line FastAPI sidecar is simpler to operate |

---

## 10. Data import and mapping

| Name | URL | Licence | Maintained? | Borrow what | Caveat |
|---|---|---|---|---|---|
| SheetJS CE | https://git.sheetjs.com/SheetJS/sheetjs (GitHub mirror stale since Apr 2024) | **Apache-2.0** (docs.sheetjs.com licence page) | Yes, distributed from cdn.sheetjs.com | `.xlsx/.xls/.csv` parsing of customer asset registers | **npm `xlsx` is frozen at 0.18.5 (2022) with known CVEs (prototype pollution, ReDoS)** — install the 0.20.x tarball from cdn.sheetjs.com and pin; Pro is commercial |
| ExcelJS | https://github.com/exceljs/exceljs | MIT | **Dormant** — Jan 2025, npm 4.4.0 (2023), ~15.5k★ | Styled Excel *exports*, streaming writer | Usable; don't expect fixes |
| read-excel-file | https://github.com/catamphetamine/read-excel-file | MIT | Oct 2026 | Schema-driven xlsx→JSON with coercion | xlsx only |
| PapaParse / uDSV / fast-csv | mholt/PapaParse (MIT, ~13.6k★, Oct 2026) · leeoniya/uDSV (MIT, Jul 2025) · C2FO/fast-csv (MIT, Nov 2026) | MIT | Active | CSV in browser (Papa worker mode) and Node streams (fast-csv) | — |
| Fuse.js / fastest-levenshtein | https://github.com/krisk/Fuse (Apache-2.0, ~20.5k★, Aug 2026) · https://github.com/ka-weihe/fastest-levenshtein (MIT, idle) | Permissive | — | Fuzzy header→field matching; near-duplicate asset codes | Tune threshold |
| react-spreadsheet-import | https://github.com/UgnisSoftware/react-spreadsheet-import | MIT | Feb 2026, ~560★, npm 4.7 | **Flatfile-style wizard**: upload → header row → match columns → validate/edit → submit | Ships its own Chakra-based UI (clash with shadcn, weight); Flatfile/OneSchema/Dromo are commercial |
| HelloCSV | https://github.com/HelloCSV/HelloCSV | MIT | Oct 2026, ~950★, npm `hello-csv` 0.6 | Newer importer with mapping + validation; Preact with React adapter | Pre-1.0 |
| Impler.io | https://github.com/implerhq/impler.io | MIT | Sep 2026, ~290★ | Full importer platform (NestJS + widget) | Runs as its own service |
| TableFlow / OpenRefine | tableflowhq/tableflow (MIT, **likely archived — verify**) · https://github.com/OpenRefine/OpenRefine (BSD-3, ~12k★) | — | — | OpenRefine for one-off onboarding clean-ups | Desktop tool, not embeddable |

**AI-assisted mapping:** no permissive component does this well; pattern = Fuse.js first, then an LLM call returning a `header → field` map validated with Zod, confirmed by the user in the wizard.

---

## 11. Admin/CRUD UI and forms

| Name | URL | Licence | Maintained? | Borrow what | Caveat |
|---|---|---|---|---|---|
| shadcn/ui + shadcn-admin | https://github.com/shadcn-ui/ui (MIT, ~127k★) · https://github.com/satnaing/shadcn-admin (MIT, ~16k★, Sep 2026) | MIT | Active | **Pick.** Copy-owned components; admin shell (sidebar, tables, settings) | You own upgrades; shadcn-admin is a Vite template — port layouts |
| react-hook-form + Zod + drizzle-zod | react-hook-form (MIT, ~45k★) · colinhacks/zod (MIT, ~44k★, npm 4.6) · drizzle-zod (Apache-2.0) | Permissive | Very active | **Pick.** Drizzle schema → Zod → form; shared client/server validation | Zod v4 broke some resolvers vs v3 (verify versions) |
| AutoForm | https://github.com/vantezzen/autoform | MIT | Oct 2026, ~3.5k★ | Zod schema → generated shadcn form for dozens of master-data screens | Needs escape hatches |
| TanStack Form / Conform / react-querybuilder | MIT / MIT / MIT | MIT | Active | Alternatives (Conform suits server actions); query builder for escalation/auto-assign rules | Pick one form lib |
| Refine | https://github.com/refinedev/refine | MIT | ~36k★, Sep 2026; `@refinedev/core` v5.0.x | Data-provider + CRUD hooks + access-control provider pattern | Extra abstraction over TanStack Query; v5 is a recent major |
| react-admin | https://github.com/marmelab/react-admin | **MIT core**; Enterprise Edition paid | ~27k★, Nov 2026 | Richest CRUD; `ra-core` is headless | MUI look; RBAC, audit log, realtime, tree views are **EE** |
| Payload CMS | https://github.com/payloadcms/payload | MIT | ~45.7k★, Nov 2026 | Next.js-native admin generated from collection configs; Postgres adapter built on Drizzle; multi-tenant plugin; field-level access functions | Wants to own schema + migrations — conflicts with hand-written Drizzle + RLS; only if we accept Payload as the data layer |
| Tremor | https://github.com/tremorlabs/tremor | Apache-2.0 | Low (Oct 2025) | KPI blocks | Copy, don't depend |
| Directus | https://github.com/directus/directus | **MSCL-1.0 ("Monospace Sustainable Core License", 2026)** — source-available | Active | — | **Not freely usable** for a commercial SaaS |
| NocoDB / ToolJet / Budibase / Appsmith / Strapi / Keystone / AdminJS | NocoDB **AGPL**; ToolJet **AGPL**; Budibase **GPLv3** overall; Appsmith Apache-2.0; Strapi MIT outside `ee/`; Keystone MIT; AdminJS MIT (slowing, Jul 2025) | Mixed | Mixed | Appsmith for *internal* ops tooling only | First three read-only |

---

## 12. Standards and datasets for failure codes / taxonomies

| Name | URL | Licence / terms | Maintained? | Borrow what | Caveat |
|---|---|---|---|---|---|
| ISO 14224:2016 | iso.org | **Paywalled** | — | Structure only: 9-level taxonomy, failure-mode / mechanism / cause / detection split, impact classes | Don't reproduce Annex B tables; write our own list "informed by" the structure |
| NIST Nestor | https://github.com/usnistgov/nestor | **NIST public domain** (LICENSE.md; 17 USC 105) | Dormant — Mar 2024 | Tagging method for short-text work orders (problem/item/solution), human-in-the-loop vocabulary building | Python, dormant; the method matters, not the code |
| MaintIE | https://github.com/nlp-tlp/maintie | **MIT — scheme, corpus and models** (README) | Jun 2024 | 5 top-level classes (PhysicalObject, State, Process, Activity, Property), **224 leaf entity types**, 6 relations — a ready-made failure/activity taxonomy; 1,076 gold + 7,000 silver annotated MWOs to train an auto-tagger for free-text breakdown reports | Australian mining vocabulary — prune/extend for Indian factories |
| IOF Core + Maintenance Reference Ontology | https://github.com/iofoundry/ontology | MIT (repo metadata; per-file verify) | Oct 2026, ~190★ | Definitions for maintenance activity/state/event, failure, degraded state, planned/unplanned — vocabulary for our event model and glossary | BFO-based and abstract; don't run a reasoner in prod |
| MIL-STD-1629A, MIL-HDBK-338B, NASA RCM Guide, NASA Fault Management Handbook | dtic.mil / nasa.gov | **US government public domain** | Static | FMECA procedure, criticality matrices, generic failure-mode lists and rate data | Dated vocabulary; check each PDF's distribution statement |
| MIMOSA OSA-EAI / CCOM | https://www.mimosa.org | Open standard; download terms verify | Slow | Asset registry / CBM data model | Verbose XML/UML |
| ISA-95 hierarchy; OREDA; NASA PCoE datasets | isa.org (paywalled) · oreda.com (commercial) · NASA PCoE (public) | As listed | — | Enterprise→Site→Area→Line→Cell→Unit is generic knowledge; PCoE/C-MAPSS for testing Weibull/RUL code | Never scrape OREDA; don't copy ISA text |

---

## Recommended default picks

| Area | Pick | Fallback |
|---|---|---|
| Full CMMS | **Build the domain layer**; read Atlas CMMS + Odoo Maintenance ERDs as completeness checks | Trudesk (Apache-2.0) for ticket-field ideas |
| Ticket state machine | Transition table + Zod; XState only for timed/approval flows | Robot (BSD-2) |
| Escalation model | GoAlert's policy → steps → delay → repeat, re-implemented in Drizzle | Keep's YAML workflow pattern |
| Notifications | Uptime Kuma-style provider interface (copy pattern) | — |
| Multi-tenancy | Postgres RLS + `set_config('app.tenant_id')` in a Drizzle transaction wrapper (copied from rphlmr/drizzle-supabase-rls) | Nile-style tenant_id discipline without RLS (not recommended) |
| Auth | better-auth (username + admin + organization + multi-session) | Lucia's single-file session code |
| Jobs / SLA timers | pg-boss delayed jobs with `singletonKey` + pg_cron sweep | Graphile Worker |
| PM recurrence | croner/cron-parser + own interval/meter logic | rrule.js (stale) |
| PDF | Playwright + Noto Sans Devanagari/Gujarati in the worker image | Gotenberg; Typst for volume |
| QR generate / scan | node-qrcode (server), react-qr-code (UI) / zxing-wasm + barcode-detector ponyfill | qr-code-styling / html5-qrcode |
| PWA | Serwist (Turbopack guide) + idb outbox + web-push | Hand-written SW; PowerSync if offline editing is required |
| WhatsApp | whatsapp-api-js + own HMAC check with fastify-raw-body | @great-detail/whatsapp (MIT) |
| ASR | Sarvam `saaras:v4` API (gu/hi/mr, India-hosted) | Self-hosted IndicConformer (MIT); Indic-Transcribe only after licence clearance; Azure as commercial fallback (Google Chirp has no India region) |
| Charts | ECharts via own hook | Recharts (shadcn charts) |
| Grid | TanStack Table + Virtual | AG Grid Community (MIT packages only) |
| Calendar / Gantt | FullCalendar standard (MIT) + vis-timeline for resource view; DHTMLX Gantt Community (MIT) for shutdown Gantt | Schedule-X core; frappe/gantt |
| Dashboard layout | react-grid-layout | gridstack.js |
| Reliability maths | Own TS for Weibull-2P MLE, KM, Crow-AMSAA, Poisson GLM; stdlib for distributions | Python sidecar: lifelines + statsmodels + ruptures (+ reliability as an LGPL library) |
| Import | SheetJS CE 0.20.x from cdn.sheetjs.com + PapaParse + Fuse.js; react-spreadsheet-import wizard | HelloCSV; ExcelJS for exports |
| Admin UI / forms | shadcn/ui + react-hook-form + Zod + drizzle-zod; AutoForm for master data | react-admin `ra-core` (MIT) |
| Taxonomy | Own failure-code list structured like ISO 14224; vocabulary from IOF MRO + MaintIE; MaintIE corpus to train an auto-tagger | NIST Nestor tagging approach |

## Do not use / read-only

**Read-only (copyleft — ideas only):** Atlas CMMS (AGPL-3.0), openMAINT (AGPL), Odoo (LGPL-3.0), ERPNext (GPL-3.0), GLPI (GPL-3.0), Zammad (AGPL), FreeScout (AGPL), Peppermint (AGPL, archived), Grafana OnCall (AGPL, archived), Cal.com (AGPL + commercial), Plane (AGPL), Twenty (AGPL + commercial), Fleetbase (AGPL), IDURAR (AGPL), Metabase (AGPL), NocoDB (AGPL), ToolJet (AGPL), Budibase (GPLv3), Zitadel (AGPL), scikit-survival (GPL-3.0), SVAR React Gantt (GPLv3), Huly (EPL-2.0, weak copyleft — avoid copying), `reliability` (LGPL — library use in a separate process only), FullCalendar Premium under the AGPL key.

**Source-available / not freely usable:** Inngest server (SSPL), n8n (Sustainable Use Licence), Directus (MSCL-1.0), Windmill enterprise files, Chatwoot `enterprise/` (incl. SLA), Keep `ee/`, Lightdash `ee`, Activepieces `packages/ee`, Strapi `ee/`, react-admin Enterprise Edition, AG Grid Enterprise, DHTMLX Gantt PRO, Schedule-X premium plugins, Dexie Cloud, RxDB premium plugins, Indic-Transcribe ("Indic Open Model License" hosted-API clause), Meta Seamless (CC-BY-NC), Meta WhatsApp-Nodejs-SDK (Meta Platform Licence, archived).

**Dead or dormant (permissive, but don't depend):** next-pwa and @ducanh2912/next-pwa, gantt-task-react (archived), Netflix Dispatch (archived), Oslo (archived), javascript-state-machine, Cabot, Helpy, Papercups, LinkedIn Oncall, rrule.js (stale), Tremor (maintenance mode), ExcelJS (dormant but usable), npm `xlsx@0.18.5` (frozen with CVEs), Baileys (active but ban risk).

**Still marked "verify":** openMAINT repo location and licence; IOF per-file licence; TableFlow archive status; Bhashini API terms; Azure Speech containers for gu-IN; whatsapp-api-js exact webhook-verification API; PowerSync's FSL→Apache history; Indic-Transcribe licence applicability to a SaaS transcribing its own users' audio; pdfme security alerts; Zod v4 resolver compatibility.
