# Maintenance OS — Product Scope & Research Brief

Oct 27, 2026 · @Nimish Shah

## Summary

We are building a multi-tenant maintenance operating system for Indian factories. A breakdown is reported in Gujarati on WhatsApp, tracked to a named person until production signs it off, and the clean history feeds forecasts and health scores that tell the team what to fix next. Bhavin's file is an excellent specification for the analytics and a rulebook for every number, but it has none of the workflow, users or server a product needs. The build order is therefore the reverse of his menu: accountability loop first, analytics second.

**Ten positions this brief takes**

1. **The product is the accountability loop.** Cosmos's own data proves it: 30% of breakdowns are signed "Maint. Team" and a third carry no fault code.
2. **Build fresh; reuse libraries, not a CMMS.** Atlas, the best open-source base, is AGPL, licence-gated, and sold by its authors at $0 to $40 per user. Use it as a reference only.
3. **Stack:** Supabase Postgres in Mumbai with database-enforced tenant isolation, one Next.js app for all surfaces, and Bhavin's calculations ported to TypeScript first, with Python added only where it earns its place. Infrastructure is roughly ₹15,000 to 25,000 a month for the first 10 plants, before people costs (estimate).
4. **Four surfaces, not 29 menu pages:** a Report screen for operators, a technician app, a console, and an owner overview. The analytics fold into six workspaces centred on a Machine 360 page.
5. **Onboarding:** value on day one from a machine list and QR labels; history arrives later through a "drop anything" inbox where AI proposes and a person approves only the uncertain items.
6. **The data model follows standards:** ISA-95 for the plant tree, ISO 14224-style failure coding with Gujarati and Hindi aliases, EN 13306 terms, and SMRP-numbered KPIs.
7. **Bhavin's forecasting is sound and becomes the starting model.** A per-tenant back-test decides if a better one replaces it, and a new plant gets forecasts only once its records, imported or live, pass a data-health threshold.
8. **New: a feedback loop.** Every closed action is checked against its own pre-spike baseline and against similar machines with no action, then labelled held, not held, or too early to say.
9. **"Nobody else has these features" is wrong piece by piece but right as a combination.** The defensible edge is vernacular WhatsApp capture, two-sided accountability, and sensorless analytics at SMB prices.
10. **The ISO "digital records mandatory" claim is unsupported** and must stay out of sales material. Price per plant by machine count, with unlimited operators, in two tiers; ₹49,999 a year is a good entry price but underprices a 150-machine plant.

**Take into tomorrow's architecture session**

- Confirm the stack (Supabase + Next.js vs Frappe). Write the tenancy design, including how the webhook and worker paths stay isolated, plus roles and the settings cascade.
- Write the data model from the reference-standards section: hierarchy, asset classes, codes, ticket state machine, downtime intervals, PM, audit.
- Define the answer-key test: Bhavin's live Excel export at a frozen date, a legacy-compatible mode that must match exactly, and a TypeScript port of his calculations.
- Scope Phase 0 and Phase 1 into tickets.
- In parallel, outside the code: settle ownership with Bhavin, and collect the inputs listed under risks.

## What exists today

The Cosmos file is a far better *specification* than it is software: the analytics thinking is serious and largely sound, but nothing about it can run for a second customer. It is one 1.25 MB HTML file (about 8,000 lines of JavaScript plus 0.5 MB of embedded Cosmos data). It stores everything in the browser, has no login, and is fed by a separate mobile form tool through PDF + QR import.

**Scale of what it covers (counted from the file)**

| Item | Count |
| --- | --- |
| Screens in the menu | 29 (Dashboard, 6 asset lists, Breakdown Log, Fix Finder, 13 analytics, 2 reports, Action Center, Team Focus, Settings, Guide, Data Checklist) plus drill-down, machine and asset detail pages |
| Functions | about 490 |
| Assets | 125 CNC (incl. 1 robot), 16 conventional, 17 process, 30 utilities, 3 DG sets |
| Breakdown log rows | 1,158 (1 Jan to 12 Oct 2026): 1,105 breakdowns, 53 PM entries, 101 "NO DT" |
| Downtime logged | about 2,870 hours on 112 machines |

**What is genuinely strong and must survive**

- A written rulebook. The Guide page documents 30 calculation areas in plain language: available hours, BD %, MTTR/MTBF, cell attribution after machine moves, health score, forecast, Action Center rules. This is the acceptance spec for the rebuild.
- Statistically literate forecasting: machine rates pooled with category rates (an empirical-Bayes gamma-Poisson idea), repeat entries merged into "episodes", 2,000-run Monte Carlo for 80%/90% plan figures, a Laplace trend test, and a Forecast Lab that back-tests methods with pinball loss before switching. Most CMMS products do not do this.
- Age-adjusted health score (0 to 10) that compares a machine with what its category and age band predict.
- Turning analysis into work: Action Center (13 alert types, 23 editable limits), Team Focus (ranked monthly actions with owner and status), Fix Finder (similar past cases and the fixes that worked).
- Data hygiene built in: a Data Checklist that lists every missing field with a jump to fix it.

**What the data itself reveals about the accountability problem**

