# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-25 · **By:** Plan · **Model:** Opus 5.5
**Milestone:** M2b screens lane · **Branch:** plan/sweep-fixes

## State

- Scope coverage rows (one row per ADR 0036 kit rule) pushed on the seeds: `plan/t750` a8e08445 (5 pages), `plan/t751` 4363970b (6), `plan/t752` 08b4d16e (6, verdicts from the build handoff), `plan/t753` b43e5381 (6). Each "done" row checked against the build branch code.
- `refused-login.test.ts` passes the export props through a spread (`onExport` + `sheets: []`), like the seed's `view.test.ts`: on `plan/t751` and on this PR.
- `analytics-compare.spec.ts` Money Matters: the table is the region with no chart (the chart card shares "Where the money was lost"); charts counted by `[data-chart-state]` (v2 card has no `chart` test id). On `plan/t679` bc7453e1 and on this PR.
- This PR also carries `scope/why-why.md` (all rows not applicable), because #752 changes no why-why code, so loop-guard would refuse that file on the build branch.

## Tests

- e2e `analytics-compare.spec.ts` on PR #755's code + the fix: 2 passed (chromium, phone).
- #751 build + fix: `pnpm typecheck` 0; `refused-login.test.ts` 4/4. Main + fix: typecheck 0, 4/4.
- Expected red on main after this PR: the Money Matters e2e (v1 page) until #755 merges, like #754.

## Blocked

- #679 merge still needs Nimish's written yes on the unbuilt "+8% vs 320 days" row.
- #752 turns the problem-analysis scatter into a Quadrant (ADR 0041); Nimish's "keep the bubble" was about the dashboard. Confirm before merging #752.

## Next (coordinator)

1. Merge `origin/main` (after this PR) and the updated seed into each build branch: #679 ← `plan/t679`; #750–#753 ← `plan/t750..t753`. Then one handoff-only re-finish per ticket (Blocked must read exactly "None.").
2. Whether that re-finish counts as a new attempt is still the coordinator's call (unchanged).
