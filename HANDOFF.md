# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-25 · **By:** Plan · **Model:** Opus 5.5
**Milestone:** M2b screens lane · **Branch:** plan/e2e-sweep-749 (stopped at context budget)

## State

- **#757** (size:small): PagedTable keeps its count line + pager while query/chip/select filters it (ADR 0036 R13). Seed `plan/t757` ebb4c0cf: visible `apps/web/src/ui/v2/paged-table.test.ts` (3 red), hidden `holdout/paged-table-edges.test.ts` (1 red). Proved satisfiable: the one-condition fix makes all 207 ui/v2 tests green. Callers: breakdown-log View (S06), action-center Nudges (S02).
- This branch fixes stale e2e (not run in a browser): forecast Lab method/months tables and manpower table assert row count (header + rows) instead of "1–N of N"; pm-calendar keyboard move searches only when a search box exists; shift-kpis expects 3 heat grids + the "By cell" ranked list (its stub is 18/33 dashes, R22) and clicks Cell 7 there to its drawer.
- Item 4 (machine spares "4.0 Loss"/"13.3 Loss") is NOT stale and NOT #749: #754 put ticket #643's expectation on main ahead of the product; #643 is OPEN and its build PR #707 is CLOSED. Red until #643 is rebuilt and merged. Spec left untouched.

## Tests

- `pnpm exec vitest run apps/web/src/ui/v2/` on plan/t757: 4 red (intended); with the fix applied: 207 passed.
- eslint + prettier on the 4 edited e2e specs: pass (1 max-lines warning). Browser suite not run locally.

## Next

1. Item 6, not done: desk / desk-lists phone flake = `POST /tickets 409 Already reported`: both specs (and closes, tasks, detail-downtime, coded-close) raise on `machineFor('desk', project)`, the same machine. Fix: a dedicated machine for desk-lists (pattern: `fixtures-pm.ts` per-spec machines). pm-plans "Start work" resolved to 2–3 buttons on `/desk/<id>` (list pane repeats buttons): scope `openPmClose` click with `ticketView(page)` from `fixtures.ts:390`.
2. Open the PR for this branch (if not open), `loop ci <pr>`; browser shards red for named reasons: analytics-compare (#755), machine-reliability (#643), analytics-breakdowns (#757).
3. `loop run-ticket 757`.

## Blocked

- machine-reliability e2e waits on #643 being rebuilt (#707 closed).

## Don't repeat

- shift-kpis spec is at 408 lines (max-lines warning, not error).
- Never merge red browser shards without Nimish's word for the named check.
