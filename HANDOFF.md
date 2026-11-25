# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-25 · **By:** Plan · **Model:** Opus 5.5
**Milestone:** M2b kit lane · **Branch:** plan/adr-0041

## State

- ADR 0041 (Nimish yes): kit tickets #687 #688 #689 #692 #695 #696 #700 #704 #705 #732 → ONE ticket, ONE PR. ADR written on this branch.
- Seed pushed: `origin/plan/kit-combined` @ `fffd3d58` (all 8 seeds merged + #689 moved into ui + #705/#732 skeleton and tests). Proven: typecheck 0, lint 0 errors, format clean; fast suite 66 failed (all new kit tests, assertions / `not implemented`), 3305 passed.
- Context ran out (150k) before the GitHub steps. Nothing below is done yet.

## Tests

- Seed `plan/kit-combined`: `pnpm exec vitest run packages/domain packages/shared apps/web/src tools` → 20 files / 66 tests red (only the new kit tests), 3305 passed. `pnpm typecheck` 0, `pnpm lint` 0 errors, `pnpm format:check` clean.

## Blocked

- Nothing blocked; the session stopped at the 150k context budget.

## Next (Plan, in order)

1. On this branch, apply ADR 0041 "Still to do": unprotect the 5 drawer files in `.loop.json` and update `_kit_carve_out`; add `"packages/shared/src/xlsx.ts"` to `KIT_ONLY` in `.github/loop/check_pr.py`; drop the first `expect` in "uses the words it is handed" in `apps/web/src/screens/v2/compare/holdout/tables-edges.test.ts`. Open the plan PR, wait with `loop ci`, merge.
2. Create the combined issue. Its body is the 10 issue bodies' Rules merged, with the Files list from `git diff --stat origin/main...origin/plan/kit-combined` plus the impl files; `Budget: files<=26 lines<=1070`; `Screens: none (kit only)`; and a `## Builder limits` section (Write/Edit only; one simple Bash command per call; no heredocs, `>`/`>>`, `( )`, `{a,b}` or `$?`; handoff has NO `## Blocked` heading unless genuinely blocked). No size:small label.
3. Push the seed as `plan/t<N>` (`git push origin origin/plan/kit-combined:refs/heads/plan/t<N>`), then merge main into it once step 1 has merged.
4. Close the 10 issues as "folded into #N (ADR 0041)"; close PR #726.

## Don't repeat

- The loop guard reads the **main checkout's** branch. Commit from a scratch worktree only while the main checkout is on a plan/ branch.
- #689: never edit `screens/v2/printed-page/` (another session owns it); `splitTotal` in the kit replaces it.
