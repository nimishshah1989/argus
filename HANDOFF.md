# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-25 · **By:** Coordinator (kit remaining) · **Model:** Opus 5.5
**Milestone:** M2b kit lane · **Branch:** kit/remaining-adr-0036

## State

- ONE PR for the remaining ADR 0036 kit tickets, each built from its own seed, merged into `kit/remaining-adr-0036`.
- In: #685 #687 #688 #692 #696 #700 #701 #704. Hidden compare test edit (#687, R13: no search under 10 rows) taken from plan PR #743.
- Seeds #695 #696 #701 #704 had main merged in (conflicts: old #694 skeleton of `ranked-bars.tsx` → main's; HANDOFF → main's; ADR index keeps both 0041 lines).
- Out: #695 (old `v2.test.ts` running-total test contradicts rule 1), #689 (bd-pm, manpower, mttr-mtbf screen tests assert the total as a body row), #705 and #732 (no seed branch).

## Tests

- Merged branch: fast suite 402 files / 3367 passed; `pnpm typecheck` 0; `pnpm lint` 0 errors (7 warnings); `pnpm format:check` clean.
- Full suite (Docker) and e2e: not run locally; CI runs them.

## Blocked

- #695, #689: need `loop plan` to change the contradicting tests. #705, #732: need seeds.

## Next step

1. CI green + reviewer PASS → merge.
2. Plan: fix #695/#689 tests, seed #705/#732. Two ADRs numbered 0041 (Gujarati switch, sweep #706 map): renumber one. Close or merge plan PR #743.
