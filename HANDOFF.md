# HANDOFF

> **24 Nov 14:33 — kit carve-out applied (ADR 0028 addendum, Nimish yes):** 8 kit files open to builders until #620 merges; then restore `apps/web/src/ui/**` in `.loop.json`.
> **24 Nov 14:50 — ADR 0030 (Bhavin):** S-1/S-2 = Star-01/02; plain STAR, TC-2, VC-2, VC-3, VC-5 left out; unmapped codes load blank; spare-capacity exclusion (TC-3, TC-5, VC-6) deferred; ~10 impossible-year rows out.

> **Read ADR 0012 first.** Nimish is away; the loop runs unattended. Plan decides (ADR each) except answer-key changes, production, money, irreversible data steps.

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-24 · **By:** Plan (history load blocker) · **Model:** claude-opus-5-5
**Milestone:** M3 history lane · **Branch:** plan/t635 (seed), plan/handoff-t635 (this) · Job done.

## State

- **History lane — staging load blocker (24 Nov):** `pnpm import:bhavin legacy-<year>.json` on staging failed, 0 rows (unknown alias `Maint. Team`, `LG-` codes, work type `Utility failure`). Not a bug: the designed loader is `tools/load-legacy.ts` → `loadLegacyYears` (adds Plant/Utility failure + switched-off codes, a pending placeholder person per `LG-` code and `Maint. Team`, R8/R17/R20); same workbooks loaded 0 errors locally (`docs/plan/evidence/69c-real-load.md`). **#635** (size:small): import:bhavin refuses an `lg-<year>-` file and points to load-legacy; seed `plan/t635` @ 1785eb9e, 14 red, typecheck/lint green. Failed batch on staging wrote nothing; left as is. Open: #623 (seed ready), #624, #625; 621 merged (#627); **no ticket yet** for the server setting + `load-legacy --data-from` (ADR 0027 §4), then 69d.
- **ADR 0028** (this PR): 613–615 superseded; kit tickets 619 + 620; rule order target → change → concentration (additive only) → outlier; `.loop.json` carve-out of 8 kit files is PROPOSED, not applied (blocked by permissions; needs Nimish), **restore `apps/web/src/ui/**` when 620 merges**.
- **619** (INS-K1 rules + tile yardstick): seed `plan/t619` @ a77cd028 pushed — signatures in `screens/v2/insight.ts`, `Meaning` in `ui/v2/takeaway.tsx`, `yardstick?` on KpiData/FigureData, `.v2-yardstick` CSS, 7 new `insight.*` words, coverage test checks tile yardsticks. Visible `insight-rules.test.ts`, `ui/v2/yardstick.test.ts`; hidden `screens/v2/holdout/insight-rules-edges.test.ts`. 22 red, typecheck green. **Issue body not written yet** (placeholder).
- **620** (INS-K2 tables): issue is a placeholder; **no seed yet**. Design in ADR 0028 §2: `Column.meaning: Meaning & {value}`; pure helpers in `table-model.ts` (`worstFirst`, `worstRow`, `barOf` scale = max(largest, target), `foldAt` show misses clamped 3–5 or 5, no fold if ≤1 left, words "+ {n} more" / "+ {n} more, all within target"); DataTable/EngineTable/PrintedDataTable `takeaway` + `expand`; PagedTable takeaway, bars, expand only (server pages); `tableTakeaway`/`printedTakeaway` in insight.ts. Seed from `plan/t619`. Budget ~files<=9 lines<=420.
- **M3 G3.2 (Plan, ADR 0029, 24 Nov):** ticket 607's load script fails (p95 4449 ms; a read sends a 12.6 MB body). **Merge 607 as it is** (G3.2 unticked). **#628** (gzipped body built once per kept run, ETag/304, `node:http` readers): seed `plan/t628` @ b2207858, blocked by 607, 10 red + 4 regression guards. A spike proved p95 196 ms. Tick G3.2 only after 628 plus a full `pnpm load:figures` run ≤ 300 ms. Open risk: the 12.6 MB decoded reply on phones (ADR 0029).
- 613–615 **not closed yet**, worktrees not cleaned (coordinator).

## Next step

1. Coordinator: build #635 (`loop run-ticket 635`). 2. Plan: ticket the ADR 0027 §4 server setting + `load-legacy --data-from`. 3. No staging history load until 623, 624 and that ticket merge and Nimish says go (then 69d or `tools/load-legacy.ts --allow-remote`). 4. Screens lane: 619 issue body, 620 seed + body, S20–S26 issues (see ADR 0028).

## Blocked / open questions (Nimish)

- S20 availability target source; S22 has no previous-period figure (yardstick vs target only until engine has one); S26 new attention badges need server counts (build v1's jobs badge only); C shift in any answer-key row.

## Don't repeat

- Never load legacy years with `pnpm import:bhavin`; only `tools/load-legacy.ts` (with `--data-from` once built). Never loosen the alias rule in `imports/references.ts`.
- `apps/web/src/ui/**` is protected: kit work needs ADR 0028's carve-out. Seeds' stub files need the eslint unused-vars disable line. Never force-push. "ticket N" in comments.
