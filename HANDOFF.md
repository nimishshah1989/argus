# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-25 · **By:** Plan · **Model:** Opus 5.5
**Milestone:** M2b kit lane · **Branch:** plan/adr-0041

## State

- ADR 0042 (was 0041; renumbered, the Gujarati switch ADR keeps 0041): kit tickets #685 #687 #688 #689 #692 #695 #696 #700 #701 #704 #705 #732 → ONE ticket, ONE PR.
- This plan PR: 5 drawer files unprotected (`.loop.json`), `KIT_ONLY` in `check_pr.py` widened to `packages/shared/src/xlsx.ts`, `apps/web/src/i18n/`, `components/AccountSheet.tsx`, `apps/web/e2e/`, `playwright.config.ts`; compare holdout "uses the words it is handed" drops its count assertion; ADR 0041 (Gujarati) lands on main.
- Seed `origin/plan/kit-combined` @ `39ec90d5`: previous seed + `plan/t685` + `plan/t701` merged (HANDOFF.md kept as main's). Budget `files<=31 lines<=1270`.

## Tests

- Seed: `pnpm typecheck` 0, `pnpm lint` 0 errors, `pnpm format:check` clean; fast suite 25 files / 79 tests red, all new seed tests (none exist on main), 3308 passed.
- Plan branch: `tables-edges.test.ts` 5/5 pass.

## Blocked

- Nothing blocked.

## Next (Plan, in order)

1. Merge this plan PR when green.
2. Combined issue (Rules of the 12 issues, Files, `Budget: files<=31 lines<=1270`, `Screens: none (kit only)`, `## Builder limits`).
3. Push seed as `plan/t<N>`, merge main into it.
4. Close the 12 folded issues; close PRs #726 #731 #739.

## Don't repeat

- The loop guard reads the **main checkout's** branch. Commit from a scratch worktree only while the main checkout is on a plan/ branch.
- #689: never edit `screens/v2/printed-page/`; `splitTotal` in the kit replaces it.
- Another plan branch carries `docs/adr/0041-sweep-706-batch-map.md` — a third 0041; it needs renumbering before it merges.