- 30% of breakdowns are signed "Maint. Team", not a person. About 600 are "observed by: Operator", with no name.
- 33% have no fault code; 60% have no electrical/mechanical tag; codes are duplicated (E and ELE, M and MEC, RT and ROT).
- Not one row records spare cost, so the spares part of the health score runs on nothing today.
- Logging volume swings from 39 entries in May to 175 in September, so some months are under-logged. Any forecast trained on this inherits that.
- Multi-day faults are logged as one row per day (VC-28's "tool declamp problem" appears 18 times between 27 January and 14 February). The code has to re-stitch them into episodes.

These gaps are the strongest argument for the product: the ticket loop fixes them at the source.

**What is missing entirely**

- Login, roles, tenants, server, audit trail, API.
- The operator ticket loop: raise, assign or claim, close, turnaround time, live machine status.
- PM calendar, checklists, "spread the load". Bhavin demonstrated these, but they are **not in this file**. We need that second tool.
- Spares inventory, factory-level settings (sanctioned load, transformer), notifications, WhatsApp, multi-language UI.
- Anything that is not Cosmos: document numbers CE-MTN-F-01/04, 20 hrs × 300 days, the specific robot exclusion (the general idea of an asset kept out of production KPIs is sound and stays), English keyword lists tuned to one shop, hard-coded name and code clean-ups.

## Vision and product principles

The product is a closed loop that moves a plant from firefighting to planned maintenance, and the loop only works if every event is logged by a named person. In Bhavin's words, the biggest selling point is accountability between production and maintenance; the analytics are the payoff of that discipline, not a substitute for it.

**The loop**

1. Machines, people and rules are set up (onboarding).
2. An operator reports a problem, marking the machine stopped or still running.
3. A ticket is assigned or claimed, fixed, and closed with a structured job card (PDF + QR).
4. Preventive maintenance runs on a schedule with category checklists.
5. Analytics read the clean history: what is failing, what will fail, what it costs.
6. Insights become assigned work: Action Center nudges, Team Focus actions, Why-Why tasks.
7. A feedback check measures whether that work actually reduced breakdowns. Nobody has designed this step yet.

**Principles taken from the transcript, with our additions marked**

- **A problem exists only if it is logged.** A machine shows red only when a person has declared it down. Controller and PLC data can add context later, but never replace the human ticket. Bhavin's reason: a controller cannot see geometry drift or ball-screw play.
- **Nobody should need to analyse.** Maintenance talent is scarce. The system tells a technician what to do next; it does not hand them charts. Bhavin's own example is engineers on ₹50k a month losing roughly three hours a day to data work.
- **Capture where people already are.** Operators use WhatsApp, speak Gujarati, and are not comfortable typing English. Voice and photos come first; forms come second.
- **Standardise the data, not the people.** Clients arrive with Excel, ISO registers and notebooks. The product accepts them as they are and normalises them, with a human approving only what it is unsure of. *(Nimish)*
- **Configure at the right level.** Settings cascade from company to plant, area, cell, machine class and machine, and rules can also key on criticality: PM frequency, Why-Why threshold, efficiency factor, load limits. *(Nimish; Bhavin agreed)*
- **Explainable numbers.** Every metric keeps a plain-language "how this is calculated" note, as the Guide does today.
- **Show less, drill deeper.** Each role sees a short action-first home screen; detail sits one click down. *(Nimish)*
- **Prove the improvement.** Every intervention is checked against later breakdowns. *(Nimish's gap; Bhavin has not designed it)*

**Who it is for first**

ISO-certified Indian discrete manufacturers with 50 to 300 machines, run on Excel and WhatsApp, starting with CNC machine shops. The same core must serve a foundry or a process line by configuration alone; Bhavin used both as examples of who might come next.

## Users, roles and access

We need seven built-in roles, editable per tenant, and data scoped by plant and cell. Today the file has no users at all, and the team list is just names for dropdowns.

| Role | Main device and channel | What they see first | What they can do |
| --- | --- | --- | --- |
| Operator / requester | Shared or personal Android, WhatsApp, QR on the machine | My open complaints and their status | Raise a ticket (stopped / running, photo, voice), confirm the machine is handed back |
| Technician | Android app, WhatsApp | My queue, unassigned jobs nearby, today's PM | Claim, start, pause (waiting for spares or vendor), close with job card, PM checklist, Fix Finder |
| Supervisor / maintenance engineer | Phone and desktop | Live board: machines down, unassigned, overdue, technician load | Assign and reassign, escalate, approve closures, Why-Why, schedule PM |
| Maintenance head | Desktop | Action Center, Team Focus, KPIs vs target | Set rules, approve RCA, decide overhaul or replace, run monthly review |
| Production / plant manager | Desktop and phone | Machine status, downtime by cell, forecast for planning | Raise tickets, view reports, acknowledge handback |
| Owner / management | Phone, emailed or WhatsApp report | Money lost, availability trend, top risks | Read-only, plus comments |
| Tenant admin | Desktop | Setup and data health | Users, plants, assets, settings cascade, imports, integrations |

Two platform roles sit outside tenants: our support staff (time-limited, logged access to a tenant) and our super-admin (tenant lifecycle, billing, model settings).

**Access rules to design in from day one**

- Permissions are checked by role × scope (company, plant, area, cell). A cell supervisor sees only their cells.
- Operators are free and unlimited, but every report is tied to a named person: a registered WhatsApp number, or on a shared device a pick-your-name plus PIN or badge QR. An unnamed "Operator" report would recreate the 590 anonymous rows in today's data. A phone registered with more than one company (a vendor, say) is asked "which plant?".
- Money figures (turnover, cost per hour) are hidden from technicians and operators by default.
- Every create, edit, assignment and status change is written to an audit log with who, when, and before and after values. ISO auditors and the blame-game problem both need this.
- Factories differ in hierarchy depth. Some have a single maintenance head; larger ones have head, engineer, supervisor and technician tiers. So role names and approval steps are configuration, not code.

## Capability map

The product has 15 modules. The prototype covers analytics deeply but has almost none of the operational workflow, so the build order inverts its menu: workflow first, analytics second. Phases are defined in the roadmap section.

| # | Module | In the prototype today | What we add | Phase |
| --- | --- | --- | --- | --- |
| 1 | Platform core | Nothing (browser storage, no users) | Tenants, login (phone OTP, email), roles × scope, audit log, notifications, English / Gujarati / Hindi UI, API | 0 |
| 2 | Setup and settings cascade | One Settings page: lists, 20 hrs × 300 days, efficiency 15%, Why-Why 24 hrs, codes, team, excluded machines | Company → plant → area → cell hierarchy; factory settings (sanctioned load, transformer kVA, floor area); shift and holiday calendars; overrides at category and machine level; industry template packs | 1 |
| 3 | Onboarding and import | Excel restore of its own export only; manual clean-up; Data Checklist | Phase 1: a deterministic importer for the prototype's own workbook, paste-from-Excel for machine lists, QR printing. Phase 2: any-format import (Excel, CSV, PDF, photos of registers and nameplates) with AI mapping and a review queue | 1 |
| 4 | Asset registry | Five data lists shown on six pages, cell-move log, asset card, record completeness, controller and make splits, purchase timeline | One asset model with classes and custom fields, parent and child assets (machine → spindle, ATC), criticality, documents, QR, meters (run hours) | 1 |
| 5 | Breakdown ticket loop | After-the-fact log only, filled from a PDF made by a separate mobile tool | Raise (app, WhatsApp, QR) → triage with severity (stopped vs running) → assign or claim → start, pause with reason → close with job card PDF + QR → operator handback; turnaround time; live machine-status board; escalation | 1 |
| 6 | Preventive maintenance | Not in this file (separate tool); PM is only a code in the log | PM plans by calendar or run-hours, ± tolerance, category checklists with readings, drag-and-drop calendar, load spreading, PM compliance, overdue alerts | 2 |
| 7 | Root cause (Why-Why) and CAPA | Why-Why form + PDF for breakdowns above a threshold | Auto-created RCA task with owner and due date; 5-Why and fishbone; corrective action tracked to closure; effectiveness check | 2 |
| 8 | Action Center and Team Focus | 13 alert types and ranked monthly actions; status kept in the browser only | Every nudge can become an assigned task; technician workload view and overload warning; rule library per tenant | 2 |
| 9 | Core analytics and reports | BD %, PM %, availability, MTTR / MTBF by month, cell, category and age; manpower; Pareto; drill-downs; monthly and annual reports | Same metrics computed server-side, defined to EN 15341 / SMRP where they apply; scheduled reports to WhatsApp and email; OEE availability later | 2 |
| 10 | Problem intelligence | Keyword problem groups, Fix Finder (fuzzy match, synonyms) | Multilingual meaning-based search, so Gujarati and misspelt English match; suggested fault codes at closure; cause extraction | 2 |
| 11 | Reliability and forecasting | Health score, Compare, Bottleneck with what-if, monthly Monte Carlo forecast, Forecast Lab, Laplace trend, repeat faults | Same methods as a server-side engine, run per tenant with back-testing; confidence shown everywhere; forecasts switched on only when a tenant has enough history | 3 |
| 12 | Money and energy | Money Matters (turnover-based cost per hour, four savings levers), energy heatmap, footprint packing | Cost per hour by machine or cell rather than equal weighting; load vs sanctioned load alerts; machine-level efficiency factor | 3 |
| 13 | Spares and inventory | Three free-text spare fields per breakdown; spare cost never filled | Parts master, usage on job cards, stock and reorder, critical-spares list from failure history and shared controllers | 3 |
| 14 | Feedback loop | None | Before-and-after tracking for every closed action, RCA and overhaul: did breakdowns on that machine and fault drop? | 3 |
| 15 | AI copilot and integrations | None | "Ask the plant" assistant (Bhavin suggested folding Fix Finder into an assistant like Nimish's Instinct demo) over the tenant's own history; controller and IoT signals (MTConnect / OPC UA, Cosmos's own Industry 4.0 system) as context, never as the source of truth; ERP and Tally export | 4 |

**What we deliberately do not port as-is**

- Five asset lists become one model with classes.
- Browser-only state (acknowledgements, Team Focus status, checklist notes) becomes shared, audited data.
- Fixed English keyword lists become tenant-editable dictionaries, plus meaning-based matching.
- Forecast Lab becomes an internal model-governance service. Planners see only the chosen forecast and its accuracy record.

## Onboarding and data ingestion

The client gets value on day one from a machine list and WhatsApp capture. History comes in afterwards through one "drop anything here" inbox, where AI proposes and a person approves only what it is unsure of. Do not make history import a gate to go-live: Bhavin's own migration needed weeks of hand-matching, and the Data Checklist exists because of it.

**Cosmos needs none of the AI pipeline.** Its history is already structured in the prototype's Excel backup: machine sheets, Breakdown Log, Cell Change Log, Why-Why and Settings. Phase 1 therefore ships a deterministic importer for that workbook, which strips the ISO document headers and finds the header row. It stitches day-by-day rows into episodes and maps Cosmos's codes to the global set. The AI drop inbox below is built in Phase 2, when the second tenant arrives with messy files.

**Stage 0. First value on day one (target: first ticket logged within 48 hours of signing)**

- Machine list from any of: paste from Excel, the recommended template, or one nameplate photo per machine. MaintainX (Enterprise plan only) and Limble's Asset Snap already create assets from photos, so this is expected rather than novel.
- Team added by phone number. Operators need no app or password; their phone number, or a name-and-PIN pick on a shared device, identifies them.
- An industry starter pack pre-loaded: machine classes, subunits, fault codes in plain language with Gujarati and Hindi labels, and PM checklists. CNC is first; foundry, forging and plastics follow.
- QR labels printed per machine, with each label a link that opens the report screen for that machine.
- WhatsApp breakdown capture live.

**Stages 1 to 6. The import pipeline for new tenants (Phase 2)**

1. **Drop.** One inbox per client accepts uploads or forwards: Excel or CSV in any layout, PDFs (invoices, ISO history cards, PM sheets), photos of registers and nameplates, and WhatsApp chat exports. Each file is classified automatically.
2. **Extract.** Spreadsheets get header-row and multi-table detection. PDFs go through Docling (MIT licence). Images are read by two engines (Sarvam Vision and a frontier vision model), and where they disagree the item is marked low-confidence. WhatsApp exports use our own parser, since the open-source one is GPL. Every value keeps a pointer to its source: file, sheet and cell, or page and region.
3. **Map.** First check the client's remembered mappings. Next, synonyms and embeddings shortlist candidate fields, and an LLM picks the match. Confidence comes from checkable signals (passes validation, engines agree, a remembered rule matched, repeated runs agree), never from the model's own stated confidence.
4. **Normalise in code, not prompts.** Dates are inferred per column (default DD-MM for India, raw value kept). Units are converted by explicit formulas: kW and HP are stored as given, and kVA conversion is flagged because it needs a power factor. Duplicate machines ("Star-01" vs "S-1") are matched on fuzzy name plus serial and model, then a person confirms and the alias is saved for that client. People and spares are linked to master records.
5. **Review.** Items above the threshold are accepted in bulk. Only low-confidence items reach a review screen showing source and value side by side, with candidate dropdowns, "apply to all similar", and a progress meter such as "212 of 240 machines confirmed". Every correction becomes a rule for that client.
6. **Commit.** Each approved change set is a reversible import batch with an audit entry.

**What a human always reviews:** new column mappings, machine merges, unit conversions, validation failures, and every handwritten Gujarati line until we have measured accuracy for that client.

**Build or buy the importer:** build it. Flatfile, OneSchema and Dromo do the spreadsheet part well, but none reads handwritten registers or WhatsApp exports. Their pricing (Dromo from $599 a month) does not fit a ₹50k-a-year customer. Use an MIT front end (react-spreadsheet-import) and copy their proven patterns.

**Honest limits**

- No OCR engine has published accuracy for handwritten Gujarati. Google Vision does not list it; Azure does not list Gujarati and AWS Textract does not support it; Sarvam claims support without numbers. Test on 50 real Cosmos registers before promising anything.
- Gujarati speech-to-text on noisy shop floors has no public benchmark either. Run a bake-off on 50 to 100 real voice notes (Sarvam Saaras, ElevenLabs Scribe, OpenAI) before choosing.

**Keep from the prototype:** the Data Checklist becomes a permanent "data health" score per plant. It lists what is missing, links straight to the fix, lets a user mark an item "not available", and keeps an audit log.

## UX, information architecture and design system

Replace the 29-item menu with four surfaces on one backend. Each surface opens on "what needs me now", and the analytics collapse into six workspaces with drill-down. This is how MaintainX, Limble and UpKeep are organised, with free requesters, a technician app and a manager console. Our edge is narrower than language support alone. Limble's 27 languages exclude Gujarati and Hindi, MaintainX has a Hindi UI and OxMaint claims Gujarati, but none turns a Gujarati voice note into a structured ticket.

**The four surfaces**

| Surface | Who | Navigation | Home screen |
| --- | --- | --- | --- |
| Report (no menu) | Operators | Scan QR, then one screen; second tab "My reports" | Big icons for problem type, stopped or running toggle, photo, voice note, Send |
| Technician app | Technicians | My work · Scan · Machines · Me | Assigned, unassigned nearby, today's PM, overdue; works offline with an outbox |
| Console | Supervisors, maintenance head, planners | Inbox · Work orders · PM planner · Machines · Reliability · Team · Reports | Inbox: new tickets to triage, approvals, escalations, overdue, technician load |
| Overview | Owners, plant and production managers | Overview · Reliability · Cost and energy · Machines · Reports | KPI tiles against target and trend, plus the exceptions list |

The admin area (setup, imports, users, codes, PM templates, escalation rules, languages, billing) sits behind a settings icon on the console.

**How the 29 prototype screens fold into six workspaces**

| Workspace | Absorbs from the prototype |
| --- | --- |
| Inbox and Action Center | Action Center, Team Focus, Why-Why due, Data Checklist items |
| Work orders | Breakdown Log, PDF import (retired once the ticket loop is live) |
| PM planner | The separate PM tool: calendar, checklists, load spreading |
| Machine 360 | Six asset lists, asset card, machine detail, Compare, health score, that machine's forecast, Fix Finder as a "similar past fixes" panel |
| Reliability | BD % and PM split, category and cell, MTTR and MTBF, age, problem analysis, bottleneck and what-if, forecast for planning, trend and repeat faults. One page with filter chips for plant, cell, class, age band and period |
| Cost and energy | Money Matters, energy heatmap, footprint |

Reports (monthly, annual, ISO formats) become scheduled outputs, not pages people browse. The Guide becomes a "how is this calculated" panel on every number.

**Also carried over, and easy to lose in the fold**

- **Team page** (console): per-person attended, supported and PM counts, average repair time, team vs vendor split and the specialisation matrix (prototype Manpower page). Bhavin called team performance a key output.
- **Why-Why register** with its PDF, inside the Inbox and RCA flow.
- **Breakdown-free streak** tile with its record line, on the Overview. It is the one gamified number the team pushes up.
- **Excel export on every list and drill-down**, including the planning-forecast workbook, the repeat-fault sheet that doubles as a Why-Why sheet, and registers carrying each tenant's own ISO document numbers (Cosmos uses CE-MTN-F-01 and F-04).
- **Report commentary:** the monthly and annual reports keep management notes, an action table and the auto-written "what went well" and "concerns", saved with the report.

**Shop-floor design rules**

- Touch targets at least 48 × 48 dp, larger for gloved use. No published glove standard exists, so test on the floor.
- Grey-first screens in the style of ISA-101 high-performance HMI. Red and amber are used only for down and overdue, and colour always comes with an icon and a word (WCAG 1.4.1).
- Single column, linear flow, no fly-out menus for operators (NN/g guidance for lower-literacy users).
- Gujarati and Hindi are the default for the operator and technician surfaces, English for the console; every user can switch. Keep the raw audio beside every transcript.
- No more than two levels of drill-down from any home screen.

**Charts and dashboards**

- Every KPI is shown against a target and its own history (sparkline or bullet graph), never as a bare number or gauge.
- Use bars, lines, scatter, heatmaps and Pareto. No pies, donuts or 3D.
- Keep operational screens (live, time-critical) separate from analytical ones (monthly, reflective).

**Front-end stack (licences checked)**

| Need | Pick | Licence |
| --- | --- | --- |
| Components | shadcn/ui + Tailwind | MIT |
| Standard charts | Recharts 3 through shadcn charts | MIT |
| Heavy charts (heatmaps, Pareto, long series) | Apache ECharts 6 | Apache-2.0 |
| Tables | TanStack Table + Virtual | MIT |
| PM calendar | FullCalendar Standard (drag-and-drop is free; rows by technician or machine are Premium, from $480) | MIT / commercial |
| Languages | next-intl, Noto Sans Gujarati and Devanagari | MIT / OFL |

Avoid Tremor's npm package (no release since January 2025, after Vercel bought it) and AG Grid's paid features unless a customer needs pivot tables.

**Notification ladder** (configurable per criticality)

1. In-app and push to the assignee immediately.
2. WhatsApp to the technician and supervisor if the ticket is not acknowledged within N minutes.
3. SMS as a fallback. This needs DLT template registration in India.
4. Daily or weekly digest to managers by email or WhatsApp.

A design partner should prototype the four home screens in Figma and test them with five Cosmos operators and technicians before the build locks.

## Analytics and forecasting engine

Port Bhavin's methods as the starting model, rebuild them on proven open-source statistics libraries, and let a per-tenant back-test decide when a better model replaces them. His forecast is already a hand-built version of what the textbooks recommend for repairable machines: a machine's rate blended with its category's (gamma-Poisson pooling), repeat entries merged into episodes, and a Laplace trend test. So the work is engineering and governance, not new science.

**Engine design**

- **Where it runs.** Bhavin's calculations are first ported as a TypeScript package in the same codebase and run as scheduled and event-triggered jobs, so they can match his seeded simulations exactly. The engine reads Postgres and writes result tables: KPIs per period, scores, forecasts, nudges. A Python service, hosted in India, is added only when challenger models or document parsing need it. The app only reads results. It recomputes after every ticket change for live KPIs and nudges, and nightly for heavy models.
- **One definition per metric.** Each KPI is defined once in SQL, mapped to the nearest SMRP Best Practices metric (3.5.1 MTBF, 3.5.2 MTTR, 5.4.14 PM compliance and so on). It is called "SMRP-aligned" only once operating-time calendars exist and denominators are documented: today's MTBF uses nominal 20 × 300 hours, and MTTR counts zero-hour events. Its plain-language formula is shown on hover. This replaces the 490 functions where the same number is computed several ways today.
- **Answer key.** Capture every number the prototype shows from Bhavin's live Excel export at a frozen as-of date. His live data sits in his browser, not in the file's embedded copy, and many figures depend on today's date. A legacy-compatible mode (20 × 300 hours, date-level rows, the same exclusions and random seeds) must match exactly. Every difference under the new rules is documented one by one. This is the main safety net for a non-technical owner.

**Methods and the libraries that carry them**

| Job | Today in the file | Product approach | Library (licence) |
| --- | --- | --- | --- |
| Is a machine getting worse? | Laplace trend test, pooled | Trend test first, then a constant-rate model or a power-law model (Crow-AMSAA) per machine class; fleet mean cumulative function (MCF) | SurPyval (MIT); `reliability` (LGPL) as cross-check |
| Monthly breakdown forecast | Gamma-Poisson pooling, 2,000-run Monte Carlo, resampled repair times | Port as the starting model; challenger = hierarchical negative-binomial with partial pooling by class and age | PyMC / Bambi (Apache-2.0 / MIT), statsmodels (BSD) |
| Model selection | Forecast Lab: monthly back-test, pinball loss, adoption rule | Choose the model family on a back-test pooled across tenants; fit parameters per tenant; switch a tenant's model only after 12+ test months and a person's sign-off. Planners see only the chosen model and its track record | own code |
| Health score (0 to 10, age-adjusted) | Category × age fit, log mapping, six weighted parts | Keep the scale and labels; take "expected" from a versioned, frozen baseline so a model change never silently re-scores every machine; drop the spares part until spares cost is recorded | own code |
| Fix Finder and problem groups | Keyword lists, synonyms, edit distance | Hybrid search: meaning (multilingual embeddings) + spelling (trigram) + keyword, combined by rank; an LLM sorts each closed ticket into the tenant's fault taxonomy | pgvector, pg\_trgm (PostgreSQL licence); bge-m3 or multilingual-e5 (MIT) |
| Spares demand | Not present | Intermittent-demand methods for the critical-spares list | statsforecast (Apache-2.0) |
| Dashboards | Chart.js inside the page | Built in the app with ECharts; embedded Superset later, only if customers want self-serve | ECharts, Superset (Apache-2.0) |

**Guardrails Bhavin's notes already point to, made into rules**

- **Minimum data before showing a forecast.** Per-machine trend and power-law fits need about 5 to 8 failures, and below that the class figure is shown. The pooled per-machine forecast stays for every machine with its confidence label; at Cosmos, 52 of 125 machines have fewer than 5 episodes, and blanking them would hide 42% of the fleet. A new plant's forecasts start once its records, imported or live, pass a data-health threshold: for example no gaps of 4 days or more and at least 70% of entries coded.
- **Censoring done properly.** The time since a machine's last failure counts as "still running", and machines that were running before records began are treated as such. Today every machine's history is assumed to start on 1 January. The switch to the ticket loop is also a changepoint: logging volume will jump when WhatsApp groups and paper stop. The engine stores each plant's capture-start date, fits a level shift there, and never runs a trend test across it.
- **Confidence on every number.** High, medium or low, plus the reason (days of history, breakdown count).
- **No OEE claims** until we capture production data; availability only.

**The feedback loop (new, designed here)**

Every closed action (a repeat-fault fix, a Why-Why corrective action, an overhaul) gets a watch window, 60 or 90 days, configurable. At the end, the engine compares that machine's rate for that fault group with a baseline that excludes the spike which triggered the action, since counts fall back after a spike anyway. It also compares with similar machines that had no action. It labels the action "held", "did not hold" (a linked follow-up action lands in the Inbox), or "too early to say" until about three breakdowns would have been expected. The "held" rate feeds Fix Finder, so fixes are ranked by whether they worked, not only by how often they were used. Team Focus already reopens done items when a fault returns; this generalises it and gives management the before-and-after proof Bhavin said he has not designed.

**Bugs the rebuild must not inherit** (from the line-by-line read)

- Edit forms erase data: editing a breakdown wipes its Why-Why; editing a machine drops fields the form does not show.
- Moving a machine through the edit form skips the cell-move log.
- The dashboard mixes all-years and latest-year figures.
- Two Why-Why thresholds, 24 and 12 hours, are used in different places.
- Clean-up lists delete certain team names and codes on every load.
- The seed-data merge on a version upgrade brings back deleted records.
- Duplicate detection can delete real repeat breakdowns.
- Scores refresh only when record counts change, not when records are edited.

## Build vs buy

Build the product fresh on a mainstream stack; do not fork an open-source CMMS. This pushes back on the instinct to build on an existing system. We do build on open source, but at the level of platform and libraries, not a finished CMMS. Reuse open-source *libraries* heavily and study the best CMMS as a reference. The parts that make this product different (WhatsApp and Gujarati capture, the accountability loop, the analytics) are exactly the parts any base would need rewritten.

**Update, 28 October: direction changed to build on Atlas.** Nimish's call is not to reinvent the baseline. A check of the Atlas repository changes the picture:

- **All of Atlas is AGPL, including the locked premium features.** The whole repository, among them asset hierarchy, PM calendar, downtime, request portal, voice notes and unlimited assets, is published under one AGPLv3 licence. Its own commercial licence confirms this (section 7.1).
- **The commercial licence does not fit us.** It bans building a competing product (3.5) and allows SaaS only when Atlas is not the primary product (3.6).
- **So the realistic path is an AGPL fork:**
  - Publish our modified Atlas source to our customers.
  - Keep the legal notices and drop the Atlas name.
  - Run our differentiators as separate services: WhatsApp and Gujarati intake, the analytics engine, AI onboarding.
- **The licence check can probably be switched off.** Disabling the licence-key check in our fork appears permitted under AGPL, but a lawyer must confirm before launch.
- **Ask for a price in parallel.** Email Intelloop for an Enterprise SaaS licence price, which would allow closed modifications.

Details are in the handoff pack (research note 08). The stack, roadmap and cost sections above describe the fresh-build fallback and will be revised after the Atlas proof of concept.

**Proof of concept, 28 October: Atlas runs Cosmos.** The fork is built from source with every feature unlocked (34 features, no licence key) and runs locally. It holds Cosmos's 191 assets, 26 locations, 1,158 breakdowns as work orders and 987 downtime events. A second company sees none of Cosmos's data. Atlas covers the operational core: work orders, requests with voice notes, PM, checklists, parts, roles, workflows, API, mobile app and basic reliability analytics.

What we build on top:

- An importer that keeps history: the fork already fixes completion dates; creation dates and downtime still need it.
- Cells as a second dimension next to the location tree.
- Effective-dated cell moves.
- Shift-calendar-based KPIs and NO DT. Atlas computes MTTR only from logged labour and availability on a 24-hour clock.
- Breakdown fields and RCA.
- Phone and WhatsApp identity for operators.
- WhatsApp, Gujarati and transcription.
- All of Bhavin's advanced analytics.

The core becomes Java/Spring and React, hosted as containers in India. Our services sit beside it. Full fit-gap and patches: handoff pack, folder atlas-poc.

**Candidate bases we looked at**

| Base | Licence | Verdict | Why |
| --- | --- | --- | --- |
| [Atlas CMMS](https://github.com/Grashjs/cmms) | AGPL-3.0 + commercial | Reference only | Best feature fit (work orders, PM by time or meter, checklists, parts, asset tree, mobile, multi-company). But: AGPL forces us to publish our changes; premium features are licence-gated in the code; the authors sell the same product at $0 to $40 per user per month; it is Java/Spring, a large codebase we did not write |
| [Frappe Framework](https://github.com/frappe/frappe) + ERPNext | MIT / GPL-3.0 | Credible alternative | Permissive, auto-generated admin screens, roles, workflows, and an MIT WhatsApp app. But its maintenance module is thin, the UI is desktop-ERP, and it uses one database per tenant. That isolates tenants by construction, which is a real advantage, but gets heavy across hundreds of small plants. Choose it only if inventory, purchasing and GST invoicing matter in year one |
| Odoo Maintenance | LGPL-3 (Community) | No | Basic module; useful features sit in the proprietary Enterprise edition |
| openMAINT, CalemEAM, Shelf.nu | AGPL, custom, AGPL | No | Facilities-oriented, dead, or asset-tracking only; closed mobile apps |
| Zammad, Chatwoot, Frappe Helpdesk | AGPL / MIT core + proprietary | No | Customer-support inboxes with no machine, PM or asset model |

**What we reuse instead (all permissive or server-side-safe)**

- **Platform:** PostgreSQL with row-level security, through Supabase (Apache-2.0, can be self-hosted later).
- **Front end:** Next.js, shadcn/ui, ECharts, TanStack, FullCalendar, next-intl.
- **Statistics:** SurPyval, statsmodels, PyMC/Bambi, statsforecast, pgvector, rapidfuzz.
- **Documents:** Docling for PDFs; a server-side PDF library for job cards.
- **Paid APIs** (pay as you go, swappable): WhatsApp Cloud API direct from Meta; Sarvam for Gujarati speech and documents; one frontier LLM for mapping, classification and the copilot.
- **Reference specs to study, not copy:** Atlas's data model (asset tree, PM triggers, checklists, parts); MaintainX, Limble and UpKeep's requester-portal and technician flows; IBM Maximo Predict's history-only failure ranking.

**Licence rule for the codebase:** no AGPL or GPL code is copied in. LGPL and GPL Python libraries (`reliability`, scikit-survival) are fine on our servers, but must be reviewed before any on-premise install, because shipping software counts as distribution. Get a one-hour review from an IP lawyer before launch; this is not legal advice.

## Reference standards and the data model

Build the data model on published standards so that a foundry or a pharma plant fits without code changes. Use ISA-95 for where equipment sits, ISO 14224-style coding for how it fails, EN 13306 for maintenance terms, and SMRP / EN 15341 for KPIs. These standards are borrowed for structure; we write our own code lists, because the ISO annexes are paid and cannot be copied.

**Equipment hierarchy**

| Level | Our name | ISA-95 equivalent | ISO 14224 level | Cosmos example |
| --- | --- | --- | --- | --- |
| 0 | Company (tenant) | Enterprise | 1–2 | Cosmos |
| 1 | Plant | Site | 3 | Plant at location 434/445 |
| 2 | Area | Area | 4 | Location 841-A |
| 3 | Work centre, typed: cell, line, process cell, utility, store | Work centre | 5 | Cell 7 |
| 4 | Asset (equipment unit), with a class from the library | Work unit | 6 | TC-3, Turning Center |
| 5 | Subunit | — | 7 | Spindle, ATC, axis drive, coolant, CNC control |
| 6 | Maintainable item | — | 8 | Bearing, ball screw, servo motor, encoder |
| 7 | Part (links to spares) | — | 9 | Specific bearing part number |

The position in this tree is stored separately from the physical serial-numbered machine, with effective dates. A machine that moves cell or is swapped keeps its history. This generalises Bhavin's cell-move log.

**Core records to design tomorrow**

- **Organisation:** tenant, plant, area, work centre; shift and holiday calendars per plant; factory limits (sanctioned load, transformer kVA, floor area).
- **Assets:** asset class (the template: attributes, subunits, allowed fault codes, PM tasks, check points, criticality); asset, with effective-dated flags such as "counts in production KPIs" and "power supply, never counted as load"; location history; documents and photos; meters (run hours).
- **Codes:** one global ISO-aligned set of failure mode, mechanism, cause (design, installation, operation or maintenance, management) and detection method. Each tenant gets its own aliases and Gujarati or Hindi labels, plus a plain-language symptom picker that maps to codes. Cosmos's E, M, AX, SP, ATC, LIK and similar codes are mapped once.
- **Work:** request (ticket) → work order typed corrective, preventive, RCA, action or inspection → a status timeline (reported, acknowledged, assigned, started, paused with reason, resolved, handed back, reopened) → downtime interval (machine stopped to restarted), kept separate from labour time → labour entries per person → parts used → attachments (photo, voice, transcript) → job-card PDF.
- **PM:** plan with trigger (calendar or run hours) and tolerance; checklist template, items and readings.
- **Improvement:** RCA (5-Why, fishbone) → corrective actions → effectiveness check.
- **Platform:** users, roles and scopes; a settings table with scope (company, plant, area, cell, class, asset, plus rules keyed on criticality) where the most specific value wins; audit log; notifications; import batches with source pointers.
- **Engine outputs:** KPI results, nudges, forecasts, scores, model versions and back-test scores.

**Five modelling decisions that fix the prototype's data problems**

1. One breakdown = one ticket with start and end times, not one row per day. A recurrence on the same machine and fault group within N hours of closure links to the parent ticket, so episodes stay intact. First-time-fix and rework rates then become accountability KPIs. Imported day-by-day history is stitched into episodes on import.
2. Timestamps, not dates. Shift is derived from the plant's shift calendar, and MTTR becomes exact.
3. Available hours come from shift and holiday calendars and each machine's in-service dates, not a single 20 × 300 constant.
4. The ticket records the machine's state: stopped, or running with a problem (Bhavin's air-leak example). Lost production hours = the stopped interval overlapping the plant's production calendar. The prototype's "NO DT" (repaired outside production hours or at lunch) then falls out automatically as a stop with zero lost hours, and the "breakdown hours but no downtime" reconciliation stays. Decide explicitly whether zero-loss events count in MTTR.
5. Every row carries tenant, creator, channel (app, WhatsApp, import) and an audit trail. Named people replace "Maint. Team" and "Operator".

**The ISO claim: unsupported.** ISO 9001:2026 was published on 16 September 2026 and stays technology-neutral: documented information may be in "any format and media". We found nothing that makes digital maintenance records mandatory. The likely source of the confusion is ISO's new digital *format* of the standard itself. The defensible pitch is narrower: auditors under ISO 9001 clause 7.1.3, and especially IATF 16949 clause 8.5.1.5 (TPM, which expects MTBF, MTTR, OEE and PM-compliance objectives) for auto suppliers, already ask for this evidence. Digital makes it a one-click export. Do not put the "mandatory" claim in any sales material.

## Architecture and tech stack

Use one Postgres database in Mumbai with tenant isolation enforced by the database itself, one Next.js application serving every surface, and background workers for speech, documents and analytics (TypeScript first, Python later). Everything runs on managed services so that a non-technical owner building with AI coding agents runs no servers. This is the recommendation to test in tomorrow's session, not a settled decision.

*(Diagram in the shared doc: five channels → one application core → Postgres, file storage and job queue → AI workers and the analytics engine. With the Atlas decision the core is Atlas (Java/Spring, React) on AWS Mumbai; see "Infrastructure to set up".)*

WhatsApp, the QR report screen, the technician app, the console and the import inbox all write through the same ticket core; workers pick jobs off a queue and write results back to Postgres, which every screen reads.

| Layer | Choice | Why |
| --- | --- | --- |
| Database, auth, files, queue | Supabase in ap-south-1 (Mumbai) | Postgres with row-level security, phone OTP auth, storage and queues from one vendor; data stays in India; can be self-hosted later |
| Tenancy | Shared schema, `tenant_id` on every row, enforced by row-level security; role and scope carried in the login token | Lowest running cost and effort; a dedicated database becomes a paid enterprise option |
| Web and apps | Next.js on Vercel, functions pinned to Mumbai (bom1); one progressive web app for operators, technicians and the console | One codebase, no Play Store step; a printed QR is just a link; go native (Expo) only if offline sync outgrows the web app |
| WhatsApp | Meta Cloud API directly, one shared number at launch, messages routed by the sender's registered phone. Nimish proposed one number per company; shared is cheaper to start, but every tenant then shares one quality rating and one ban risk | No reseller markup; since 1 October 2026, messages inside the 24-hour window are charged after 1,000 free per number per month, at about ₹0.115 per utility message plus GST; the account must bill in INR by 31 December 2026 ([Meta pricing](https://developers.facebook.com/docs/whatsapp/pricing)); a number per tenant becomes a paid tier later (needs Meta Tech Provider enrolment) |
| Speech and documents | Sarvam (Saaras speech-to-text with Gujarati, Vision for documents), behind our own interface so it can be swapped | Indian languages, India-hosted (vendor claim, to be confirmed in the contract), about ₹0.49 per minute |
| LLM | One frontier model behind the same interface | Column mapping, fault coding, ticket summaries, copilot |
| Analytics | TypeScript port of Bhavin's engine as scheduled jobs first; Python (FastAPI) on Cloud Run asia-south1 or AWS Mumbai when challenger models arrive | Exact match with the prototype's JavaScript, including seeded simulations; the Python statistics libraries come with the challenger models |

**Rough running cost, first 10 plants (estimate):** roughly ₹15,000 to 25,000 a month in infrastructure. That covers Supabase Pro with point-in-time backup (about $130), Vercel Pro seats, a small Python host once needed, speech-to-text for about 3,000 voice notes, WhatsApp templates, and LLM calls for ticket coding (under ₹1 a ticket). People costs, such as the part-time security reviewer, are extra. Rebuild this per component before quoting margins.

**Non-negotiables to write into the architecture document**

- Every table has a tenant ID and row-level security from the first migration. Row-level security only protects logged-in requests, and the riskiest paths (WhatsApp webhook, workers, import committer) run without a user session. They connect as a restricted database role that must set the tenant before every job. The all-powerful service key lives in one small audited module, and an automated check blocks it anywhere else. Cross-tenant tests run through the API, the webhook and the workers, and must all fail.
- An audit log from day one, kept at least one year: the DPDP Rules require log retention, and ISO audits need it.
- WhatsApp media links expire in 5 minutes, so the system saves every photo and voice note to our storage on arrival.
- The WhatsApp bot stays task-bound (report, update, status). Since 15 January 2026, Meta's terms bar general-purpose AI assistants on the Business API; the copilot lives in the app.
- Data protection (India's DPDP Act). The factory is the data fiduciary and we are its processor for running the service. For our own uses (training models, cross-tenant benchmarks) we become a fiduciary, which needs separate consent and contract terms. The main obligations apply from 13 May 2027; a proposal to bring this forward to 13 November 2026 had not been notified as of 9 October 2026, so re-check. Phase 1 already collects workers' phone numbers and voice recordings, so from Phase 1 we need a data-processing agreement template, a worker notice, breach alerting fast enough to support the 72-hour report, and per-tenant export and erasure. Confirm the details with a lawyer.
- No on-premise build now; we found no evidence Indian MSMEs demand it. Supabase being self-hostable keeps the option open.

## Competitive landscape and pricing

"Nobody else has these features" is wrong, feature by feature. Each piece already exists somewhere: WhatsApp intake (Keep Wisely), Hindi interfaces (MaintainX, Cryotos), clustering of breakdown remarks (Fast Maintenance), fix suggestions from past work orders (MaintainX), and history-based failure ranking (IBM Maximo Predict). What we found nowhere is the *combination*, for a sensorless 100 to 300 machine Indian shop at an SMB price. Absence is based on the vendors checked, not proven.

**Closest competitors (prices as published, checked 27 Oct 2026)**

| Vendor | Who it serves | Price | WhatsApp | Indian languages | Forecast or AI, as claimed |
| --- | --- | --- | --- | --- | --- |
| [Keep Wisely](https://keepwisely.com/pricing) | Indian plants and facilities | ₹799–999 per user per month (Starter), ₹1,999 (Professional); requesters free | Raise and update work orders (Professional and above) | "Multi-language", unspecified | Q&A bot, AI checklists, self-diagnosis |
| [Fast Maintenance](https://www.fastmaintenancesoftware.com/) (Pune) | Indian manufacturers | Not published | Alerts only | Not stated | Clusters breakdown remarks into failure themes |
| [OxMaint](https://oxmaint.com/pricing) | India and global SMB | $19 / $49 per user per month | Not mentioned | Claims a Gujarati and Hindi technician UI | "Predictive insights", voice work orders |
| [Cryotos](https://www.cryotos.com/pricing) | India and global | $29 to $69 per user per month | Enterprise plan, direction unverified | Hindi, Tamil | AI knowledge base |
| [InnoMaint](https://www.innomaint.com/pricing/) | Indian manufacturing and facilities | Not published | Sales widget only | Unspecified | LLM chatbot; predictive needs IoT |
| [TeroTAM](https://www.terotam.com/pricing) (Ahmedabad) | Indian multi-industry | Not published | Possible add-on | Unspecified | Claims history-based prediction; thin evidence |
| [MaintainX](https://www.getmaintainx.com/pricing) | Global frontline | $0 / $20 / $65 per user per month; requesters free | No | Hindi UI only | Fix suggestions from past work orders, voice-note summaries |
| [Fiix](https://www.fiixsoftware.com/pricing/) | Global manufacturing | $0 / $45 / $75 per user per month | No | Unspecified | Trends in maintenance time and cost from history; not failure prediction |
| [IBM Maximo](https://www.ibm.com/products/maximo/pricing) | Enterprise | Essentials under $40,000 a year | No | — | Predict ranks assets most likely to fail, from history alone |

**Where we can genuinely win**

1. **A Gujarati or Hindi WhatsApp voice note becomes a structured ticket**, with machine, symptom and stopped or running, and no app to install. No vendor checked does this end to end.
2. **Two-sided accountability.** Production confirms the handback, tickets can be disputed and reopened, and response and repair times are attributed to each side. Competitors have request portals and free requesters, but none markets this loop.
3. **Sensorless reliability analytics at SMB price:** age-adjusted health, a monthly forecast with a published track record, bottleneck and what-if. Only Maximo comes close, at enterprise prices.
4. **Pricing per plant with unlimited operators.** Every competitor with a published price charges per user. Requesters are often free, but the supervisors and production managers who approve handbacks are paid seats.

The moat is the clean, vernacular-captured history, not the formulas. Fiix, Maximo and Tractian could add forecasting quickly.

**Pricing recommendation (a hypothesis to test in the first 10 sales calls)**

Nimish proposed a flat price with two analytics tiers and no user limits, which is right. We add one thing: banding by machine count, so a 30-machine shop and a 300-machine plant do not pay the same. "Machine" needs a definition. Cosmos has 191 assets, of which 125 are CNC, and we suggest billing production machines only. Bhavin's ₹49,999 a year is a good *entry* price for a small shop, but it underprices a 150-machine plant. Keep Wisely's rates for 10 to 15 paid seats come to roughly ₹1.2 to 3.6 lakh a year for the same plant. Indicative structure:

| Tier | What is included | Indicative price (to validate) |
| --- | --- | --- |
| Core | Ticket loop, WhatsApp and voice, PM, assets, Fix Finder and suggested fault codes, standard KPIs and reports, Data health | About ₹60 per machine per month, minimum ₹4,000 a month (≈ ₹50k a year for a 70-machine shop) |
| Insight | Core + health score, forecasts, bottleneck, money view, feedback loop, copilot | About ₹120 per machine per month (≈ ₹2.2 lakh a year at 150 machines) |
| Onboarding | Import and clean-up of historical records, QR labels, training | One-time fee, partly credited against year one |

Bhavin's 50% early-bird offer works best as "founding customer" pricing tied to a case study and data-sharing consent. Our variable cost is roughly ₹1,000 to 2,000 a month per plant (WhatsApp, speech, LLM, compute), so gross margin is not the constraint; adoption is.

## Phased roadmap

Ship the accountability loop at Cosmos first, prove a second plant from a different industry can onboard with configuration alone, and only then sell forecasting. Dates are indicative for one AI-assisted builder plus part-time engineering review. They assume the commercial terms with Bhavin are settled in November.

*(Roadmap diagram in the shared doc; same content in the phase table below.)*

Each phase starts only when the previous gate is met; the Cosmos pilot gate (four weeks with no WhatsApp groups or paper; 90% of tickets with a named person and a fault code; at least 80% of the usual volume of about 115 breakdowns a month, so the gate cannot be met by logging less; catch-all codes under 10%) is the one that proves the product.

| Phase | Indicative dates | What ships | Gate to move on |
| --- | --- | --- | --- |
| 0 Foundation | Nov–Dec 2026, about 6 weeks | Data model, tenancy and isolation (including webhook and worker paths), login, roles, audit log, settings cascade; Cosmos workbook importer; answer-key fixtures at a frozen date; screens tested with Cosmos staff | Cross-tenant tests fail on every path; legacy mode matches Cosmos numbers exactly |
| 1 Cosmos pilot | Jan–Mar 2027, about 12 weeks | Ticket loop (WhatsApp, voice, QR report screen, technician app), job-card PDF, live machine-status board, assets, core KPIs, Data health, nightly export back into the prototype's workbook format, data-processing agreement and worker notice | The pilot gate above |
| 2 Second plant | Apr–Jun 2027 | PM planner and checklists, Why-Why and CAPA, nudges become tasks, Reliability workspace, Team page, Cosmos engine port, AI import inbox, second tenant from another industry | Second tenant onboarded in under 2 weeks with no code changes; DPDP-ready by 13 May 2027 |
| 3 Insight tier | Jul–Sep 2027 | Forecast engine with governance, health score, bottleneck, money view, spares, feedback loop | Data-health threshold met; forecast accuracy published per tenant |
| 4 Scale | Oct 2027 onward | Copilot, a WhatsApp number per tenant, controller data (OPC UA, Cosmos's Industry 4.0 system), ERP and Tally export, more industry packs | Targets set after Phase 2 sales calls |

**What is deliberately later than Bhavin may expect:** forecasting and Money Matters move to Phase 3. They already work on Cosmos's data, but selling them to a new plant before it has 6 months of clean tickets would produce numbers we cannot defend. Cosmos cannot simply keep using the current file, because it stops receiving data once tickets replace the mobile form, and Bhavin sends the planning forecast every month. So Phase 1 includes a nightly export from the new database in the prototype's backup-workbook format (fixed column positions, DD-MM-YYYY dates, the NO DT code) for him to restore into the file. The Cosmos engine port is pulled forward to Phase 2.

## Risks, open decisions and inputs needed

The biggest risk is not technical. It is building a company's codebase on Cosmos's code, data and brand with nothing written down about who owns what. Settle that before Phase 0.

**Decisions to settle, in order**

| # | Decision | Recommendation | Needed by |
| --- | --- | --- | --- |
| 1 | Ownership across three parties: Bhavin; Cosmos Engitech Pvt Ltd, whose data, documents and time built the file, so it may own that work; and the new entity. Who owns code, brand and entity; Bhavin's role; Nimish's role (equity, retainer, build fee); who funds the build | Separate entity; written sign-off from Cosmos management on IP and data use; Cosmos as founding customer | Before Phase 0 |
| 2 | Data rights: can Cosmos's data be used to tune models, benchmark other tenants, or appear in case studies? | Yes, anonymised, in writing, with employee names removed from test data. For these uses we act as data fiduciary, not processor | Before Phase 0 |
| 3 | Platform: Supabase + Next.js (recommended) or Frappe | Decide in tomorrow's architecture session | Tomorrow |
| 4 | Who reviews AI-written code for security and tenant isolation | A part-time senior engineer, a few hours a week, from Phase 0 | Phase 0 |
| 5 | First segment and second-tenant target | CNC job shops in Gujarat, plus one foundry or forging plant for Phase 2 | Phase 1 |
| 6 | Pricing model | Per plant, banded by machines, two tiers (see pricing section) | Before first external sale |
| 7 | WhatsApp business verification: under which legal entity and number | The new entity, one shared number | Phase 1 |

**Start now, because they block Phases 0 and 1:** forming the entity, Meta business verification, and DLT registration for SMS. Until verification clears, the Cosmos pilot runs on the QR report screen, and login codes go out as WhatsApp authentication templates.

**Inputs to get from Bhavin this week**

- [ ] The second tool: PM calendar, category checklists and "spread the load" logic, plus the mobile form tool that makes the job-card PDF
- [ ] 10 sample job-card PDFs and 5 PM reports
- [ ] Raw source files as they were before he cleaned them: master list, ISO formats (CE-MTN-F-01, F-04), old Excel logs, and the 5-year history if it exists
- [ ] 50 photos of handwritten registers and nameplates (OCR test), and 50 to 100 shop-floor voice notes in Gujarati, recorded with consent (speech test)
- [ ] Cosmos's real hierarchy: who raises, who assigns, who approves, who escalates to whom, and expected response times by machine criticality
- [ ] Factory limits: sanctioned load, transformer kVA, floor areas
- [ ] InnoMaint login, plus any other tools Cosmos has used
- [ ] Introductions to 2 or 3 peer plants, at least one outside CNC, for discovery calls

* [ ] Bhavin's live Excel export (his current data lives in his browser, not in the file we have), to freeze the answer key
* [ ] Confirm two rules: the Why-Why threshold (he said 12 hours; the file defaults to 24) and the repeat-fault rule (he said four times in 20 days; the code uses three in 30)

**Risks**

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Operators do not adopt | No tickets means no data and no product | WhatsApp and voice first; production heads enforce Bhavin's "only logged problems count" rule; track the share of tickets with a named person each week |
| Gujarati speech and handwriting accuracy is unproven | Voice is central to the pitch | Bake-offs before committing; always keep the audio; a human confirms low-confidence text |
| Building analytics before clean data exists | Bad forecasts kill credibility | Phase gates; confidence labels; forecasts only after 6 months |
| An AI-written codebase leaks data between tenants | One leak ends the business | Database-enforced isolation, automated cross-tenant tests, external review before the second tenant |
| Single-customer design | Cosmos-specific assumptions get baked in | Second tenant from a different industry in Phase 2; no Cosmos constants in code |
| WhatsApp policy or price changes | Capture channel at risk | Keep the web report screen as an equal channel; isolate WhatsApp behind one service |
| Fast followers (Keep Wisely, OxMaint) add vernacular voice | Feature edge erodes | Win on the accountability loop and track-record analytics; move fast at Cosmos-like plants |
| DPDP obligations from 13 May 2027 | Legal exposure for every customer | Build the data-processing agreement, consent notices, breach process and erasure into Phase 2 |

## Ticketing and escalation matrix

The core of the product is a self-hosted ticketing system for machines, and we build it inside our Atlas copy, not as a separate helpdesk. Atlas already has tickets (work orders and requests), a scheduler and notification channels. What it lacks is any sense of time: it reacts when a ticket is created or closed, but nothing happens when a ticket sits untouched for 30 minutes. That clock and the escalation ladder are ours to build.

*(Diagram in the shared doc. Ticket states: Raised (WhatsApp, QR or app) → Triaged (S1–S4) → Assigned or claimed → Acknowledged → In repair ⇄ Paused (spares, vendor, production release; SLA clock pauses, downtime clock never does) → Resolved (job card) → Pending handback (production confirms) → Closed; a dispute reopens the same ticket. Escalation ladder: L1 technician at creation → L2 supervisor (acknowledge missed or "beyond my skill") → L3 maintenance head (restore missed, long pause, 2nd reopen) → L4 plant head (critical machine still down).)*

Every ticket follows this path. Production must accept the machine back before it closes; a dispute reopens the same ticket, and a second reopen goes to the maintenance head as a repeat failure.

**Why not plug in an open-source helpdesk?** We checked eight: Zammad, Frappe Helpdesk, osTicket, GLPI, Request Tracker, Znuny/OTOBO, FreeScout and UVdesk. None understands "machine stopped" or machine criticality. Running one beside Atlas means tickets in one system and machines, downtime, spares and labour in another, kept in sync forever. GLPI's escalation design is the best of them, so we copy its ideas, not its code. Workflow engines (Temporal, Camunda, Flowable, n8n) are overkill for about five timers per ticket. Camunda 8 and n8n also have licences that block use inside a product we sell.

**How severity is set automatically:** machine criticality × machine state.

| Machine criticality | Machine stopped | Running with a problem |
| --- | --- | --- |
| A: bottleneck, no standby | S1 | S2 |
| B: important, some standby | S2 | S3 |
| C: has spare capacity | S3 | S4 |

A safety or environment fault is always S1; a quality escape is at least S2. Criticality starts from Bhavin's bottleneck ranking and the plant head confirms it.

**Default timers** (every plant can change them; proposed defaults, not from a standard)

| Severity | Acknowledge within | Restore within | Clock runs on |
| --- | --- | --- | --- |
| S1 | 5 min | 2 hours | 24 × 7 |
| S2 | 15 min | 4 hours | 24 × 7 |
| S3 | 60 min | 1 shift | Shift calendar |
| S4 | 4 hours | 3 days, then becomes planned work | Shift calendar |

A warning goes out at 75% of the restore time, before the breach.

**Rules that make it fair to both sides**

- **Escalation targets a role on duty, not a named person.** At shift change, open tickets are re-sent to the incoming technician.
- **Two kinds of escalation.** "Beyond my skill" pulls in a more skilled person (functional). Missed timers inform managers up the ladder (hierarchical).
- **Vendor or OEM as an external tier.** A supervisor marks "OEM required", or a rule fires (machine under warranty plus a matching fault). The vendor gets the ticket by WhatsApp or email with its own clock.
- **Pauses need a reason and approval:** waiting for spares (linked to the purchase order), waiting for vendor, or production not releasing the machine. Each pause has a maximum length, after which it escalates. The accountability clock pauses, but the downtime clock never does, so downtime figures stay honest.
- **Turnaround time is measured for both sides:** maintenance's response and repair time, and production's time to release the machine and confirm handback.

**What we add to Atlas**

- A criticality field on machines.
- On each ticket: severity, machine state, fault type, acknowledged time, restored time, handback status, escalation level, pause time and reopen count.
- Five small tables: SLA policies, escalation rules, live timers, an append-only escalation log, and shift and on-duty rosters.
- One background job, running every 30 to 60 seconds, that finds due timers and fires the next step.
- WhatsApp and SMS as new channels beside Atlas's existing in-app, mobile push and email.

This tiered, roster-driven ladder with handback is rarer than it sounds. Most CMMS products we checked stop at "notify when overdue". IBM Maximo is the main exception.

## Closed-loop intelligence

No insight ends as a chart. Every prediction is written down before the month starts and scored after it ends, and every nudge becomes a ticket that is checked later. Think of a weather service that publishes its forecast, then shows how often it was right. That track record is what makes a plant head trust it.

**The six loops**

| Loop | What the system does | How it learns whether it worked |
| --- | --- | --- |
| 1. Forecast → outcome | On the 1st of each month, freezes its prediction per machine: expected breakdowns, "plan for" hours, risk band (Hot, Likely, Watch, Stable) | At month end it compares with what happened. Did roughly 80% of machines stay under their 80% figure? Did the Hot machines actually fail more? How far off was the plant total? Published as a monthly forecast scorecard |
| 2. Risk → inspection ticket | A Hot or Rising machine automatically gets an inspection ticket with a short checklist | The technician records "defect found" or "nothing found". A high find rate means the risk ranking is pointing at the right machines; a low one tunes the ranking down |
| 3. Nudge → action → check | Every Action Center nudge (repeat fault, slow repairs, worsening machine) becomes an owned task with a due date | After a 60 to 90 day watch window: held, did not hold, or too early to say. It compares against the machine's own pre-spike baseline and against similar machines with no action |
| 4. Is PM working? | Tracks PM compliance per machine and breakdowns per machine | Compares breakdown rates of machines that got their PM on time with similar ones that missed it. Flags "failures within 7 days after PM", which usually means the PM itself caused or missed something. Shows the PM-to-breakdown ratio month by month |
| 5. Why-Why → fix → recurrence | Long breakdowns create a Why-Why task; its corrective action becomes a ticket | Watches for the same fault on the same machine; a recurrence reopens the analysis as a linked action |
| 6. Fixes and codes learn | Fix Finder suggests past fixes; the system suggests a fault code at closure | Fixes that held rank higher next time. Each code a technician accepts or corrects improves the suggestions for that plant |

**Rules that keep the loop honest**

- **Predictions are frozen.** A forecast cannot be edited after the month starts; the scorecard compares against what was published.
- **Small numbers are labelled.** Per machine, 60 to 90 days often means one or two expected breakdowns, too few to judge alone. The engine pools similar machines and says "too early" rather than guessing.
- **Inspections are not punished.** If an inspected Hot machine then doesn't fail, the forecast is not marked "wrong". The inspection outcome (defect found or not) is the evidence instead.
- **Management sees one page:** forecast accuracy, the share of actions that held, the PM effect, and downtime trend against target. It is the proof Bhavin said he had not designed.

The statistics behind each loop are standard reliability methods. The engine handles them, and every number carries a plain-language "how this was worked out" note, so nobody needs to understand machinery or statistics to use it.

## What Bhavin missed: global scan

Bhavin's analytics are already stronger than most products sold to small factories. What he is missing is the foundation underneath them, not more charts. Three gaps:

- **Structured failure codes.** Breakdowns are grouped by keywords today. Nothing records machine class, then component, then failure mode, then cause.
- **Execution metrics.** There is no PM compliance, no backlog view, and no check of whether a fix worked.
- **A cheap way to get true run-hours.** Without them, MTBF uses planned rather than actual running time.

Almost every "advanced" feature in tier-1 products such as IBM Maximo, SAP APM and GE Vernova depends on the first gap, so it comes first.

**Additions, in priority order**

| # | Addition | In plain words | When |
| --- | --- | --- | --- |
| 1 | Failure coding with AI suggestions | Each breakdown is tagged component → failure mode → cause → action; AI proposes the codes from the voice note or text (IBM ships similar suggestions in Maximo) | Now |
| 2 | Machine criticality grades | Score each machine on safety, quality, delivery, repair cost and standby, then grade it A, B or C. This drives ticket severity, PM depth and which spares to stock | Now |
| 3 | PM compliance and PM effectiveness | Share of PMs done on time (SMRP counts within 10% of the interval), PM-to-breakdown hours, breakdowns soon after a PM | Now, with the PM calendar |
| 4 | Intervention ledger | Every fix, overhaul or PM change is logged and checked: did it work? (see closed loop) | Now |
| 5 | Backlog and schedule compliance | Open work in crew-days, ageing of open jobs, weekly plan versus done | Now, with tickets |
| 6 | Operator daily checks and red tags | A 2-minute clean, lubricate, inspect and tighten check per machine; operators raise photo "red tags" on WhatsApp (TPM autonomous maintenance) | Now |
| 7 | Multilingual copilot | Voice note to coded ticket, OEM manual PDF to PM checklist, nameplate photo to machine record (MaintainX and Limble ship parts of this) | Now |
| 8 | Calibration register | Gauges and instruments with due dates and certificates; a real pain point in ISO 9001 audits | Now |
| 9 | Skills matrix and shift handover log | Who can fix which machine class; structured open issues at every shift change | Now |
| 10 | Lockout step for hazardous jobs | Isolation checklist and photo before work starts | Now |
| 11 | Failure-rate trend alarms | A growth slope (Crow-AMSAA) per machine, cell and plant, plus an alarm when the rate shifts (CUSUM or EWMA charts) | Now |
| 12 | Manual condition readings | Technicians log temperature, pressure, oil level and handheld vibration against limits; the cheap bridge to sensors | Now |
| 13 | Spares done properly | Parts linked to failure modes; stock levels set by criticality and demand pattern, not guesswork | After 6 months of data |
| 14 | Weibull per failure mode, replace-on-age test | Shows when fixed-interval part swaps actually pay. Often the answer is "stop the useless swaps" | After 6 months |
| 15 | Repair-or-replace economics | Running cost per hour of an old machine against the yearly cost of a new one | After 6 months |
| 16 | Vendor and AMC performance | Response time, first-time fix and repeat failures after vendor visits; warranty and AMC expiry alerts | After 6 months |
| 17 | Failure-mode templates per machine class | Pre-filled failure modes and tasks (RCM-lite) for the 10 most critical machines | After 6 months |
| 18 | Benchmarks across customers | Failure rates by machine class pooled across customers, with consent: "your VMC MTBF vs peers", and better starting forecasts for new plants | Later, at 10+ customers |
| 19 | Sensed run-status and OEE availability | Real run-hours; a sensed stop prompts the operator to say why | Pilot on 10 machines, then scale |
| 20 | Metered energy | Real kWh from meters on big feeders, replacing the kVA estimate | Later |

**Don't build:** sensor-free "AI predictive maintenance", AI visual inspection, reliability block diagrams, 3D twins, or formal Asset Administration Shell compliance. They are buzzwords at this scale.

**Digital twin: a live 2D floor plan, not 3D**

- **Now:** the plant layout with each machine coloured by live ticket status: running, down, waiting for spares, PM due. Health score and criticality are overlaid, and part flow between cells is drawn so the bottleneck what-if becomes visual. Bhavin's footprint and cell data already provide the layout.
- **After 6 months:** a capacity simulation that answers "if VMC-12 is down three days, or we add a night-shift technician, how much output do we lose?". The open-source SimPy library's textbook "machine shop" example is almost exactly this problem.
- **What decides success:** European SME twin programmes found that organisational readiness matters as much as technology.

**Closed-loop maths for small numbers** (feeds the closed-loop section)

- Never compare before and after alone. Machines are picked for a fix right after a bad spell, so they improve anyway.
- Compare against untreated machines of the same class, using exact Poisson rate tests or a Bayesian before-and-after-versus-control estimate. Report it as "87% likely the fix reduced failures".
- Track whether the 80% forecast band actually contains the result about 80% of the time.

**Visuals managers actually use**

1. Bad-actor list: top 10 machines by lost hours, with trend and owner.
2. Pareto of downtime hours by failure mode.
3. Machine × week heatmap.
4. MTBF and MTTR trend against target.
5. "Are we improving?" growth plot.
6. Backlog burn-down.
7. PM compliance and effectiveness.
8. Intervention scorecard.
9. Rupee cost waterfall.
10. Weibull plots, only where data allows.

**Sensors: "the sensor captures when, the person says why"**

- **Current clamp for run-status:** about ₹500 per clamp, or a small node for about ₹1,500 to 2,000. Best value. A detected stop sends the operator a WhatsApp prompt.
- **CNC controller data:** Fanuc's MTConnect server covers common Fanuc controls. Alarm history is valuable for automatic fault coding. Survey Cosmos's controller mix first.
- **Modbus energy meters:** about ₹3,400 to 4,800 each, on compressors and main feeders only.
- **Vibration sensors:** about ₹15,000 to 54,000 each. Only for bottleneck spindles and critical rotating utilities.
- **Pilot estimate:** clamps on all 125 CNC machines plus 10 meters comes to roughly ₹2.5 to 3.5 lakh in hardware (unverified estimate).

## Communication module: WhatsApp first

The whole ticket loop can run inside WhatsApp, using the official Meta Cloud API with one product number shared by all customers at launch. It costs under ₹1,000 per plant per month. Email carries digests and reports; SMS is a last-resort alarm for the most critical breakdowns.

**Two platform facts that shape the design**

- **The bot cannot replace the cell WhatsApp groups.** WhatsApp's official group feature allows only 8 people, does not support buttons, and needs a verified green-tick account that a new brand won't get. So a "cell" becomes a group in our database, and each member gets their own 1:1 message. Supervisors also get a short ticket summary they can forward into the old groups during the transition.
- **Buttons are limited:** up to 3 reply buttons and lists of up to 10 rows. Every step therefore shows only the valid next actions.

**The loop, message by message**

| Step | Who | What they see | Message type |
| --- | --- | --- | --- |
| 1. Report | Operator | Scans the QR sticker on the machine, which opens WhatsApp with "BRK VC-18" pre-filled. Taps send, then \[Machine stopped\] or \[Running, faulty\], then sends a photo and a Gujarati voice note | Free-form, since the operator started the chat |
| 2. Confirm | Operator | "I understood: VC-18, spindle noise, machine STOPPED. \[Correct\] \[Change\] \[Cancel\]", then a ticket number and the response time promised | Reply buttons |
| 3. Dispatch | On-shift technicians | Machine, symptom, photo, \[Claim\] \[Can't take\]. First to claim wins; the others get "Taken by Ramesh" | Approved template |
| 4. Work | Technician | \[Start\] \[Pause\] \[Close\] \[Need help\]; pause asks for a reason (spares, vendor, power) | Reply buttons and a list |
| 5. Close | Technician | A short in-WhatsApp form: cause, action, spares used, after-photo; or a voice note. The job-card PDF comes back as a link | WhatsApp Flow |
| 6. Handback | Production supervisor | "VC-18 repaired. \[Machine OK\] \[Dispute\]"; a dispute reopens the same ticket | Template |
| 7. Escalate | Supervisor, head, plant head | "S1 VC-18 not acknowledged in 5 min. \[Acknowledge\] \[Reassign\]"; an unread or failed message escalates further | Template, plus SMS for S1 |
| 8. Remind | Technicians | PM due \[Start PM\] \[Snooze\]; Why-Why due, opening a 5-Why form | Template and Flow |
| 9. Ask | Anyone | "Spindle noise VC-18?" returns the top 5 past fixes as a list | Free-form list |
| 10. Digest | Managers | 8:30 daily: open tickets, machines down, repeat offenders, a PDF and a dashboard link; weekly by email too | Template plus email |

**Design rules**

- **Voice notes:** download within 5 minutes, before Meta's link expires. Transcribe Gujarati with Sarvam, store both Gujarati and English text, and always confirm with buttons before creating a ticket.
- **Phone identity:** the sender's phone number identifies the person and the company, so operators need no app or password.
- **Templates in three languages:** English, Gujarati and Hindi, kept strictly factual so Meta classes them as "utility" (cheap), not "marketing" (about 7× the price).
- **Allowed bot:** Meta's ban on general-purpose AI chatbots (from 15 January 2026) does not cover a bot serving a business's own users, so Fix Finder is allowed. A free-roaming "ask me anything" assistant is not.
- **Official API only:** no unofficial WhatsApp libraries (Baileys, whatsapp-web.js). A ban would take every customer offline at once.
- **Our own code:** call Meta's API directly. Meta's own SDK is archived; n8n and Typebot licences don't allow use inside a product we sell.

**Number strategy**

Start with one product-branded number in our own Meta account and route by the sender's phone. A dedicated number per customer comes later, as a paid option for larger plants. It needs Meta "Tech Provider" approval, and onboarding is capped at 10 new customers a week until fully verified. A shared number means all customers share one quality rating, so template quality matters.

**Cost per plant** (150 machines, about 150 tickets and 20 users a month)

- **WhatsApp:** about 1,050 templates and 1,650 billed free-form messages, roughly ₹370 a month including GST, at Meta's India rate of about ₹0.115 per message. That rate comes from a secondary source, so confirm it on Meta's INR rate card.
- **Speech-to-text:** about ₹75 a month.
- **Budget:** under ₹1,000 per plant per month, even at 2 to 3× the volume.

**Email and SMS**

- **Email:** Amazon SES in the Mumbai region, at $0.10 per 1,000 emails. Set up domain authentication records (DKIM, SPF, DMARC). Postmark is the premium alternative.
- **SMS fallback (S1 only):** TRAI's DLT registration is mandatory (about ₹5,900 one-time). Use an Indian provider such as MSG91 at roughly ₹0.12 to 0.25 per SMS. Twilio costs about ₹7 per SMS in India, so avoid it.

## Infrastructure to set up

With Atlas as the core, everything runs on AWS in Mumbai. Supabase and Vercel are no longer needed, because Atlas brings its own login, database layer and web app. Expect roughly ₹15,000 to 25,000 a month for staging plus the Cosmos pilot, then about ₹1,000 to 2,000 extra per plant. All figures are estimates to confirm on each provider's pricing page.

**Accounts and services, in the order to create them**

| # | What | Why | Cost (estimate) | Lead time |
| --- | --- | --- | --- | --- |
| 1 | The company entity, its GST and PAN, and a bank account | Meta verification, DLT and AWS billing all need it; it also settles ownership | Incorporation fees | 1–3 weeks; start now |
| 2 | Domain and a one-page website with the legal name and brand | Meta requires a live site whose name matches the WhatsApp display name | About ₹1,000 a year | 1 day |
| 3 | Domain email (Google Workspace or Zoho Mail) | Business verification, AWS, vendor accounts | About ₹100–150 per user a month | 1 day |
| 4 | GitHub organisation, private repos | The Atlas fork plus our services; the source can be shared with customers on request | Free, or about $4 per user a month | 1 hour |
| 5 | AWS account, Mumbai region (ap-south-1). Apply for AWS Activate startup credits | Servers, database, file storage, email, backups | See next table | 1 day |
| 6 | Meta Business portfolio and Business Verification | Required for WhatsApp messaging at volume | Free | Several days to 2 weeks; start now |
| 7 | Meta developer app, WhatsApp Business account billed in INR, payment method, permanent system token | The WhatsApp API itself; INR billing is mandatory by 31 Dec 2026 | Per message, about ₹370 per plant a month | 1 day after verification |
| 8 | A fresh phone number (new SIM, never used on WhatsApp) | The product's WhatsApp number | SIM cost | 1 day |
| 9 | WhatsApp message templates in English, Gujarati and Hindi | Assignment, handback, escalation, digest, PM due, Why-Why due | Free; Meta reviews them | Hours to days each |
| 10 | Sarvam AI account | Gujarati and Hindi speech-to-text, Indic document reading | Pay as you go, under ₹100 per plant a month | 1 day |
| 11 | One LLM API account (Anthropic or OpenAI) | Fault coding, transcript understanding, import mapping, copilot | Usage-based, under ₹1 per ticket | 1 day |
| 12 | Google Play developer account and Expo account | Publishing Atlas's Android app under our brand | $25 one-time; Expo free tier | 2–7 days for Play review |
| 13 | Sentry, plus an uptime monitor (Better Stack or UptimeRobot) | Error alerts and "site down" alerts; Atlas already supports Sentry | Free tiers | 1 hour |
| 14 | Password manager for the team | Holding every key and token safely | About $3–8 per user a month | 1 hour |
| 15 | DLT registration and an MSG91 account | SMS fallback for S1 breakdowns | About ₹5,900 one-time, then about ₹0.2 per SMS | 1–2 weeks; can wait until Phase 1 ends |
| 16 | Lawyer, a few hours | AGPL and branding check, Bhavin/Cosmos agreement, DPDP data-processing agreement template | Fees | Before the first external customer |

**AWS pieces** (Mumbai, monthly, estimates)

| Piece | Role | Starting size | Approx. cost |
| --- | --- | --- | --- |
| EC2 | Runs Atlas (API, web app), our WhatsApp, analytics and AI services, and nginx, all in containers | One 2 vCPU / 8 GB server for staging, one 4 vCPU / 16 GB for the pilot | $60–150 |
| RDS PostgreSQL | The database, with automatic daily backups and point-in-time restore | Small burstable instance, 50 GB | $30–70 |
| S3 | Photos, voice notes, job-card PDFs, database exports | Pay per GB | Under $5 |
| SES | Email digests and reports | Pay per email | Under $1 |
| Route 53, CloudWatch, Secrets Manager | DNS, logs and alarms, secret keys | Basic | About $10 |

Total: roughly $100 to 240, or ₹8,500 to 20,000 a month, before startup credits.

**What you do vs what the build does**

- **You:** items 1 to 3, 6 to 8 and 16. They need a person, documents and payment.
- **Tomorrow's coding session:** writes the deployment scripts so one command builds the staging server on AWS, and sets up items 4, 5, 9 to 13 once the accounts exist.
- **Start today:** the company entity and Meta business verification. Everything WhatsApp-related waits on them, and they take the longest.

## Capability benchmark against the global leaders

We benchmarked 110 capabilities against seven enterprise suites and fifteen mid-market and Indian products. Atlas and Bhavin's prototype together already fully cover 41 and partly cover 26. On this plan we match what the mid-market leaders compete on by the end of Phase 2, and lead on six things nobody else offers together. The full line-by-line matrix, with who has what and when we add it, is in the doc's "Capability matrix" tab (copy in `research/15-capability-matrix.md`)

- **Enterprise suites:** IBM Maximo, SAP, Hexagon EAM (ex-Infor), IFS, Oracle, Microsoft Dynamics 365, AVEVA and GE Vernova.
- **Mid-market:** MaintainX, UpKeep, Limble, Fiix, eMaint, Fracttal, Tractian, Eptura, Brightly (now Siemens) and Coast.
- **India:** Keep Wisely, OxMaint, Cryotos, TeroTAM and InnoMaint.

**Where we will lead**

1. A WhatsApp ticket raised by voice note in Gujarati or Hindi. Only MaintainX names an Indian language, and only Hindi; WhatsApp intake exists only at two Indian vendors' top tiers.
2. Severity set automatically from machine criticality and "stopped or running".
3. Production handback with dispute and reopen, and turnaround measured for both sides.
4. Breakdown forecasting without sensors, with a published track record. Only IBM Maximo Predict comes close, at enterprise prices.
5. Bottleneck and what-if outage analysis.
6. The closed loop: every forecast, nudge and fix checked against what actually happened.

**Gaps the teardown added to our scope**

| Capability | Who has it | When we add it |
| --- | --- | --- |
| Approval workflows; sharing work orders with vendors and contractors | IBM, SAP, IFS; MaintainX, Limble, Coast | Phase 2 |
| Skills and certifications; shift handover log | IBM, Hexagon, IFS, Microsoft; Fiix; OxMaint | Phase 2 |
| Warranty and AMC alerts; nameplate photo to machine record | Hexagon, Oracle; UpKeep, Limble, Keep Wisely; MaintainX, Limble, Fracttal | Phase 2 |
| Scheduling board, workload levelling, backlog KPIs; offline sync | IBM, SAP, Microsoft; Fiix, Limble | Phase 2 |
| Multi-location stock; calibration register; lockout checklist | Most suites; eMaint; Coast | Phase 2 |
| Prebuilt strategy library per equipment type (IBM ships 800+ types) | IBM, AVEVA, GE | Phase 2, as industry packs |
| Troubleshooting answers from manuals; plain-language analytics; duplicate detection | IFS, Oracle, Hexagon; MaintainX, eMaint, Limble | Phase 2 |
| Spare-parts list per machine; inventory optimisation | Hexagon, Microsoft, IBM, IFS; Fiix | Phase 3 |
| Optimised scheduling; inspection rounds; nested PM plans; conditional procedures | IBM, SAP, IFS; Fiix, Tractian, MaintainX, Limble | Phase 3 |
| Permit-to-work | SAP, Hexagon, IFS; Cryotos, TeroTAM | Phase 3 |
| Agents that act; MCP connector for outside AI tools | SAP, Oracle, IFS; UpKeep, Fracttal, Limble, Coast | Phase 3 |
| OT and IoT connectors; ERP and Tally integration | All suites; MaintainX, Tractian, Fracttal | Phase 4 (sensor pilot earlier) |

**What we deliberately skip:** 3D and BIM models, linear assets, invoice matching, management of change, computer-vision inspection, AI-generated FMEA. They serve oil and gas, utilities and large enterprises, not a 150-machine shop. OEE, capital planning, 21 CFR Part 11 (pharma), EHS incidents and cycle counts come later, when a customer segment needs them.

**Market signals that matter**

- **Industrial giants are buying the maintenance data layer.** Autodesk agreed in May 2026 to buy MaintainX for about $3.6 billion. Siemens renamed Brightly as its own asset-management software. Rockwell partnered with Augury.
- **AI is a paid top-tier feature.** It is gated behind the top plan (MaintainX, eMaint), sold as an add-on (Fiix) or metered by credits (UpKeep).
- **Indian vendors win on local fit:** WhatsApp, OEE and TPM tools, permit-to-work, on-premise options. But none combines that with serious reliability analytics.
- **The bottom of the market is getting cheaper:** Coast starts at $1.80 per user, MaintainX has a free tier, Keep Wisely is ₹799 per user. Per-user pricing is the norm, which is why per-plant pricing with unlimited operators stands out.

## The AI brain and knowledge base

The AI itself is not our advantage. What we can own is the data it is built on: Gujarati and Hindi voice notes turned into verified, coded failure history for Indian machines, makes and controllers, with every human confirmation becoming a label. No AI vendor can sell that.

What incumbents ship as AI is now standard:

- voice-to-work-order
- Q&A over manuals
- suggested failure codes
- "similar past jobs"
- duplicate detection
- plain-language reports
- PM drafts from manuals
- photo-to-asset records

The vendors with deep AI (Tractian, Augury, Siemens Senseye, Aspen Mtell) build it on sensor data, which our customers won't have at first.

**What competitors ship today** (sources in research note 12 of the handoff pack)

| Vendor | AI shipped or announced |
| --- | --- |
| IBM Maximo | Maximo Assistant; "Work Order Intelligence" suggests problem codes from descriptions; faster failure-mode analysis; visual inspection by pointing at a part in a photo |
| SAP | Recommends past orders as templates and scores their chance of success; anomaly detection and failure curves in APM; Joule natural-language questions; a "Maintenance Planner Agent" that re-prioritises the backlog |
| Microsoft Dynamics 365 | Copilot work-order summaries; Q&A over asset history; scheduling agent |
| Siemens Senseye | Industrial Copilot for maintenance: repair guidance, troubleshooting, automated diagnostics |
| Rockwell Fiix | Turns sensor-based failure predictions into editable work orders |
| MaintainX | Procedures and work orders generated from uploaded manuals and error-code tables; answers from manuals and history; voice questions; natural-language report builder |
| UpKeep | Voice-to-work-order with review; Nova agent that audits and bulk-fixes data, with human approval |
| Limble | PM schedules drafted from manuals; assets from photos; duplicate-request warning |
| Tractian, Augury | Sensor-first AI with many specialised agents for detection, root cause and prescription |

We found no vendor documenting Gujarati voice intake or WhatsApp-native intake. We did not search exhaustively, so treat that as likely, not proven.

*(Diagram in the shared doc. Four knowledge layers: L0 global (machine classes, components, our own failure codes, Gujarati/Hindi/English symptom lexicon, alarm-number index, PM templates) → L1 cross-tenant aggregates (opt-in, k-anonymous) → L2 tenant (machines, verified fix cases, the tenant's own manuals and SOPs, people and skills, spares, shop-floor slang) → L3 live (open tickets, forecasts, roster, stock). Agent groups: capture (intake, failure coding, data quality), advise (diagnosis/Fix Finder, PM drafts, Why-Why), report (briefings, plain-language analytics), plan (scheduling solver). Feedback loop: every accepted, edited or rejected suggestion and every confirmed fix becomes a label that retrains retrieval and coding.)*

The agents read the four knowledge layers and write back what people confirm. Each confirmation sharpens the plant's own knowledge, and, as anonymised aggregates, the knowledge every new customer starts with.

**The four knowledge layers**

| Layer | What it holds | Who owns it |
| --- | --- | --- |
| L0 Global | Machine classes (VMC, HMC, turning centre, grinder, compressor…), component trees, our own failure-mode, cause and action codes, a Gujarati/Hindi/English symptom lexicon ("spindle garam thay chhe" means spindle overheating), an alarm-code index, PM templates per machine class | We curate it, with expert review |
| L1 Cross-customer | Failure rates and fix success rates by machine class, make, model and controller. Aggregates only, published only above an anonymity bar (for example at least 5 customers), opt-in by contract | Computed automatically |
| L2 This plant | Machine register, verified fix cases (symptom → cause → action → did it hold), the plant's own manuals and SOPs, people and skills, spares, shop slang | The customer; database-enforced isolation, including AI search indexes |
| L3 Live | Open tickets, forecasts, shift roster, spares stock, production calendar | The customer, read at the moment of use |

**The ten agents and their safety points**

| Agent | Does | Human checkpoint | Built with |
| --- | --- | --- | --- |
| 1. Intake | Voice note or photo → transcript → structured ticket (machine, symptom, alarm code, stopped or running) | One-tap WhatsApp confirm | Sarvam speech + small LLM |
| 2. Failure coding | Picks component, mode, cause and action from closed code lists, top 3 with confidence; abstains when unsure | Supervisor taps at closure | Past-case search first, then a small LLM choosing from the list |
| 3. Diagnosis (Fix Finder 2.0) | Ranked causes and fixes, each citing past cases or manual pages, with historical success rate | Technician picks; "did this fix it?" at close | Statistics and graph ranking; LLM only explains |
| 4. PM plan generator | Draft PM tasks and checklists from the plant's manual and failure history, with page citations | Maintenance head approves | Frontier LLM (long documents) |
| 5. Why-Why helper | Guided 5-Why with evidence and countermeasures for repeat failures | People own the conclusion | Frontier LLM |
| 6. Briefing writer | Daily WhatsApp brief in Gujarati or Hindi; monthly owner report | None for daily; review before external use | Small LLM; it never calculates numbers |
| 7. Ask-a-question analytics | "Which cell lost most hours to coolant leaks this quarter?" → answer with chart and the query shown | Definitions visible; low confidence said | LLM writing SQL against approved views only |
| 8. Onboarding | Excel, register photos, nameplates → machine register and mappings | Preview and confirm | Vision + mid LLM |
| 9. Data quality | Nightly scan for missing codes, impossible downtimes, duplicates → fix queue | Supervisor batch-approves | Rules + embeddings + small LLM |
| 10. Planning | Weekly plan from PM due, forecast, skills, spares, production calendar | Planner approves | Optimisation solver; LLM only explains trade-offs |

**Build order:** agents 1, 2, 9 and 6 first, because they produce the clean coded data everything else depends on. Then 8, 7 and 3. Fix Finder needs a few hundred verified cases per machine class, so seed it from the global layer and the plant's manuals. Agents 4, 5 and 10 come last.

**Guardrails, built in code, not in prompts**

- **No source, no claim.** A diagnosis must cite a past case, a manual page or a global entry; otherwise it says "unknown, escalate".
- **Codes and alarm numbers are always selected from the knowledge base, never generated.** Alarm codes match exactly, never by similarity.
- **Every number comes from SQL or the statistics engine.** The AI only narrates.
- **Calibrated confidence.** Confidence comes from agreement across several runs and retrieved evidence, then calibrated, never from the model's own claim. Below threshold, the agent abstains and asks a person.
- **Hard-coded safety rules:** never suggest bypassing an interlock; lockout prompts on hazardous jobs; electrical work flagged for qualified staff.
- **Rollout per agent, per plant:** shadow mode, then suggestions, then defaults. A regression test suite runs on every model or prompt change.

**How we know it works:** gold test sets built before launch.

- 300 to 500 real voice notes. Alarm-code exact match is the key number.
- 1,000 closed tickets coded by two people.
- 100 diagnosis cases with known fixes, replayed with the fix hidden.
- 30 PM drafts checked against OEM schedules.

The research is sobering. Zero-shot AI scored 0.46 on failure-mode coding against 0.80 once tuned on real labels. Rewording a question drops accuracy 5 to 20%. The tap-to-confirm design exists for exactly this reason.

**Choosing models**

- **Speech:** Sarvam-class models. On a 2026 Indian-language benchmark, Sarvam scored a Gujarati error rate of about 13 against 98 for GPT-4o Transcribe.
- **High-volume tasks:** small, cheap models for extraction, coding, data checks and briefings.
- **Low-volume, high-value tasks:** frontier models for diagnosis write-ups, PM drafts, Why-Why and analytics questions.
- **Fine-tuning:** our own small model once we have about 2,000 confirmed labels.

**Two cautions**

- **Manuals are copyrighted.** Fanuc manuals forbid reproduction, and Indian law has no text-and-data-mining exception. Customer-uploaded manuals stay inside that customer only. The global alarm index holds only the alarm number, our own field notes and a pointer to the manual section. Get an IP lawyer's view.
- **No sensorless "predictive maintenance" or AI-generated FMEA claims.** The research shows FMEA drafts are only about half right without expert supervision.

The moat compounds over time:

- a verified case base for Indian CNC machines
- a Gujarati/Hindi shop-floor vocabulary mapped to failure codes
- failure rates by make and controller pooled across plants, so a new customer with a Fanuc 0i-MF VMC benefits on day one

## Appendix: prototype logic to carry forward, and sources

The full line-by-line inventory runs to about 39,000 words in four parts. It sits in the handoff pack with the research notes, for tomorrow's coding session. The rules below are the ones the rebuild must reproduce or deliberately change.

| Prototype rule (Guide section) | As implemented | In the product |
| --- | --- | --- |
| Available hours (2, 22) | 20 hrs × 300 days per machine; "days so far" or "full year"; counted from purchase date | From plant shift and holiday calendars and in-service dates; keep both views |
| BD %, PM %, availability (3, 5) | Downtime ÷ available hours; availability = 1 − BD % − PM % | Same, defined once in SQL |
| MTTR, MTBF (4) | MTTR = hours ÷ breakdowns; MTBF = (available − downtime hours) ÷ breakdowns | Same; called SMRP-aligned (3.5.1, 3.5.2) once operating-time calendars exist; MTTR from exact timestamps |
| PM and NO DT (1) | Code PM excluded from breakdowns; NO DT counts as a breakdown with 0 hours | Ticket type PM; NO DT derived as a stop entirely outside production time; "running with a problem" is a separate state |
| Cell on breakdown date (21) | Effective-dated cell-move log; hours split by days in each cell | Effective-dated location history for every asset |
| 50% concentration (3, 14) | Rows highlighted until the running total crosses 50% of hours | Keep as a Pareto marker |
| Action Center (15) | 13 alert types, 23 editable limits (for example 4 breakdowns in 30 days; same code on 2 days in 7; spike of 50% and at least 10 hrs); acknowledge, snooze or resolve; auto-reopen | Rule library per tenant; each nudge can become an assigned task; shared, audited state |
| Bottleneck (17) | Score = 50% likelihood + 50% consequence (1 ÷ √ machines of the same kind); Critical, High, Watch, Low | Keep; add real routing or capacity data when a tenant has it |
| Forecast (19) | Machine rate pooled with category (180-day prior); episodes; 2,000-run simulation; 80% and 90% plan figures; Hot to Stable bands | Port as the starting model; hierarchical model as challenger |
| Trend and repeat faults (20) | Pooled Laplace test (±1.96); 3 times in 30 days; 3 days in a row | Keep; add proper censoring and the capture changepoint. Bhavin described "four times in 20 days"; the code uses three in 30. Confirm which he wants |
| Health score (24) | 7 − 3.5 × log2(actual ÷ expected), 0–10; weights 30/25/15/15/10/5; labels Excellent to Critical | Keep the scale; versioned, frozen baseline for "expected" |
| Problem groups (25) | 24 English keyword groups, first match wins | Tenant fault taxonomy, LLM classification, multilingual |
| Fix Finder (27) | Synonyms, stemming, edit distance, rarity weighting, three tiers, 30% floor | Hybrid meaning, spelling and keyword search |
| Forecast Lab (28) | Monthly back-test, pinball loss, adopt a challenger only if 1% better and calibrated | Automatic per-tenant model governance |
| Team Focus (29) | Six lanes, owners and status, reopens if the fault returns, WhatsApp briefing | Merged into Inbox and tasks; generalised as the feedback loop |
| Money Matters (30) | Turnover ÷ (machines × available hours) per lost hour; four levers combined without double counting | Cost per hour by machine or cell; same lever logic |

**Sources** (all opened 27 October 2026)

- Open-source bases: [Atlas CMMS](https://github.com/Grashjs/cmms) and [pricing](https://atlas-cmms.com); [Frappe](https://github.com/frappe/frappe) and [multi-site docs](https://docs.frappe.io/framework/user/en/basics/sites); [ERPNext asset maintenance](https://docs.frappe.io/erpnext/user/asset-maintenance); [frappe\_whatsapp](https://github.com/shridarpatil/frappe_whatsapp); [Zammad WhatsApp](https://admin-docs.zammad.org/en/latest/channels/whatsapp/index.html)
- Statistics: [SurPyval](https://pypi.org/project/surpyval/); [reliability](https://reliability.readthedocs.io/en/latest/ROCOF.html); [NIST trend tests](https://itl.nist.gov/div898/handbook/apr/section2/apr234.htm); [IEC 61710](https://webstore.iec.ch/publication/5732); [MIL-HDBK-189C](https://www.dote.osd.mil/Portals/97/docs/TEMPGuide/MIL-HDBK-189C.pdf); [statsmodels GLM](https://www.statsmodels.org/stable/glm.html); [PyMC multilevel](https://www.pymc.io/projects/examples/en/latest/generalized_linear_models/multilevel_modeling.html); [pgvector](https://github.com/pgvector/pgvector); [bge-m3](https://huggingface.co/BAAI/bge-m3); [SMRP metrics](https://smrp.org/Resources/SMRP-Library/Best-Practices-Metrics-Guidelines); [Superset embedding](https://superset.apache.org/user-docs/using-superset/embedding); [Metabase licence](https://www.metabase.com/license)
- Standards: [IEC 62264-1](https://assets.vde-verlag.de/iec-normen/preview-pdf/info_iec62264-1%7Bed2.0%7Db.pdf); [ISO 14224](https://iteh.es/catalog/standards/cen/f764730c-3134-478d-8cc7-073e055d9992/en-iso-14224-2016); [EN 15341](https://iteh.es/catalog/standards/sist/8b683a47-095f-4994-8709-d657eb9cc175/sist-en-15341-2019); [ISO 9001:2026 announcement](https://www.iso.org/news/2026/09/ISO9001-2026); [DQS on ISO 9001 revision](https://www.dqsglobal.com/en/learn/blog/revision-iso-9001); [IATF 16949 2nd edition status](https://media-cdn.smithers.com/mediacontainer/medialibraries/smithersb4f/resources/2026/downloads/stakeholder-communique-sc-2026-005_iatf-16949-2nd-edition-status.pdf); [OPC UA for Machine Tools](https://reference.opcfoundation.org/MachineTool)
- Capture and infrastructure: [WhatsApp pricing](https://developers.facebook.com/docs/whatsapp/pricing); [WhatsApp media](https://developers.secure.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media/); [Meta chatbot terms change](https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform); [Sarvam Saaras](https://docs.sarvam.ai/api-reference-docs/getting-started/models/saaras.md) and [pricing](https://docs.sarvam.ai/api-reference-docs/pricing); [Supabase regions](https://supabase.com/docs/guides/platform/regions); [Supabase RBAC](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac); [Vercel regions](https://vercel.com/docs/regions); [DPDP s.8](https://www.dpdpa.com/dpdpa2023/chapter-2/section8.html); [DPDP Rule 6](https://www.dpdpa.com/dpdparules/rule6.html); [DPDP phased rollout](https://www.azbpartners.com/bank/indias-digital-personal-data-protection-act-phased-rollout-and-key-compliance-milestones/)
- Onboarding: [Flatfile Excel extractor](https://flatfile.com/docs/plugins/xlsx-extractor); [Dromo pricing](https://dromo.io/pricing); [react-spreadsheet-import](https://github.com/UgnisSoftware/react-spreadsheet-import); [Docling](https://github.com/docling-project/docling); [SpreadsheetLLM](https://arxiv.org/abs/2407.09025); [Google Vision languages](https://docs.cloud.google.com/vision/docs/languages); [Sarvam Vision 2.1](https://www.sarvam.ai/blogs/sarvam-vision-2-1); [MaintainX asset from photo](https://help.getmaintainx.com/create-an-asset)
- UX: [MaintainX user types](https://help.getmaintainx.com/user-types-and-permissions); [Limble mobile app](https://help.limblecmms.com/en/articles/11698403-using-the-new-limble-mobile-app); [Limble languages](https://help.limblecmms.com/en/articles/5423202-languages-supported-by-limble); [UpKeep navigation](https://help.onupkeep.com/en/articles/13636442-navigating-the-left-navigation-panel-in-upkeep); [NN/g lower-literacy users](https://www.nngroup.com/articles/writing-for-lower-literacy-users/); [shadcn/ui](https://github.com/shadcn-ui/ui); [FullCalendar pricing](https://fullcalendar.io/pricing)
- Competitors: [Keep Wisely](https://keepwisely.com/pricing) and [WhatsApp feature](https://keepwisely.com/blog-detail/whatsapp-integration-smart-maintenance-); [Fast Maintenance](https://www.fastmaintenancesoftware.com/); [OxMaint](https://oxmaint.com/pricing); [Cryotos](https://www.cryotos.com/pricing); [InnoMaint](https://www.innomaint.com/pricing/); [TeroTAM](https://www.terotam.com/pricing); [MaintainX](https://www.getmaintainx.com/pricing); [UpKeep](https://upkeep.com/pricing/); [Fiix](https://www.fiixsoftware.com/pricing/) and [Foresight](https://fiixsoftware.com/foresight); [IBM Maximo pricing](https://www.ibm.com/products/maximo/pricing) and [Predict](https://community.ibm.com/community/user/blogs/stefan-hoffmanns/2026/01/24/predict-prevent)

**Not verified, check before relying on it:** India INR billing deadline for WhatsApp; Gujarati speech and handwriting accuracy; OxMaint's in-product Gujarati; whether Cryotos's WhatsApp takes requests; EN 15341 individual KPI codes (paywalled); the IATF 16949 clause wording (secondary summary).
