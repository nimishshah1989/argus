# Where things stand

Read first. Rewrite when the state changes. Under 50 lines.

## NEXT SESSION GOAL (agreed 17 Nov 2026)

**Ship M2 Accountability — roster and ladder settings, live SLA clocks, the escalation feed and lockout
settings — so that sign-off turnaround is visible on live tickets. Stop at the M2 gate.**

Why this one: it is the next milestone in the plan's order and its server side exists already (schema #228;
roster/ladder, escalation, notifications and timer APIs merged); what is missing is mostly screens plus the
gate criterion. Bounded, with a checkable gate.

Then, in order: **M4a** analytics figure screens (engine shell + answer key are in `main`), then **M4b**
preventive-maintenance scheduling and spare parts — the two gaps the UpKeep research says lose deals — then
**M6** AI on Indian factory data.

Start the next session with: "Orchestrate `docs/plan/MILESTONES.md` per `CLAUDE.md`, next goal: M2
accountability per `docs/HANDOFF.md`."

Carried, owned by Nimish: M1's human items — external security review (26), usability sessions (27), Bhavin's
cutover rehearsal (28). Nothing in M2 blocks them.

## RESUME HERE (17 Nov 2026)

**State:** `main` = `b9da80e` (#280, the first merge train). **The unmerged PR queue is clear.** Every M1
screen ticket is merged: 15–19, 20–25, 22, 34 p1, 37A, 36A/B, 66 — floor, desk, work-the-ticket, close/PDFs,
settings, lists/glossary/company, people/logins/audit, sign-off, lockout, follow-up tasks, Gujarati +
translation screen, live board/alerts. The M1 gate report is at `docs/plan/gates/M1.md` and stops for Nimish.

**Open PRs:** #281 (test-cost cuts: imports job, real test timeout, path fixes, axe subset) and #282 (this
session's ledger, tracker, gate report, handoff). Both are waiting only on GitHub Actions — the account's
billing/spending limit stopped run creation again.

**Routing and budgets:** coder `isoquant/deepseek-v4.1-flash-1017-fast`; reasoning `deepseek-account/
deepseek-flash` (`DEEPSEEK_API_KEY` absent, so no Pro; R3 uses flash + a glm-5.3-flash adversary). Both budgets
are hard stops; the orchestrator has no spend meter — check the provider dashboards.

**Quality:** Q1–Q15 in `docs/QUALITY-ATTRIBUTES.md` (D32). `pnpm quality` locally, `pnpm quality:pr` in the
pr-meta job, `pnpm push:check` before every push (chain it with `&&` — it has caught three near-misses), and
`main:check` after every merge (Q15). CI is path-filtered (#277) and browser-sharded 3 ways (#274). Merge
trains are allowed: one PR may carry one fragment per ticket with a `Merge train:` line (#279) — the first one
shipped #280.

**Research on file:** `docs/research/upkeep-vs-uptimo.md` (UpKeep: $24/user/mo, Nova AI, Edge sensor hardware,
SAP/QuickBooks/Oracle/Zapier, SOC 2, no India presence) and `docs/research/borrowable-capabilities.md` (four
AI/manufacturing sources — borrow/embed/integrate analysis).

**Open for Nimish:** (1) hidden-group breakdowns still push a phone alert — should they go quiet? (2) the
update-banner window is 15 min in code, 30 in SPEC; (3) ticket 68 needs a translation-provider decision;
(4) Actions billing keeps stopping runs; (5) export the slice 1–4 mockup frames as PNGs so those screens get a
real side-by-side instead of a Q7 waiver.
