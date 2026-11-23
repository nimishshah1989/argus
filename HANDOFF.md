# HANDOFF

> **Read ADR 0012 first.** Nimish is away; the loop runs unattended. Everything moves to v2, v1 is deleted, the 97 MISSING coverage items get built. Plan decides §6 (ADR each) except answer-key changes, production, money, irreversible data steps.

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-23 · **By:** Plan · **Model:** claude-opus-5-5
**Milestone:** M1 Stabilise (building) · **Branch:** plan/handoff-551-in-ci · **PR:** #562

## State

- **#561 = ticket #551** (case clash): reviewer PASS; CI **browser (3/5) FAILED** (run 45213725452); read `--log-failed`.
  Merge when green (`gh pr merge 561 --squash --delete-branch`, `loop clean 551`). Every local `loop finish` fails on
  the 10 macOS case-clash tests until it merges.
- #552 built once by Haiku (`.loop/wt/552`); `loop finish` failed only on those case-clash tests (attempt 1 of 3 burnt).
  After #561 merges: merge main into `plan/t552` and the build folder, then `loop finish 552`.
- #556 (G1.5): main merged in, fragment `changes/556-*.md`, full Argus body with "No parity:"; CI was running.
- #558 now a ticket (size:small, ADR 0014: Team Focus `mixed`). Seed `plan/t558` = #557's G1.6 tests + main + visible
  domain test (fails today with "Figure team-focus has a value but names no rows"). #557 closed into it.
- Not built: #553 G1.2b, #554 Dashboard, #555 Problem Analysis, #558. Docker works on this Mac now.

## Next step

1. #561: read the browser 3/5 failure (flake → rerun; real → Don't + rebuild). #556 merge when green. 2. #552 finish (above). 3. #558, #553 build. 4. #554/#555: on `plan/t<N>` (after main
   is merged in, since #561 also edits `scope/dashboard.md`) add the dated "Coverage re-checked for ticket #N" line to
   `docs/design/v2/scope/<screen>.md`; then prep/build/finish; `gh pr edit` with Argus body + `## Coverage` table.

## Blocked / open questions

- **G1.2a needs Nimish:** duplicate ticket column is pinned by the frozen answer key (`workbook-export.json`, 30 cols).
- **G1.4 Shift KPIs + Energy:** no gallery view and not on the shared fixture seam (`screens/v2/data.ts`), so no
  wireframe snapshot is possible yet. Needs a ticket: gallery views + fixtures; then snapshot; then Nimish approves.
- Nimish (old): branch protection; answer-key last digit; support tickets 0 downtime.

## Don't repeat

- Hidden tests go in a `holdout/` folder under `tools/`, `apps/web/src/` or `apps/server/test/`; `tests/holdout/` never runs.
- Bash with `>` redirects or a long inline `gh pr create --body` is denied; use Write + `--body-file`.
- Plan PR bodies need "No parity: <reason>" under `## Reasons` or pr-meta fails.
