# UpKeep vs Uptimo — product research

For the owner. Plain English. Every UpKeep claim below comes from a page we actually fetched (URLs in
section 7). Where the site did not say something, we wrote "not stated publicly" rather than guessing.
Uptimo facts come from our own build state (see `docs/HANDOFF.md`), not from marketing.

---

## 1. UpKeep in one page

- **What it is.** A US-built CMMS sold as an "Asset Operations Platform": maintenance, safety,
  inventory, condition monitoring, labor and procurement on one platform, with one login, one asset
  record and shared permissions across all of it. [product/]
- **Named products/modules.** Maintenance CMMS, EHS Safety, Training (Learn), Edge (sensors / condition
  monitoring), Fleet, Inventory. [product/]
- **Who buys it.** "4,000+ industrial teams". Named industries: manufacturing, healthcare, facilities
  and property, hospitality, wholesale and distribution, transport and fleet, government, education,
  utilities and energy, construction, life sciences. Logos shown: McDonald's, Caterpillar, Pepsi,
  Chevron, Unilever, Yamaha, Shell, Stratasys. [product/]
- **What it is known for.** Mobile-first maintenance: PM checklists on phones with an offline mode,
  photos, readings and sign-offs captured at the asset; "no coding required, deploy in minutes".
  [PM page, product/]
- **Its AI.** "Nova AI" looks at failure history and sensor data and recommends PM intervals; on the
  Edge sensor side it drafts work orders from sensor alerts. The sensor-fed part only works with
  UpKeep's own hardware. [PM page, Edge page]
- **Pricing.** The CMMS page states "Starts at **$24/user/month**" with "unlimited free requester
  seats", and a free trial is offered. The full tier list did not render on the pricing page itself;
  Edge sensors and gateways are priced separately with their own pricing page. [CMMS page, pricing
  page, Edge page]
- **Where it is weak (what we can see).** The predictive story depends on buying UpKeep sensor
  hardware; the integrations page names ERP/accounting/ticketing (SAP, QuickBooks, Oracle, Zapier)
  and no shop-floor or India-specific tools; we found no India content, no Indian-language support
  and no GST/Tally mention anywhere we fetched; and per-user pricing sits awkwardly against a floor
  with hundreds of operators, many on shared phones. All four are openings for an India-first tool.

---

## 2. Big comparison table

