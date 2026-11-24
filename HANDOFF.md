# HANDOFF

> **24 Nov 23:00 — ADR 0037 (Nimish yes):** PR paperwork checks (parity, size, quality fields, changelog) warn instead of block.

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-24 · **By:** Plan · **Model:** Opus 5.5
**Milestone:** M2b screens lane · **Branch:** plan/adr-0036-colour-shifts-language

## State

- ADR 0036 is the one v2 kit rulebook (R1–R25). Nimish: English only (Gujarati hidden, #701); two shift windows as configured, no shift calendar.
- Every kit ticket is seeded (`plan/t<N>`, red for the real reason, root `tsc --noEmit` 0 errors, critical tests only per ADR 0034): #684–#701. t686 got return types today (it did not typecheck).
- Bases: kit seeds on this branch (#683); #688/#689 on `plan/t687`; #695/#696 on `plan/t694`; #703 on main.
- Remaining 1–4 written: **#703** Shift KPIs one span (engine bug, seeded; answer-key fixture is 2026-only so no expected number moves) · **#704** verdict status chip + FigureTile status (size:small, seeded) · **#705** drawers ≤3 figures + full-page link (blocked by #666, not seeded) · **#706** sweep tracker (one ticket per screen, cut as each batch-2 ticket merges).

## Next step

Coordinator: merge #683 when green (kit seeds need its tokens/words/Status). Build in parallel: #684–#687 #690–#694 #697–#701 #703 #704. After #687: #688 #689. After #694: #695 #696. Plan: seed #705 after #666 merges; cut per-screen sweep tickets (#706) as batch-2 tickets merge.

## Blocked / open questions

- Robots are not a segment in the data (a CNC-segment `category === 'Robot'`); `segmentKey` never yields `robot`. Nimish to say whether category wins for colour (#706, #700).
- #705: which 3 figures per drawer — assumption: first 3 in each model's order.
- #696: `HeatCell` has no number; the ranked-list fallback parses `text` for totals (tests check rows, not order).
- Untested by design (reviewer checks): #701 AccountSheet hides the language choice (Radix portal); #688 Reset shows only when chosen; #690 the click that saves the file.
- Still open from before: S22 "vs the 320 days before" yes (#679); #651 yes/no.

## Don't repeat

- Seed worktrees with symlinked node_modules resolve `@uptimo/shared` to the main checkout: words only on a plan branch read as missing. Use `pnpm install --frozen-lockfile --offline` in the worktree.
- A throwing skeleton component needs an explicit `ReactElement` return type, or `createElement` in tests fails tsc.
- `git add` named files only; the main checkout is shared, commit from a temp worktree.
