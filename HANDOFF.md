# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-25 · **By:** Plan · **Model:** Opus 5.5
**Milestone:** M2b screens lane · **Branch:** plan/sweep-706

## State

- Money Matters #644, #678, #679 are ready to build: seeds `plan/t644|t678|t679` had main merged in (39 behind), typecheck clean, visible tests red only on "not built yet" / the missing route; pushed. Issue bodies carry the builder notes (dontAsk shell rules, no `## Blocked` unless blocked).
- Sweep #706: the page map and assumptions are decided in **ADR 0041** (this branch). The four batch tickets are **not cut yet**.
- PR #707 (#643 machine) fails only loop-guard: its build branch edits `analytics-machine-reliability.spec.ts`; `plan/t643` already has that edit. Coordinator: merge `plan/t643` into the build branch, repoint `Plan-base`.

## Next step (next Plan session)

1. On main via this kind of plan PR: add `insight.quad.often-long|often-short|rare-long|rare-short` to `packages/shared/src/i18n/insight.en.ts` (gu falls back) and the dashboard strip words in `analytics-v2-today.en.ts`.
2. Cut 4 issues (A–D) per ADR 0041, budget about files<=24 lines<=700 each, Blocked-by #707 on A. Seeds `plan/t<N>` light (ADR 0034): per page a `sweep.ts` pure helper where a figure is involved (Excel sheets, quadrant points/split, strip counts, reason parse) with red tests; e2e fixes per ADR 0041 last bullet. Every brief carries the builder notes in `/private/tmp/.../scratchpad/builder-notes.md` (copy from issue #679's tail).
3. Coverage rows per screen in `docs/design/v2/scope/<screen>.md` are the builder's job (ADR 0035).

## Don't repeat

- Never `gh issue edit --body-file` from a read that may have failed: check the file is non-empty first.
- printed-page/PageBody is shared by B, C, D: no batch may edit it.