| Area | UpKeep | Uptimo today | What we don't have (gap) | What we can do about it (and when) |
|---|---|---|---|---|
| Core work orders | Work orders auto-created from PM schedules and sensor alerts; push notification to the technician's phone on assignment; auto-routing by skill set, location and availability; custom fields, checklists, priorities, templates. [PM, Edge, WO, CMMS] | Ticket detail; start (back-dated), pause with reasons, resume, join, transfer, close with a report, close without, record a past breakdown; follow-up tasks with expected date and done-minutes. | Photo capture on tickets is not in our built set; phone push notifications; per-step checklist execution on a job. | Photos on close and PWA notifications are small builds; do them when a buyer asks. |
| Assets & hierarchy | One asset record shared by Maintenance, Safety, Inventory and Edge; sensors grouped under assets; full lifecycle from purchase to decommission with warranties and depreciation. [product/, Edge, CMMS] | Settings for machines, segments, groups; one plant per tenant. | Deep location→asset→sub-asset trees; per-asset cost history. | Machine tree already exists; deepen only under M4b when a buyer needs it. |
| Preventive maintenance & scheduling | PM on time, runtime hours/cycles/miles, or sensor drift; UpKeep generates the work order with checklist and parts; daily→custom recurrence. [PM] | Not built. We have follow-up tasks with expected dates and lockout steps before Start. | The single biggest product gap: PM calendar, PM checklists, auto-generation. | M4b (planned): time-based PM calendar + per-machine checklist template first; meter-based triggers later. |
| Mobile & offline | Offline mode keeps phones working "in basements and remote sites"; checklists, readings, photos, sign-offs on mobile. [PM] | Operator phone PWA: three-tap reporting, offline outbox with replay; personal or shared phone logins; live board on TV/phone/browser with kiosk mode. | A native app-store app is possible at UpKeep (not stated publicly in our fetch); our PWA covers the use case. | Keep investing in offline replay robustness; native apps are not needed yet. |
| Parts inventory & purchasing | Inventory is a suite app; parts lists attach to PMs; procurement on the platform. [product/, PM] | Not built. | All of it. | M4b: start with parts used per ticket plus a stock count, not full purchasing. |
| Vendors / AMC | Not stated publicly on pages we fetched. | Not built; vendor/AMC/legal registers planned. | Both look weak here — an opening, since AMC records matter to Indian factories. | M4b registers; keep them minimal (vendor, contact, expiry, cost). |
| Approvals & SLA | "Roles, sites, and approvals carry across every application." Specific SLA machinery: not stated publicly. [product/] | SLA policies and severity matrix; escalation defaults; wait reasons with SLA-pause flags; sign-off "Is it fixed?" (confirm / dispute with reason reopens the same ticket); lockout steps before Start with second-person confirmation. | Nothing material — our sign-off and lockout story is more concrete than anything UpKeep states publicly. | None now. |
| Reporting & dashboards | "UpKeep Intelligence" dashboards that surface trends, predict failures and recommend actions; a maintenance scorecard with PM compliance, completed work and asset health. [CMMS, PM] | Breakdown PDF and shift day report rendered server-side with Gujarati/Devanagari fonts and a QR; live board with 30-second refresh and kiosk mode. | Trend/summary figure screens (our analytics engine shell exists; figure screens not built). | M4a (planned). |
| Analytics & forecasting | Nova AI flags PMs that fire too often or not often enough and recommends intervals. Broader forecasting: not stated publicly. [PM] | Not built; forecast and scorecard planned. | All of it. | M4b for scorecard/forecast from our own ticket history; M6 for AI. |
| AI & predictive | Nova AI: PM interval recommendations from failure history and sensor data; AI-drafted work orders from sensor alerts; "UpKeep Intelligence" dashboards predict failures and recommend actions. [PM, Edge, CMMS] | Not built; planned M6 (AI on Indian factory data). | All of it — but UpKeep's strongest AI needs its sensor hardware. | M6: AI on the factory's own complaint/breakdown history first, which needs no hardware. |
| IoT / sensors & meters | UpKeep Edge: wireless, battery-powered, IP-rated sensors (environmental; power & electrical; motion; safety & leak; vibration; pressure), gateways, live dashboards, alert→auto work order. Hardware sold by UpKeep. [Edge] | Not built; no sensor or meter feeds. | The whole condition-monitoring layer. | Don't build hardware. Cheap stand-in: manual daily meter entry per machine, which later feeds M6. |
| Integrations & API | Native integrations plus Zapier plus a public API; SAP, QuickBooks, Oracle named. [Integrations] | No third-party API/webhooks; no ERP/accounting/SSO/Slack. | All of it. | WhatsApp/voice (M3, parked) matters more in India early; API after the floor loop is solid. |
| Request portal / intake | A request portal open to anyone in the organization; requester seats are free and unlimited; requests convert to work orders and status updates flow back to the reporter. [WO] | Floor reporting in three taps on the operator PWA; "My complaints"; floor warning for an unfinished follow-up task. | A web form for non-operators/other departments. | Small form intake after M2 if a buyer asks. |
| Multi-site / enterprise | "Roles, sites, and approvals carry across every application" — multi-site is in the product. [product/] | One plant per tenant. | All of it. | Deliberate: stay single-plant until buyers ask; it is a schema change, plan it then. |
| Roles, permissions & audit | Enterprise permissions across apps; "complete audit trails" — every action on every work order logged with who, what, when and how long. [product/, WO] | Roles and cells; personal or shared phone logins; switch-off with an audited reason; bulk shift change / sign out devices / switch off; last sign-in; audit trail with filters and admin-only CSV export. | A granular custom permission builder. | None now — audit trail already exceeds what UpKeep states publicly. |
| Security & compliance | "SOC 2 compliant" stated on the product page. Other certifications: not stated publicly in our fetch. [product/] | Postgres with forced row-level security per tenant; audit trail; Terraform/AWS; staging deployed. | A third-party certification (real audit cost). | Keep RLS + audit; consider SOC 2 only when selling to multinationals. |
| Languages & India fit | Nothing about India, Indian languages, GST or Tally found on any page we fetched: not stated publicly. | Whole screen set in Gujarati plus an admin translation screen; PDFs rendered with Gujarati/Devanagari fonts and a QR; WhatsApp/voice planned (M3, parked). | None — this is our wedge. | Use the admin translation screen to add Hindi/Marathi; it is config, not a rebuild. |
| Deployment & stack | SaaS; "no coding required, deploy in minutes". Its stack: not stated publicly. [product/] | TypeScript modular monolith (Fastify), Postgres with forced RLS per tenant, React PWA with offline queue, Playwright browser tests, Terraform/AWS, staging deployed. | Nothing a buyer feels. | Keep. |
| Pricing / business model | CMMS "starts at $24/user/month" with unlimited free requester seats; free trial; Edge hardware priced separately; the full tier list did not render in our fetch. [CMMS, pricing, Edge] | Not public; intended as per-plant SaaS. | A published price list. | Publish simple per-plant ₹ pricing; it undercuts per-user licence-plus-hardware patterns for a floor with hundreds of operators. |

