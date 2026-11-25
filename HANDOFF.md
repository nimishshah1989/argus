# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-25 · **By:** Plan · **Model:** Opus 5.5
**Milestone:** M2 (last old-design screens) · **Branch:** plan/v2-last-screens (stopped at context budget)

## State

- Issues + seeds (pushed, red tests proven, lint/typecheck clean):
  - #760 S26-0 kit CRUD page + form sheet → `plan/t760` (Screens: none)
  - #761 S19 sign-in → `plan/t761`
  - #762 S25 Guide → `plan/t762`
- #763 S23 Monthly Report: issue written (full spec), **no seed branch yet**.
- Not done: S24 issue + seed; coverage tables `docs/design/v2/scope/{sign-in,guide,monthly-report,annual-report}.md`;
  the PR for this branch.

## Next

1. Plan: seed `plan/t763` (model.ts + adapter.ts skeleton, tests from `fixtures/answer-key/monthly-report.json`: busiest
   day 24 Oct 27.7 h; worst month Jun 26 660.4 h; VC-16 CVM1160 25.9 h; longest VC-22 16.0 h = 1.5× next; Person 11
   27.0%); add `monthly-report` to `insight-coverage.test.ts` SECTIONS/MODELS after the shift-kpis line.
2. Plan: S24 issue (depends on #763; deletes ReportsPage.tsx, report-view.ts and their tests ON THE SEED since build
   branches can't delete tests; put `annual-report` at the TOP of SECTIONS/MODELS to avoid a merge conflict with S23).
3. Plan: coverage tables (MISSING rows at top: report calendar/ranked bars/tails), then open this branch's PR.
4. Coordinator: #760, #761, #762 can build now (#760 first for S26-2…8; #761/#762 are independent).

## Blocked

- Nothing blocked. Open questions for Nimish are in the S23/S24 wireframes' "Questions" sections.
