# HANDOFF

> **24 Nov 23:00 — ADR 0037 (Nimish yes):** PR paperwork checks (parity, size, quality fields, changelog) warn instead of block.

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-25 · **By:** Plan · **Model:** Opus 5.5
**Milestone:** M2b screens lane · **Branch:** plan/t701

## State

- 25 Nov: seed `plan/t701` fixed (c8509f4c). PR #731's browser shards were red because the Gujarati specs could not switch Gujarati on. ADR 0038: `GUJARATI_ON` = `localStorage['uptimo.gujarati'] === 'on'`, read once at load; e2e option `gujaratiOn` (test.ts) sets it for the `gujarati` project, account language choice and translations spec; account.spec keeps a hidden-by-default check. New visible test `gujarati-switch.test.ts` (red on the seed). Proven locally with the one-line flag read on the build branch: vitest i18n 19/19, e2e account+translations+floor+i18n 57/57. Issue #701 has rule 0; #731 body `Screens:` → `S01-dashboard` (loop-guard rejected `none (kit only)`).
- ADR 0036 is the one v2 kit rulebook (R1–R25). Nimish: English only (Gujarati hidden, #701); two shift windows as configured, no shift calendar.
- Every kit ticket is seeded (`plan/t<N>`, red for the real reason, root `tsc --noEmit` 0 errors, critical tests only per ADR 0034): #684–#701. t686 got return types today (it did not typecheck).
- Bases: kit seeds on this branch (#683); #688/#689 on `plan/t687`; #695/#696 on `plan/t694`; #703 on main.
- Remaining 1–4 written: **#703** Shift KPIs one span (engine bug, seeded; answer-key fixture is 2026-only so no expected number moves) · **#704** verdict status chip + FigureTile status (size:small, seeded) · **#705** drawers ≤3 figures + full-page link (blocked by #666, not seeded) · **#706** sweep tracker (one ticket per screen, cut as each batch-2 ticket merges).

## Next step

#701: builder merges `origin/plan/t701`, changes the `GUJARATI_ON` line per rule 0, re-runs; `loop ci 731`; reviewer. Other `Screens: none (kit only)` tickets (#689, #693, …) will hit the same loop-guard error — use an approved screen id. Coordinator: merge #683 when green (kit seeds need its tokens/words/Status). Build in parallel: #684–#687 #690–#694 #697–#701 #703 #704. After #687: #688 #689. After #694: #695 #696. Plan: seed #705 after #666 merges; cut per-screen sweep tickets (#706) as batch-2 tickets merge.

## Blocked / open questions

- Robots are not a segment in the data (a CNC-segment `category === 'Robot'`); `segmentKey` never yields `robot`. Nimish to say whether category wins for colour (#706, #700).
- #705: which 3 figures per drawer — assumption: first 3 in each model's order.
- #696: `HeatCell` has no number; the ranked-list fallback parses `text` for totals (tests check rows, not order).
- Untested by design (reviewer checks): #701 AccountSheet hides the language choice (Radix portal); #688 Reset shows only when chosen; #690 the click that saves the file.
- Still open from before: S22 "vs the 320 days before" yes (#679); #651 yes/no.

## Don't repeat

- Flakes seen on #731, not Gujarati: pm-plans.spec:94 and who-is-acting.spec:60 (both passed on retry); who-is-acting.spec:219 also failed once, retry not confirmed.
- Seed worktrees with symlinked node_modules resolve `@uptimo/shared` to the main checkout: words only on a plan branch read as missing. Use `pnpm install --frozen-lockfile --offline` in the worktree.
- A throwing skeleton component needs an explicit `ReactElement` return type, or `createElement` in tests fails tsc.
- `git add` named files only; the main checkout is shared, commit from a temp worktree.