---

## 3. Where Uptimo is genuinely ahead

- **Language.** Every screen in Gujarati, an admin translation screen, and PDFs rendered with
  Gujarati/Devanagari fonts and a QR. UpKeep shows no Indian-language support anywhere we fetched.
- **The shared-phone shop-floor model.** Personal or shared phone logins, bulk shift change, sign-out
  devices, audited switch-off. This is built for factory shifts, not office desk users.
- **Discipline enforcement.** Sign-off answer "Is it fixed?" — confirm, or dispute with a reason that
  reopens the same ticket; lockout steps before Start with a second-person confirmation. Concrete
  loops that a supervisor can run, not just a status field.
- **Paper outputs.** Server-rendered breakdown PDF and shift day report with a QR — the documents
  Indian plants actually print, pin and circulate.
- **The live board.** TV/phone/browser display with 30-second refresh and kiosk mode, out of the box.
- **Audit as a feature.** Audit trail with filters and admin-only CSV export, plus an audited reason
  for switching a person off.
- **Offline as a design center.** Offline outbox with replay for patchy factory wifi — same intent as
  UpKeep's offline mode, but aimed at operators on cheap Android phones.
- **A pricing model that can fit a factory floor.** UpKeep charges per user per month; a plant that
  wants 200 operators reporting problems is 200 subscriptions, softened only by its free requester
  seats. A per-plant price with shared phones matches how Indian factories actually staff a floor.

## 4. Where UpKeep is clearly ahead

Ranked by how much it matters to an Indian factory buyer:

1. **PM scheduling and checklists.** Automatic work-order generation on time, runtime or sensor
   triggers, with checklist and parts attached. This is the first thing most buyers ask for. (Our
   M4b.)
2. **Spare-parts inventory and purchasing** attached to the same asset record. (Our M4b.)
3. **AI that does a visible job:** PM interval recommendations and AI-drafted work orders — though
   the strongest parts depend on UpKeep sensor hardware. (Our M6.)
4. **IoT condition monitoring sold as a product:** sensors, gateways, live dashboards, alert-to-work-
   order. Real hardware cost sits on the buyer's side.
5. **Integrations:** SAP, QuickBooks, Oracle, Zapier, public API.
6. **Suite breadth:** safety/EHS, training/LMS, fleet on one platform — a "one vendor" pitch.
7. **Scale signals:** multi-site permissions, SOC 2, 4,000+ teams, recognisable logos.
8. **Asset lifecycle management:** warranties, depreciation, purchase-to-decommission history per
   asset. (Our machine records are simpler.)
9. **A mature demo-led sales motion for enterprise buyers.**

## 5. The five gaps most likely to lose us a deal

1. **PM calendar and checklists.** The default opening question. Build-sized fix: a time-based PM
   calendar plus one checklist template per machine; meter-based triggers later (M4b).
2. **Spare parts.** "Show me what a repair costs in parts" ends many trials. Fix: a single parts
   table with stock count and deduction on ticket close — days, not months.
