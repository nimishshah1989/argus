# Where things stand

Read first. Rewrite when the state changes. Under 50 lines.

## RESUME HERE (M4a analytics parity, 17 Nov 2026)

**State:** `main` = `88d6515`. **M2 is accepted (Nimish's go, 17 Nov).** **M4a is the current milestone**: ticket 37
is done except the **breakdown-log load (37c)** (#289 machinery, #290 face/Guide/profile, #291 record); ticket 38 has
**11 of 16 Dashboard figures exact** against Bhavin's 11 November numbers: #293 built the answer-key seam (workbook
fixture → engine data) with the six machine counts, #295 added total breakdowns 1279, total downtime 3060.1 h, PM
759.3 h, NO-DT 209.1 h, avg 24.29 h/machine, and **joined the computers into `COMPUTERS`** with both shell tests
moved to the stronger ready-set invariant. The tracker, ledger and this file are the truth; M3/M5 are parked.

**Frontier, in the order Nimish approved:** 38 Dashboard/Today → 40 Breakdown analyses → 39 registers and machine
pages → 41 manpower/energy/root cause → 42 forecast → 43 compare/team/money/Fix Finder → 44 Action Center → 45
reports/export/Guide. Then the M4a gate (`docs/plan/gates/M4a.md`, under 30 lines) for his go.

**The one real gap to start with:** `COMPUTERS` in `packages/domain/src/analytics/computers.ts` is **empty**, so all
43 registered figures answer `not_computed`. Each screen ticket adds its figures there against
`fixtures/answer-key/<screen>.json`, with `pnpm parity` rows updated in `docs/spec/parity.yaml`. The seam is
`runWith(computers, {data, asOf, profile})`; the drill-provenance rule is already enforced by the engine.

**Calls recorded (Nimish, 17 Nov):** order as above; money = heads/plant_head/admin only and never on the TV; build
on the 16 Nov **32 KEPT** triage set while Bhavin's N12 review is outstanding; ticket 35 goal 1 (failed-jobs screen,
timer-lag alarm) **parked**, not a gate. Menu groups use SPEC §8's names, each figure in exactly one group (a test
enforces it); the analytics face is desktop-first, so a phone gets no Analytics tab until a mockup is approved.

**Routing:** as `docs/decisions/D31-…` (names live there). The coder route answered and wrote every packet; the
reasoning/review route's API key is still absent, so planning and all reviews run on Isoquant's second family —
recorded, never a silent switch. Budgets are inside.

## Next session, first steps

1. Read this file, `docs/plan/ledger.md` (17 Nov lines) and `docs/plan/MILESTONES.md`; refresh Graphify.
2. Continue ticket 38 from `docs/slices/38-dashboard.md` (revisions 2–3 binding). **Four KPIs are held for Nimish**
   (see his questions below) and must stay `not_computed`: fleet availability, plant BD %, avg complaints/day, avg
   hours/day. Next: 38.2 (charts + the data checklist — checklist source `fixtures/answer-key/data-checklist.json`,
   `extra.items`, and it must drill to tickets per R2; the bubble radius and the timeline grouping are stop-and-ask,
   held with the four), then 38.3 (the Dashboard screen + the head's Today, with the eleven real figures and honest
   placeholders for the held ones). A dropped computer is caught only by the domain suite — add one HTTP-level pin in
   38.2/38.3 (reviewer note on #295).
3. 37c (the 1,354-row breakdown log) is the input 40 needs; a draft scope from another session (#292, old registers
   2022/24/25 with 4,767 entries) awaits Nimish's eight product decisions and a D21 data-consent check.
4. **Open questions for Nimish** (they unblock four KPIs): the machine-hours denominator behind Fleet Availability
   99.32 % and Plant BD % 0.54 % (126 or 159 machines, hours/day, date span, averaged per machine?); and the divisor
   behind Avg Complaints/Day 4.11 and Avg BD Hours/Day 9.84 (311 platform days, 315 span, or 256 days with records?).
   **For Bhavin:** our seed files BOXY under Robot (CNC 125/158) while his platform counts it in CNC (126/159).

One orchestrator; children use fresh contexts and disjoint files; contract first, never two writers on one file.
