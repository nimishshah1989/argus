# Claude for Manufacturing, skill by skill — and what our own data already supports

Third research pass, for the owner. Plain English. Short sentences.

On 12 November 2026 Anthropic launched **Claude for Manufacturing**: a plugin for Claude Team and
Enterprise, reported as **17 skills** and **4 connectors**. The first two passes looked at UpKeep and at
what to borrow. This pass answers a different question: **for each skill — what raw data does it need,
do we already hold that data, and which capabilities could we build fast that we are not even planning?**

One change from the press reports: we found the plugin's **own source repository**, published by Anthropic
at `github.com/anthropics/claude-plugins-official`. Every skill name, description and rule below comes from
that repo at a pinned commit (`dcfcf76`) — not from journalism, not guessed. Where we go beyond the
published text, we say **"inferred from the published description"**.

---

## 1. What the launch actually is (all facts fetched, URLs in Sources)

- **The announcement** is not on `anthropic.com/news` (that URL returns 404). It lives on
  **claude.com**: a resources article dated 12 Nov 2026, a solutions page, and a marketplace plugin page.
  The docs site (`docs.claude.com`) redirects to `platform.claude.com`, which renders empty in our
  fetcher — the plugin's own repo is the better source anyway.
- **The plugin**: "The manufacturing plugin. Skills for the work a plant actually runs on: joining the
  exports and systems into one dataset, quoting make-to-order jobs from drawings, writing
  nonconformances and 8Ds, diagnosing breakdowns, and reporting the morning numbers." (plugin page + `plugin.json`)
- **Count**: the repo's README states **"Skills: 17 — 12 atomic, 5 chains"**, and the repo tree lists
  exactly 17 skill folders. The trade press's "17 skills" checks out.
