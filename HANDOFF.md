# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-25 · **By:** Plan · **Model:** Opus 5.5
**Milestone:** M2b screens lane · **Branch:** plan/t701

## State

- 25 Nov, three seed fixes. **#685** (`plan/t685` 23ea52f4): visible tests add `statusOf({value:2.2,target:2,better:'lower'})` → `watch` (band edge, compare with a small tolerance) and the drill button's `aria-label` naming `kpi.unit`; issue rules 1, 3 and Done-when say so. **#700** (`plan/t700` 0bdce5f7): seed, test and issue were consistent; both builders were blocked by the loop guard on `entity-chip.tsx` because the guard reads `.loop.json` from the **main checkout**, which was on `plan/t701` (pre-ADR 0039, file still locked). Seed re-merged with main; issue notes it. **#701** (`plan/t701`): its ADR renumbered 0038 → **0041** (`0041-gujarati-switch-per-phone.md`; main took 0038–0040), references fixed, README lists it; merged with main.
- #701 seed (ADR 0041): `GUJARATI_ON` = `localStorage['uptimo.gujarati'] === 'on'`, read once at load; e2e option `gujaratiOn` (test.ts). Visible `gujarati-switch.test.ts` red on the seed. Issue #701 `Screens:` left as is: the ticket changes `apps/web/src/i18n/index.ts` and `apps/web/src/components/AccountSheet.tsx` (and its PR carries the seed's e2e specs), all outside ADR 0040's paths.
- ADR 0036 is the one v2 kit rulebook (R1–R25). Kit stylesheets seeded by Plan on nine seeds (tokens only). ADR 0039 opens 13 named kit files to builders until #684–#704 close.

## Next step

1. Keep the main checkout on `main` while builders run (the guard reads its `.loop.json`). Then `loop prep 700 --fresh` → `loop build 700` → `loop finish 700`.
2. #685: builder merges `origin/plan/t685` into its build branch (or `loop prep 685 --fresh`), re-runs.
3. #701: builder merges `origin/plan/t701`, changes the `GUJARATI_ON` line per rule 0; `loop ci 731`; reviewer.

## Blocked / open questions

- Robots are not a segment in the data (a CNC-segment `category === 'Robot'`); `segmentKey` never yields `robot`. Nimish to say whether category wins for colour (#706, #700).
- #705: which 3 figures per drawer — assumption: first 3 in each model's order. #704's body says `--color-v2-status-*`; those tokens do not exist, the CSS uses `--color-v2-good|watch|bad|neutral-*`.
- Still open: S22 "vs the 320 days before" yes (#679); #651 yes/no. ADR 0041 is an unattended assumption for Nimish to confirm.

## Don't repeat

- A plan session that leaves the main checkout on a seed branch changes what the guard protects for every build folder. Seed work goes in a temp worktree.
- Never `gh issue edit --body-file` from a read that may have failed: check the file is non-empty first.
- A throwing skeleton component needs an explicit `ReactElement` return type, or `createElement` in tests fails tsc.
