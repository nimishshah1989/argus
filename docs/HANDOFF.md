# Where things stand

Read first. Rewrite when the state changes. Under 50 lines.

## RESUME HERE (M4a analytics parity, 17 Nov 2026)

**State:** `main` = `b0f6b7f`. **M2 is accepted (Nimish's go, 17 Nov).** **M4a is the current milestone**: ticket 37
is done except the **breakdown-log load (37c)** (#289 machinery, #290 face/Guide/profile, #291 record); ticket 38 has
its **first packet merged** (#293): the answer-key seam (workbook fixture → engine data, deterministic dates/shifts/
sources) and six Dashboard figures exact against Bhavin's 11 November numbers (159/30/3/126/16/17). The tracker,
ledger and this file are the truth; M3/M5 are parked.

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
2. Continue ticket 38 from `docs/slices/38-dashboard.md` (**read revisions 2 and 3 — they are binding**): packet 38.1
   adds the remaining KPIs/derived numbers, **joins `dashboardComputers` into `COMPUTERS` and updates
   `analytics-engine.test.ts` in the same PR** (R11), then 38.2 (charts + data checklist, which now drills to tickets)
   and 38.3 (the Dashboard screen + the head's Today). Two points are **stop-and-ask**: the "311 days of records"
   divisor and the bubble chart's radius formula — do not guess.
3. 37c (the 1,354-row breakdown log) is the input 40 needs; a draft scope from another session (#292, old registers
   2022/24/25 with 4,767 entries) awaits Nimish's eight product decisions and a D21 data-consent check.
4. Open data question for Bhavin/Nimish: our seed files BOXY under Robot (CNC 125/158) while his platform counts it
   in CNC (126/159); the engine is exact against the key, the live dashboard shows the seed until the list is
   reconciled.

## Parallel rule

One orchestrator; children use fresh contexts and disjoint files; contract first, never two writers on one file.