3. **Trend reporting / figure screens.** Owners ask "show me last month". Fix: build the 6–8 figures
   already named in our answer key (M4a).
4. **Accounting/ERP expectations.** Corporate buyers ask about Tally/SAP. Fix: CSV exports first
   (the audit export already exists), then a Tally-format export — no live integration needed.
5. **WhatsApp/voice reporting.** Operators live in WhatsApp; an app they must open daily is friction.
   Fix: revisit parked M3 — even one-way posts of breakdown reports into a WhatsApp group is a cheap
   wedge.

## 6. What we should deliberately NOT copy

- **The sensor hardware business (Edge).** Capital, logistics and support burden we cannot carry.
  Stay software; read meters manually, then from gateways via API later.
- **Suite sprawl (safety, LMS, fleet).** Our anti-bloat rule: the factory's core loop first. Each
  extra "app" dilutes the one thing we must be best at.
- **Hidden, sales-led pricing.** UpKeep's tiers did not even render for us. Publish simple per-plant
  ₹ pricing — it is a trust signal in the Indian mid-market.
- **ERP-first integrations.** The floor loop must be solid before we build connectors nobody has yet
  asked for in a live deal.
- **English-first UX with translation as an afterthought.** Keep language a first-class, admin-
  configurable feature — it is the wedge, not a checkbox.

---

## 7. Sources

Every page below was fetched on the date at the bottom. One line each on what it established.

- `https://upkeep.com/` — fetched OK, but the page content was truncated before rendering; no
  independent claims taken from it (positioning above comes from the product pages).
- `https://upkeep.com/pricing/` (fetched twice, with and without trailing slash) — fetched OK both
  times, but the tier content did not render; no prices, tier names or gates were captured. Treated
  as "not stated publicly (in our fetch)".
- `https://upkeep.com/products/` — HTTP 404 (dead path; the real index is `/product/`).
- `https://upkeep.com/product/` — the platform overview: the six named applications, one-login/one-
  asset/shared-permissions model, "SOC 2 compliant", "no coding required, deploy in minutes",
  4,000+ teams, industry list, customer logos.
- `https://upkeep.com/product/preventive-maintenance` — PM triggers (time, runtime, sensor drift),
  automatic work-order generation with checklist and parts list, mobile PM checklists with offline
  mode, photos/readings/sign-offs, recurring schedules, Nova AI interval recommendations.
- `https://upkeep.com/product/integrations` (reached via `/integrations/`) — native integrations,
  Zapier and a public API; SAP, QuickBooks, Oracle named; ERP/accounting/ticketing framing.
- `https://upkeep.com/product/edge-iiot/` — UpKeep Edge: sensor categories (environmental, power &
  electrical, motion, safety & leak, vibration, pressure), gateways, real-time monitoring grouped by
  asset, alerts and AI-drafted work orders, separate Edge pricing page.
- `https://upkeep.com/product/cmms-software/` — the pricing anchor "starts at $24/user/month" with
  unlimited free requester seats; mobile push notifications on assignment; enterprise asset lifecycle
  (purchase to decommission, warranties, depreciation); "UpKeep Intelligence" dashboards.
- `https://upkeep.com/product/work-order-software/` — request portal with free unlimited requester
  seats and status updates back to the reporter; auto-routing by skill/location/availability; custom
  fields, checklists, priorities, templates; automatic audit trail of every work-order action.

**Could not be verified** (pages we did not fetch or that did not render): what each tier above the
$24 entry point gates; barcode/QR scanning; notification behaviour beyond assignment push; security
certifications beyond "SOC 2 compliant"; data-residency and uptime claims; native mobile app
listings; any India presence, Indian-language support or Tally/GST features; Edge sensor and gateway
prices.

**Date of research:** 17 November 2026.

Prices and features change without notice. Anything above marked "not stated publicly (in our fetch)"
means the site did not say it on the pages we fetched — check the live site before quoting any number
or tier in a deal.

Follow-up pass: `docs/research/borrowable-capabilities.md` — what can be borrowed, embedded or
integrated from four further sources (llbbl/upkeep, the upkeepapp GitHub org, claude-manufacturing-skills,
and the machinetoolnews Claude-for-Manufacturing report); same date.
