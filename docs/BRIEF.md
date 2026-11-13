# Brief — Uptimo

Product owner: Nimish. Decided 13 November 2026 unless a line says otherwise. Product detail lives in
`docs/spec/SPEC.md` (what) and `docs/spec/PARITY.md` (the parity line items); this brief fixes **scope,
order and non-negotiables** for planning. Where this brief and the spec disagree, this brief wins.

## Product

**Uptimo** is a maintenance operating system for Indian factories, sold per plant. A breakdown is reported in
three taps on a phone, becomes a ticket with a named owner, two clocks (acknowledge, restore) and an escalation
path, is closed with a coded report and signed off by production, and feeds analytics that forecast the next
breakdown and prove whether maintenance is working. AI suggests; a person confirms.

- **First and only tenant for now:** Cosmos Engitech (~192 machines; CNC, conventional, process, utility, DG,
  robot). Its data, people and both of Bhavin's tools are loaded; nothing is re-typed.
- **Users:** operators and technicians who do not use computers; supervisors and a maintenance head on phones;
  a plant head who wants one monthly scorecard; an admin who configures the plant.
- **Minimum product:** everything Bhavin's live ticket app (v3) and his analytics platform do today, on our
  stack, with Cosmos's data (the parity ledger `docs/spec/parity.yaml`). Then the layers in SPEC §3.

## Scope and order (in this order; each milestone has a gate Nimish answers)

1. **Harness re-baseline** — one process (Athena v3), issues as the queue, true status.
2. **Design system first** — one design language installed before more screens are built (see below).
3. **Staging live** — Nimish tests every slice on his phone.
4. **M1 parity complete and cutover** — ticket raising at Cosmos happens on Uptimo; Bhavin's app read-only.
5. **M2 Accountability** — severity, SLA clocks, escalation ladder and duty roster, acknowledge, production
   handback (confirm/dispute), push notifications, operational safety (failed jobs, timer-lag alarm, device revoke).
6. **M4a Analytics parity** — every figure of Bhavin's platform reproduced exactly at a frozen as-of date,
   after a usage triage with Bhavin decides which screens are kept.
7. **M4b The loop** — PM plans and calendar, failure-code taxonomy at close, shift-calendar KPIs, frozen monthly
   forecasts, scorecard, inspection tickets from Hot machines, intervention ledger.
8. **M6 AI layer** — evaluation harness first; failure-code suggestion, fix finder with evidence, duplicate
   detection, plain-language analytics, daily briefing per role, PM drafts from the plant's manuals. Each runs
   in shadow mode until it clears its acceptance threshold. AI never invents numbers or codes.
9. **M3 WhatsApp and voice — last.** Report by WhatsApp text/voice, transcription, PDFs on WhatsApp, email.
   Nothing before it may depend on it; push is the only notification channel until then.

**Deferred (not planned now):** second tenant / plant two (M5): onboarding wizard, industry packs, settings
cascade, multi-plant tenants, Hindi, mid-market features. Multi-tenant safety already built (RLS, no plant
constants in code) stays a rule.

## Design language (non-negotiable)

- One design language, written in `docs/DESIGN.md` (Apple principles: clarity, deference, depth) and
  `docs/FRONTEND-STRATEGY.md`, **approved by Nimish on a live component gallery before further screens are built**.
- Every element comes from one pre-installed kit: tokens (colour, type, space, radius, motion), one component
  library and one icon set. No hand-styled one-off elements, no second UI kit, no custom chart code.
- Status is a fixed vocabulary (colour + label + icon) used identically on every face.
- Screens are thin compositions of shared components and shared page patterns (list, detail, form, settings
  table, dashboard). Frontend code must stay small and modular; a new screen is mostly configuration.
- Phone first (360 px), 52 px targets on the floor, WCAG AA, English and Gujarati, offline-tolerant.

## Non-negotiables carried from the spec

Accountability loop first; every legacy number reproduced before any is improved; everything plant-specific is
configuration; server-side permissions; event log is the truth; data stays in India (AWS ap-south-1) unless an
ADR with a data-protection note says otherwise; no secrets or real personal data in the repo.

## Inputs (owner: Nimish / Bhavin)

Held in `docs/discovery/`: v3 client source (`app.js`, `maint.html`, `ref.js`, `voice.js`), live config and
glossary (9 Nov), platform export (28 Oct), an older platform HTML, discovery call transcript.
Still needed: see `docs/plan/NEEDS.md` (N1 live ticket export **and** Worker source, N2 current platform HTML

- latest Excel export, N3 PM tool, N5 Gujarati strings, N7 domain + OIDC, N10 security reviewer, N11 shifts,
  N12 code aliases, N14 data-use consent, N15 usability sessions). N13 is closed: the name is **Uptimo**.

## Open product questions (answered by Nimish, not agents)

- M2-2.3 escalation: ladder people, roster model, delays/repeats, who may acknowledge, notification payload —
  answer after two weeks of live use; agents propose defaults.
- M4a: which platform screens Cosmos actually uses (triage with Bhavin).
- M6: where AI inference may run given data residency (India region only, or an ADR allowing otherwise).
