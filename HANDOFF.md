# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-25 ~16:30 · **By:** Coordinator (pages, side session) · **Model:** Sonnet 5.5
**Milestone:** M2b screens lane · **Branch:** plan/handoff-sweep-706c

## State

- **#679 Money Matters go-live: PR #755 open, CI red.** Local checks pass. Only the browser e2e shards fail; the one that touches this page is `analytics-compare.spec.ts:191` (line 154: `getByRole('region', { name: 'Where the money was lost' })` matches 2 elements, strict-mode violation). Plan decision: fix the selector in that seed test, or make the page expose one region. Other red specs (breakdowns, forecast-lab, manpower, shift-kpis, pm-calendar, machine-reliability, desk, pm-plans) are seed tests for batches A–D, red until those land. Merge also waits on Nimish's written yes for the unbuilt "+8% vs 320 days" row.
- **#750 A, #751 B, #752 C, #753 D: builds finished, code done, all ended BLOCKED** (stop rule: no more builder attempts). Cause: `docs/design/v2/scope/*.md` coverage rows are plan-owned (builder hook refuses). #750 needs 5 files, #751 6, #752 6 (verdict table is in `.loop/wt/752/docs/loop/handoff/752.md`), #753 scope docs. #751 also fails typecheck on `refused-login.test.ts` (a test the builder may not edit). No PRs opened (`loop finish` would fail on the Blocked text).
- **#643 / PR #707: closed.** `loop prep --fresh` dropped the earlier model work, so the one-line builder attempt was BLOCKED (4 insight tests need model.ts takeaways + tile yardsticks). Old code on branch `keep/t643-prev`. Plan PR #754 (e2e Loss pill) merged.
- Work in progress is in `.loop/wt/{679,750,751,752,753,643}`.

## Blocked

- #679 merge: compare e2e selector (Plan) and Nimish's yes on the yardstick row.
- #750–#753: Plan adds the scope coverage rows (and the `refused-login.test.ts` typecheck fix for #751), then one handoff-only re-finish per ticket. Needs a decision on whether that counts as a new attempt.
- Plan note: C (#752) turns problem-analysis scatter into a Quadrant per ADR 0041; Nimish's "keep bubble" was about the dashboard. Confirm before merging #752.

## Don't repeat

- `loop finish` burns an attempt every call, even when it only fails on handoff text. The handoff's Blocked section must read exactly "None." or loop treats it as a block.
- Never chain `loop wait N && loop finish N`. Builders never `git pull`/merge. The hook stops the coordinator editing build folders; use the rescuer subagent for tiny fixes.