- **Connectors (4)**: Autodesk Fusion (the only one declared in the plugin's `.mcp.json`; runs as a local
  MCP server inside the Fusion **desktop** app), Microsoft 365 (documents, mail, export folder;
  read-only by default), Oracle NetSuite (read **and** write), Infor M3 (read-only; added as the
  customer's own MCP server). Everything else reaches the plugin as **scheduled file exports** — "a
  folder of CSVs runs them" — or through the `custom-connector` skill's seven-tier ladder.
- **Human-approval pattern** (their words): "Every skill that would change something pauses first:
  nothing is applied, sent, or written to your systems without your say-so." "Coding a fix and applying
  it are two separate decisions." The one gate-free skill is the scheduled morning pulse, safe precisely
  because "it writes to no system of record". On the solutions page: owners "can require approval before
  a connector changes anything, or block changes." The Infor **write** path is a separate Infor plugin,
  gated by "approval from an authorised employee" and the buyer's own Infor permissions.
- **Honesty rules worth copying** (their `shared/` rules, names as published): `absent-is-not-zero.md`
  ("An empty result is reported as empty, never as zero"), `computed-figures.md` ("A figure that cannot
  be read is reported as unreadable, never guessed"), and "Freshness is a headline" — stale data is
  announced at the top, not in a footnote.
- **No equipment control**: "Claude for Manufacturing doesn't operate equipment." The Model Hardware
  Standard is a research preview, not a product.
- **No published proof**: no independently verified productivity or ROI figures exist for the plugin
  (Anthropic states the survey context; the trade press confirms no verified results).
- **Availability**: Claude Team and Enterprise plans only; no separate manufacturing price published.

---

## 2. The 17 skills, as published (names verbatim from the repo)

- **Core (3):** `onboarding` · `data-consolidate` · `custom-connector`
- **Sales (2):** `customer-inquiry-intake` · `quote-build`
- **Quality (2):** `ncr-writeup` · `root-cause-capa`
- **Supply chain (1):** `supplier-quote-request`
- **Operations (2):** `breakdown-diagnosis` · `daily-production-report`
- **Design (2):** `design-space-explore` · `trade-study-report`
- **Chains (5):** `rfq-to-quote` · `inspection-to-capa` · `morning-plant-pulse` (scheduled) ·
  `breakdown-to-next-report` · `supplier-escape-to-alternate-source`

Each skill folder has a `SKILL.md` with a published description; chains merely run other skills in order
with approval gates between them. Eleven of the twelve atomic skills work with no connector at all
(scheduled exports are the designed path); `design-space-explore` is the only one that hard-requires a
live connection (Fusion).

## 3. Main table — every established skill

"Do we hold it?" names our Postgres tables per `docs/DATA-MAP.md`. Every skill row is backed by its
`SKILL.md` at the pinned commit (Sources, S3/S4); Uptimo-side wording is ours. Roadmap milestones are
`docs/plan/MILESTONES.md` (M2 accountability · M4a analytics · M4b the loop · M6 AI · M3 parked ·
**new** = not planned anywhere).

| Skill (as published) | What it does | Raw data it needs | Do we hold it? (table/module) | Capability it unlocks in Uptimo | On our roadmap? | Size | Value to an Indian factory |
|---|---|---|---|---|---|---|---|
| `onboarding` | First-run setup: interviews the plant, tests the 4 connectors, profiles the export folder, learns shifts, vocabulary, labour rate and margin; ends with a gap list — what is missing and which skills it limits | Answers about ERP/CAD/CMMS/document systems; a bulk document drop; shift pattern and production-day start; plant vocabulary; commercial rates | **Yes, better**: our settings are structured rows, not an interview — `tenant`, `setting`, `list_item`, `shift`, `machine`, `person` (screens: M1 tickets 22/23) | Nothing to build; borrow only its ending move — a standing "what is missing and what it limits" checklist | — (idea only) | 1 day for a "what's missing" checklist | Low — we already hold this natively |
| `data-consolidate` | Joins exports + connector data into one dataset keyed on part, work order, sales order, lot, asset, supplier; classifies every failed join into 8 mismatch classes; proposes the correction, applies on a yes | Scheduled CSV/XLSX exports: ERP items, sales orders, work orders, POs, inventory, routings, closed-job actuals; CMMS assets and maintenance work orders; MES/historian/quality files | **Partial**: the maintenance half is native (`ticket`, `breakdown_report`, `machine`, `history_breakdown`); the ERP half (POs, inventory, routings) we do not store | Our one database already *is* the consolidated dataset; borrow the mismatch-class report for our imports (`import_row` already logs row errors) | Partially — M4a t37 loads history | 2 days for an import mismatch report | Medium |
| `custom-connector` | Connects any unlisted system down a 7-tier ladder (vendor MCP → community MCP → scoped API wrapper → read-only DB view → Zapier → screen automation → scheduled export), stopping at the highest rung that works; states what it costs and how it will break; never takes credentials in conversation | Whatever the target system exposes (API, MCP, view, export) | **No**: no third-party systems to connect; our file path is CSV import/export (`import_batch`/`import_row`, audit CSV export) | A ladder-shaped checklist for the parked Tally-export and WhatsApp wishes; nothing else | M3 (parked); CSV exports M4a t45 | n/a | Low now |
| `customer-inquiry-intake` | Reads a customer RFQ in any shape (drawing package, spreadsheet, portal export, phone photo, email thread); one intake form with per-field provenance; separates "never stated" from "stated two ways"; capability check; drafts the questions; provisional bid/no-bid | The RFQ and drawings; mail/attachments; prior quotes and closed-job costs | **No** — job quotes, RFQs and drawings are explicitly out of our scope | None — not our product | — | — | None for maintenance |
| `quote-build` | Builds the make-to-order quote with every number traced: material at the price actually paid on a named PO, machine hours per operation from a labelled ladder, setup re-amortised per quantity break, margin on its own line; date checked against real shop load; revises in place | Intake form; comparable prior jobs and cost history; PO prices; routings; planning export for shop load; rates from a plant profile | **No** — no POs, routings, job costs; only the analytics profile constants in `setting` | None | — | — | None |
| `ncr-writeup` | Writes the nonconformance against the specific requirement it violates, cited to document and page; reasons out how many parts are suspect; places every one across 5 locations; searches prior NCRs — "did the last fix hold?"; drafts the customer escape notification against its contractual clock | Inspection findings; requirement documents with locators; lots and on-hand inventory by location; shipment data (ERP); prior NCRs/CAPAs; a controlled template | **Partial**: `breakdown_report` (problem, action taken, root cause, spare used, category) is the cousin record; no lots, locations or shipments | The "did the last fix hold?" re-check, and evidence packs that cite the ticket rows behind every claim — see §5 item 3 | New (echo) | see §5 | Medium |
| `root-cause-capa` | Puts sensor history, inspection measurements, maintenance records and prior tickets on one verified timeline (refuses to correlate across clocks that don't agree); runs SPC drift and clustering by lot/shift/operator/machine/tool change **in code**; ranked candidate causes with evidence for and against plus the cheapest test that settles it; drafts 8D D1–D5 and D7, leaves D6/D8 empty | Sensor history (no); inspection measurements (no); maintenance records and prior tickets (yes); ERP lots/material receipts | **Partial**: `ticket`, `ticket_event`, `breakdown_report`, `history_breakdown` give the maintenance timeline; no sensors, no inspections | Our M4a t41 root-cause analysis and M6 t57 evidence-ranked Fix Finder; steal the "cheapest test that tells causes apart" draft rule | Partially — M4a t41, M6 t57 | planned | High, for the maintenance slice only |
| `supplier-quote-request` | Builds the supplier RFQ package at the verified drawing revision; mandates a response format that makes bids comparable by construction; hard-stops on revision mismatch; runs the chase loop (draft emails, tracker, never closes the event on a quiet supplier); compares bids per quantity break; recommends, never awards | Drawings/specs at verified revision; approved supplier list; ERP item master, usage history, vendor records, PO history | **No** — no vendor/AMC/PO data today (M4b t51 adds only a minimal register) | Nothing yet; the register is the boundary of our ambition | — | — | Low for us |
| `breakdown-diagnosis` | Reads the sensor window before the failure, the machine's repair history **including the free-text close-out notes technicians actually wrote**, photos, and the manufacturer's troubleshooting tree; ranks likely causes, each with its evidence, the specific prior work orders behind it, and the cheapest test that tells them apart; safety implications first; drafts the PM interval change; batch mode ranks bad actors | Sensor window (no); repair history + close-out notes (**yes**); photos (not captured yet; `file` table ready); manual (M6 t60); CMMS assets/history | **Partial — the best fit of all 17** | M6 t57 Fix Finder drafts; batch mode becomes our narrated bad-actor pack (§5 item 3); the "cheapest test" line belongs in every draft | Partially — M6 t57; batch mode **new** | planned + §5 | High |
| `daily-production-report` | The morning report: output against plan by line/cell/product; OEE with availability, performance, quality shown separately; downtime ranked by minutes **and** by frequency; scrap and downtime priced in dollars; week-over-week movers; exceptions each with one drafted schedule move and what it displaces; optional floor schematic | Consolidated dataset; ERP standard cost and open work orders; production counts and plans; scrap records | **Partial**: downtime minutes, shifts, per-ticket minutes yes (`ticket`, `work_segment`, `breakdown_report`, `shift`); output/plan/scrap counts no | Extends our shift day report with ranked downtime and priced losses (cost/hour already in `setting`); the output/OEE half waits for customer data we don't hold | Partially — M4a t38/40 | 1–2 wks for the downtime half | High for the downtime slice |
| `design-space-explore` | Generates a batch of CAD variants in Fusion by changing parameters on the engineer's own model; checks the parameters actually drive geometry; confirms the count before generating; never overwrites the base; emits the variant manifest | Autodesk Fusion desktop with the document open; nothing else works | **No** — no CAD/models, by design | None | — | — | None |
| `trade-study-report` | Turns a filled decision matrix and analysis results into a ranked, cited comparison; runs the sensitivity analysis every time (where the winner flips); disqualifies hard-constraint failures rather than scoring them down; writes the decision memo | A filled matrix; analysis results; ERP cost figures | **No** (cousin: our Fix Finder ranking, M4a t43) | Nothing directly; the "show what the decision rests on" habit generalises | — | — | Low |
| `rfq-to-quote` *(chain)* | End-to-end: intake → consolidate → Fusion design step → quote; four approval gates; resumable across days while the customer answers | Everything the three atomic skills need, plus Fusion | **No** | None | — | — | None |
| `inspection-to-capa` *(chain)* | NCR → verified timeline → ranked causes → 8D → customer pack behind a redaction diff | Inspection findings; sensors; prior NCRs; ERP lots | **Partial**: our loop is coded closes (M4b t47) + Why-Why records (M4a t41) | Confirms coded closes + failure codes are the right spine for our quality loop | Partially — M4b t47 | planned | Medium |
| `morning-plant-pulse` *(chain, scheduled)* | Overnight: joins last night's exports, flags mismatched keys, computes the morning report, stores a record per production day, keeps one Operations Command Center dashboard per site with 14/30-day trends; **no approval gates** because it writes to no system of record; reports its own gaps | Nightly planning/production/maintenance exports | **Partial**: we are the live source — no exports needed (`kpi_snapshot`, live board t25, Today dashboard t38 are the same pattern) | Our dashboard-and-snapshot pattern is confirmed as the right shape; the stored-day trend idea lands with `kpi_snapshot` | Partially — M4a t36/38 | planned | High |
| `breakdown-to-next-report` *(chain)* | Diagnosis folded into tomorrow's downtime log and exceptions — the breakdown lands in the morning report automatically | Diagnosis output + the production dataset | **Yes, for the pipeline**: breakdown → PDF/day report exists (M1 t18); the diagnosis half waits for M6 | The closing ticket should feed the next morning's figures by default, not on request | Partially — M6 t57 + existing reports | planned | High |
| `supplier-escape-to-alternate-source` *(chain)* | NCR → root cause established against the supplier → corrective action → alternate-source sourcing package; a supplier-caused verdict needs a human owner before it acts | NCR data; supplier/PO data; drawings | **No** — no supplier data | None | — | — | Low for us |

Count check: 17 rows, 17 skills — **all 17 established from the pinned repo**, none invented, none
"reported missing". The trade-press figure and Anthropic's own README agree on the number.

---

## 4. Why so much of this table is "No" — and why that is fine

The plugin's centre of gravity is the **make-to-order commercial loop**: RFQ in, drawing read, quote out,
suppliers chased, 8D written for a customer. That loop lives on ERP records, routings, purchase orders,
lots and CAD files — none of which a maintenance tool should hold, and we store none of it.

What the plugin has **no home for** is exactly our product: the shop-floor ticket loop — who reported the
breakdown, who ran to the machine, what they did, whether production agreed it was fixed, and what the
plant's own 1,354-row history says about that machine. Their `breakdown-diagnosis` skill has to *read a
CMMS connector* to get that data. We **are** the CMMS. That is why the strongest opportunities below are
not copies of any single skill but combinations our own data makes cheap.

---

## 5. Capabilities we are NOT currently planning, that our own data already supports

The star of this pass. Each item: the raw data it uses, what the user sees, why it is cheap for us, which
skill it echoes, the risk, and — honestly — whether it needs a new table. Nine are listed; eight were
asked for, the ninth earned its place.

### 5.1 Warranty / AMC claim evidence packs

- **Raw data:** machine record (make, model, serial, purchase details), `ticket` + `ticket_event`,
  `breakdown_report` (problem, root cause, spare used, downtime minutes), `crew_member` (who attended,
  in which role), the PDF renderer we already run.
- **User-visible behaviour:** on a machine page, a "claim pack" button prints one Gujarati/English PDF:
  every breakdown since purchase, dates, minutes down, spares fitted, what the vendor's engineer did —
  the evidence a plant needs to actually get an AMC or warranty claim honoured, which today means an
  evening with a ledger.
- **Why it is cheap:** every field already exists; it is one query plus a renderer we built in M1. No
  schema change.
- **Echoes:** `ncr-writeup` — evidence cited to records, assembled for a person to send.
- **Risk:** old free text can be thin; the pack quotes it as-is rather than papering over gaps.
- **New table?** None. When M4b's `service_contract` register (t51) lands it can filter by cover; v1
  needs nothing.
- **On our roadmap?** No — **new**.

### 5.2 Spare-part consumption rollups from the free-text spare field (parse-then-flag)

- **Raw data:** `breakdown_report.spare_used` (free text today), breakdown category, machine,
  `history_breakdown` (1,354 real rows).
- **User-visible behaviour:** a monthly page: candidate part names parsed out of the free text, count and
  downtime per machine per candidate name, and every unparsable line flagged for the admin to confirm.
  The confirmed list becomes the evidence that justifies the M4b parts module — with real consumption
  data instead of a hunch.
- **Why it is cheap:** read-only over existing columns; confirmed parsings have a home in the alias
  column on `list_item` (M4a t36). No new table.
- **Echoes:** `data-consolidate` — classify the mismatch, propose the correction, apply on a yes.
- **Risk:** wrong merges double-count parts; keep every parse approval-gated with the raw line beside it.
- **New table?** None.
- **On our roadmap?** No — and it feeds the already-planned M4b t67 (critical spares from report data).

### 5.3 Narrated repeat-offender pack ("bad actors")

- **Raw data:** problem text, `breakdown_report.root_cause` and category, ticket history,
  `history_breakdown`.
- **User-visible behaviour:** a monthly one-pager: machines ranked by downtime × frequency; for each bad
  actor, what failed each time, what was tried, whether it held, and the cheapest check to run next.
- **Why it is cheap:** the *counts* are already planned (M4a t42 repeat faults, t67 Weibull); the
  narration just reads existing text columns. No schema change.
- **Echoes:** `breakdown-diagnosis` batch mode — "which machines are hurting us most?"
- **Risk:** reads as blame if it names people; keep it machine-first.
- **New table?** None — figures fit `kpi_snapshot`.
- **On our roadmap?** The counts are (M4a); the narration is **new**.

### 5.4 Operator's "did you check this?" hint at report time

- **Raw data:** the same machine's open and recent tickets, the quick-problems list, `glossary_term`.
- **User-visible behaviour:** on the third tap of a report, if that machine had the same quick problem in
  the last 30 days, one Gujarati line: "this machine: 3 coolant leaks this month; the last fix was X — is
  it the same?" Dismissible in one tap.
- **Why it is cheap:** one indexed query on existing tables at report time; deterministic, no AI, no
  model cost, before M6 even exists.
- **Echoes:** `breakdown-diagnosis` — "the cheapest test that would tell them apart", stated up front.
- **Risk:** a wrong hint on a busy floor annoys people; same-machine facts only, and watch dismissals.
- **New table?** None.
- **On our roadmap?** No — **new**.

### 5.5 Per-shift accountability digest

- **Raw data:** `crew_member` (primary/support roles), `work_segment` minutes, the M2 sign-off
  (`handback`) with turnaround minutes, `ticket_event`, `shift`.
- **User-visible behaviour:** after every shift, one Gujarati page: what ran, minutes per job, who did
  what in which role, fixes disputed, sign-off turnaround, and the open items handed to the next shift.
- **Why it is cheap:** all fields exist (the M2 tables are already in the plan); it renders like the day
  report we already print. No new table.
- **Echoes:** `morning-plant-pulse` / `daily-production-report` — the page that is simply there in the
  morning, computed from what already happened.
- **Risk:** reads as surveillance; lead with team totals, never rank people on it.
- **New table?** None.
- **On our roadmap?** Partially — M4b t54 ranks technicians by agreed measures; the shift digest itself
  is **new**.

### 5.6 Audit-driven compliance pack for a customer audit

- **Raw data:** `audit_log` (who, when, before/after, IP on support calls, `platform_access` grants),
  lockout confirmations in `ticket_event` (t66), setting-change history.
- **User-visible behaviour:** a "customer audit pack" PDF: every safety-relevant change (lockout flags,
  severity matrix, people switched off), every lockout confirmation, every support-access grant with its
  reason and expiry — each with the controlled-document numbers M4a t39 already carries.
- **Why it is cheap:** `audit_log` exists with an admin CSV export; this is a filtered render, not a new
  system. No new table.
- **Echoes:** `ncr-writeup` — every claim cited to a record — and the plugin's approval-gate discipline.
- **Risk:** low; it shows the trail exactly as it is.
- **New table?** None.
- **On our roadmap?** No — **new**.

### 5.7 PM suggestions from actual failure intervals (the bridge list)

- **Raw data:** `history_breakdown` + ticket dates per machine, category, criticality.
- **User-visible behaviour:** a ranked monthly list: machine, median days between failures, last failure,
  a suggested check-by date, and the basis shown — headed "derived from this plant's history, not a PM
  schedule".
- **Why it is cheap:** a pure read of existing rows, printed like the day report; figures fit
  `kpi_snapshot`. It gives the PM answer *before* the M4b PM module is built.
- **Echoes:** `breakdown-diagnosis` "drafts the PM interval change that would stop it recurring";
  `morning-plant-pulse`'s stored per-day records.
- **Risk:** someone mistakes it for a PM calendar; label it, and exclude machines with too few failures
  (the same rule t67 already sets).
- **New table?** None (`kpi_snapshot`; `pm_plan` stays an M4b table).
- **On our roadmap?** Partially — M4b t49/50 is the real PM system and t67 the rigorous fit; this is the
  bridge, and it is **new**.

### 5.8 Escalation and roster load-balance review

- **Raw data:** `escalation_event`, `notification`, `roster_entry`, acknowledge/restore times in
  `ticket_event`, `shift`.
- **User-visible behaviour:** a monthly view for the head: pages per ladder level per shift,
  acknowledgement latency, who carries the night load — and a suggested rebalance of the roster.
- **Why it is cheap:** the M2 tables are already planned; the figures fit `kpi_snapshot`. No new table.
- **Echoes:** `root-cause-capa` (clustering by shift and operator, computed in code) and the
  `daily-production-report` movers section.
- **Risk:** per-person blame; show load and latency, never a ranking.
- **New table?** None.
- **On our roadmap?** Partially — M4b t54 ranks technicians; the roster-load view is **new**.

### 5.9 Floor-facing Gujarati fix-it knowledge base

- **Raw data:** resolved tickets' problem/action/root-cause text, `glossary_term` (144 live rules) plus
  the Gujarati label store, machine group.
- **User-visible behaviour:** search or scan "coolant leak on VC machines" → the past fixes, in Gujarati,
  with ticket numbers and dates; on the desk first, then the shared floor phone.
- **Why it is cheap:** M6 t57's search (Postgres full-text + `pg_trgm`) is already planned; the floor
  page is read-only over the same indexes. No new table — the manual tables (`document`,
  `document_chunk`) are not needed for this.
- **Echoes:** `breakdown-diagnosis`, whose core evidence is "the free-text close-out notes technicians
  actually wrote".
- **Risk:** an old fix may be wrong or unsafe; always show date and outcome, never present past fixes as
  instructions.
- **New table?** None.
- **On our roadmap?** Partially — M6 t57 (desk) is planned; the floor-facing Gujarati version is **new**.

---

## 6. The five to do first

Ranked by effort-to-value for an Indian factory buyer. Sizes are one-ticket builds per `CLAUDE.md`.

1. **Spare-part consumption rollups (parse-then-flag).** *Size:* 1–2 weeks (parser, admin confirm
   screen, monthly report). *Build first:* the history load (M4a t37) so the 1,354 real rows feed it,
   and the alias column (t36) as the home for confirmed parsings. *Joins:* **M4a**, riding tickets
   40/41; it then feeds M4b t67 and settles the parts-module question with evidence.
2. **Operator's "did you check this?" hint.** *Size:* 2–3 days. *Build first:* ticket 15's report flow
   (merged) and an indexed same-machine query. *Joins:* **M1**, a small follow-up ticket after 15/18 —
   the cheapest floor-visible win on this page.
3. **Warranty / AMC claim evidence pack.** *Size:* 1 week. *Build first:* nothing — machine records and
   tickets exist today. *Joins:* **M4a** t39 (machine pages), which already shows nameplate and history.
4. **Narrated repeat-offender pack.** *Size:* 3–5 days once the counts exist. *Build first:* M4a t42
   (repeat faults) and t37. *Joins:* **M4a**, extending t42's screen with the narration.
5. **Per-shift accountability digest.** *Size:* 1 week. *Build first:* M2 tickets 30–34 (clocks, sign-off
   with turnaround) live. *Joins:* **M2**, after t34 — it is the milestone's goal made printable.

Honest cut line: the escalation load-balance review (5.8) and the PM bridge list (5.7) are the next two;
both wait on M2/M4a data anyway. The compliance pack (5.6) is held until a customer audit is scheduled —
building it for no audit invites bloat, which is against `docs/LEAN.md`.

## 7. What we should deliberately NOT build

- **The commercial loop skills** — `customer-inquiry-intake`, `quote-build`, `rfq-to-quote`,
  `supplier-quote-request`, `supplier-escape-to-alternate-source`: they run on ERP/PO/CAD data we do not
  hold and should not hold.
- **Both design skills** (`design-space-explore`, `trade-study-report`): CAD is not our domain.
- **Connectors**: we are the system of record for the floor; our import/export paths already cover the
  file-based life the plugin promises.
- **A chat window bolted on**: the plugin's real lesson for M6 is structural — skills as thin layers over
  one dataset, every figure traced to a row, every change behind a gate, and honesty rules
  (`absent-is-not-zero`, "freshness is a headline") enforced in code. Our M6 tickets 56–60 already
  follow that shape; keep it.

---

Date of research: 17 November 2026.

Every Anthropic claim above was checked against the pages below on this date. Skill names and
descriptions are from the pinned commit `dcfcf76` of Anthropic's own plugin repository — the same commit
the Claude marketplace plugin page links to.

## Sources

- S1. `https://claude.com/resources/articles/claude-for-manufacturing` — Anthropic's launch article,
  12 Nov 2026 (fetched full text): the 17-skills/4-connectors claim, the six named processes, the
  connector roles, the Infor write path with buyer approval, "doesn't operate equipment", Model Hardware
  Standard as research preview, Team/Enterprise availability, the technical webinar of 17 Nov.
- S2. `https://claude.com/marketplace/plugins/claude-for-manufacturing` — the marketplace plugin page:
  the plugin description verbatim, "Made by Anthropic", and the link to the plugin source at commit
  `dcfcf76`.
- S3. `https://github.com/anthropics/claude-plugins-official/tree/dcfcf760da03001c60e1133f51c00545863dd5a8/plugins/claude-for-manufacturing`
  — the plugin's source repo (also fetched as the GitHub API tree, which lists exactly 17 `skills/`
  folders, 11 `shared/contracts/`, `README.md`, `plugin.json`, `.mcp.json`).
- S4. The 17 `SKILL.md` files (name + description + compatibility frontmatter) and `README.md` at that
  commit — fetched individually via raw.githubusercontent.com; the README states "Skills: 17 — 12 atomic,
  5 chains", the connector setup tables (Fusion declared; M365, NetSuite, Infor M3 enabled in Claude),
  "Eleven of the twelve skills still work" without connectors, the five chains, and the "How it keeps you
  safe" rules.
- S5. `https://claude.com/solutions/manufacturing` — Anthropic's solutions page: drafts come with context,
  approvals stay with the team, "vendors' systems remain the system of record", owners can require
  approval before a connector changes anything.
- S6. `https://machinetoolnews.ai/claude-for-manufacturing-ai/` — trade-press report (16 Nov 2026),
  fetched full text: confirms 17 skills, 4 connectors, 12 Nov launch, no verified ROI results; names no
  individual skills.
- S7. `https://www.anthropic.com/news/claude-for-manufacturing` — HTTP 404 in our fetch (the
  announcement lives on claude.com, not anthropic.com/news); `https://docs.claude.com/en/docs/claude-for-manufacturing`
  redirects to platform.claude.com, which renders empty in our fetcher, and its `.md` variant 404s.
- S8. Internal, same worktree: `docs/DATA-MAP.md` (table names), `docs/plan/MILESTONES.md` (milestone
  goals and ticket numbers), `docs/research/upkeep-vs-uptimo.md` and `docs/research/borrowable-capabilities.md`
  (passes one and two).
