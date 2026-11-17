# Where things stand

Read first. Rewrite when the state changes. Under 50 lines.

## RESUME HERE (M4a analytics parity, 17 Nov 2026, night)

**State:** `main` = `c026546`. **M2 is accepted.** **M4a is current: tickets 36, 37 and 38 are done — the Dashboard is
complete and every figure is exact against Bhavin's 11 November key** (#293, #295, #298, #299; screen and role homes
#297). **Ticket 39 (registers, cell change log, footprint, age, machine page) is built and in review**: engine on branch
`m4a-regs` (**draft PR #304**, five figures exact against the 11 Nov key: registers, A7 footprint, A8 age, machine-page,
cell-change-log) and screens on branch `m4a-regs-ui` (**draft PR #305**: registers pages, cell log + CSV export, one page
per machine, the frozen value shapes). Both are pushed, tested locally (30 domain tests; 65 web tests + 2 e2e) and
**await a fresh reviewer → one CI run each → merge one at a time → `main:check`**.

**Unattended runs:** follow `docs/plan/night-run.md` — the loop per ticket, the evidence standard, the post-gate
backend architecture review, and the **night exception to gates** (write and merge the gate report, continue; no
irreversible action unattended). Nimish is loading credits; if the budget still runs out, stop and report.

**Frontier:** 40 Breakdown analyses (with **37c, the 2026 breakdown-log load** — its prerequisite, plan it first) → 41
manpower/energy/root cause → 42 forecast → 43 compare/team/money/Fix Finder → 44 Action Center → 45 reports/export/
Guide → **M4a gate** (`docs/plan/gates/M4a.md`, under 30 lines) → **M4b** (10 tickets: 46–54 and 67) → **M6** (55–60).
**M3 is out.** The **frontend overhaul** is a later workstream (`docs/plan/frontend-overhaul.md`), not in the loop.

**Historic registers** are planned in `docs/plan/history-registers-plan.md` — **draft PR #300, Nimish's to review**.
H1–H5 run beside the M4a tail after 37c; H6–H7 after the M4a gate; H8–H9 in M4b's first window. Consent is settled
(N14, 17 Nov); the one precondition is coding names on the operator's machine before any AI pass (H2). No real register
file goes into the repo.

**The platform's own Guide is the authority for every formula** — `docs/discovery/source/cosmos_platform.html` (and
`docs/slices/38-dashboard.md` revision 4 has the distilled rules). When a number does not reproduce, stop and report.

**Routing:** per `docs/decisions/D31-…`. The coder route writes; planning and reviews run on Isoquant's second family
(the reasoning-route key is still absent — recorded). Never a silent model switch.

**Open PR:** only #300 (the history plan, draft, awaiting Nimish). Queue is otherwise clear.

## Next session, first three steps

1. Read this file, `docs/plan/ledger.md` (17 Nov lines) and `docs/plan/MILESTONES.md`; refresh Graphify.
2. Land ticket 39: fresh-review #304 and #305 (plan on the `m4a-regs` branch), then one CI run each, merge one at a time,
   `main:check` after each.
3. Plan 37c + 40 together (the log load is 40's input): the Guide's A1–A3 rules are already extracted; the fixture
   `fixtures/answer-key/{breakdown-log,a1-bd-pm,a2-category-cell,a3-mttr-mtbf}.json` is the acceptance.

One orchestrator; children use fresh contexts and disjoint files; contract first, never two writers on one file.
