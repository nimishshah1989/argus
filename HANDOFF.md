# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-27 · **By:** session `c39914a2…` · **Mode (ADR 0057):** organic session, parallel agents · **Branch:** plan/handoff-s34 · Nimish: remaining small work moves to next week.

## State (merged to main)

- Nothing old remains (guard `tools/old-ui-left.test.ts`); kit catalogue `docs/design/v2/KIT.md`. Cards click through (ADR 0060). Tables colour themselves, "On this page" (ADR 0061). Multi-year + year picker (ADR 0063). Real names (ADR 0059). TV board fits ("+N more").
- #873 durations "40 min", BD-PM month grids coloured. #874 A1 counts live breakdowns, report charts all years (ADR 0064). #875 chart heights, full-width lone cards, long table text behind "Details" (ADR 0065).
- Staging data: 2026 log loaded 26 Nov (snapshot `uptimo-pre-history-20261126155839`); 2022–2025 was loaded by hand 24 Nov (snapshot `uptimo-before-history-load-202611241554`). Do not run `history-load.yml -f legacy=true`.

## Red on main (merged past on Nimish's say-so)

- `v2-fix-finder.spec.ts` looks for "Down (hrs)"; header is "Down" (stale test).
- `v2-problem-analysis.spec.ts:66`: a pasted section link lands 347 px down, expected under 200 (likely real, from #875).
- #875 `api (1/5)`: `sla-timers.test.ts` concurrent-raise failed once; #875 touched no server code; not rerun. `browser (2/5)`: install failure, tests never ran.

## Next week

- Only A1 counts live breakdowns; A2, A3, A10, Dashboard and ~10 others ignore them (list in ADR 0064). Highest priority.
- Parked, unchecked, no PR: `v2/free-text-names` (names instead of `[P1]`), `v2/split-big-files` (`pnpm size`; shell.tsx still over).
- Why-why answers reach the engine with names unredacted; check whether any reaches AI.
- Floor segment tiles (ADR 0055 point 1). Click-through of staging (Nimish signs in).
- Duplicate breakdowns on staging (BD-0041/0042 vs BD-91286/91284): Nimish's call. "How each method did" may scroll inside its card; new Gujarati "Details" strings need a native check.

## Don't repeat

- "What's left" comes from the guards, never memory. Protected files only on plan/ branches; a PR's `Screens:` line holds approval ids or `none`. Reserve ADR numbers (next 0066).
