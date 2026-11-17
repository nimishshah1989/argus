# Where things stand

Read first. Rewrite when the state changes. Under 50 lines.

## RESUME HERE (M4a analytics parity, 17 Nov 2026)

**State:** `main` = `7100f65`. **M2 is accepted (Nimish's go, 17 Nov).** **M4a is the current milestone**: ticket 37 is
mostly done (#289 engine machinery + snapshot + drill, #290 the analytics face, Guide and profile screen); what
remains of 37 is the **breakdown-log load (37c)**. The tracker, ledger and this file are the truth; M3/M5 are parked.

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
2. Write `docs/slices/38-dashboard.md` (16 dashboard figures + Today + data checklist, answer key first), get it
   reviewed, then dispatch one packet at a time; 40 follows the same shape with `a1–a3` + breakdown log.
3. 37c (the 1,354-row breakdown log as closed tickets through the past-breakdown path) is the input 40 needs — plan
   it beside 38 so 40 is not blocked.

## Parallel rule

One orchestrator; children use fresh contexts and disjoint files; contract first, never two writers on one file.
