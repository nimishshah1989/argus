# HANDOFF

> **Read ADR 0012 first.** Nimish is away; the loop runs unattended. Plan decides (ADR each) except answer-key changes, production, money, irreversible data steps.

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-24 · **By:** Plan (screens lane, ADR 0026 §3–4) · **Model:** claude-opus-5-5
**Milestone:** M2b by kit rules · **Branch:** plan/screens-lane-kit · Stopped at the 150k context budget, job half done.

## State

- **ADR 0028** (this PR): 613–615 superseded; kit tickets 619 + 620; rule order target → change → concentration (additive only) → outlier; `.loop.json` carve-out of 8 kit files is PROPOSED, not applied (blocked by permissions; needs Nimish), **restore `apps/web/src/ui/**` when 620 merges**.
- **619** (INS-K1 rules + tile yardstick): seed `plan/t619` @ a77cd028 pushed — signatures in `screens/v2/insight.ts`, `Meaning` in `ui/v2/takeaway.tsx`, `yardstick?` on KpiData/FigureData, `.v2-yardstick` CSS, 7 new `insight.*` words, coverage test checks tile yardsticks. Visible `insight-rules.test.ts`, `ui/v2/yardstick.test.ts`; hidden `screens/v2/holdout/insight-rules-edges.test.ts`. 22 red, typecheck green. **Issue body not written yet** (placeholder).
- **620** (INS-K2 tables): issue is a placeholder; **no seed yet**. Design in ADR 0028 §2: `Column.meaning: Meaning & {value}`; pure helpers in `table-model.ts` (`worstFirst`, `worstRow`, `barOf` scale = max(largest, target), `foldAt` show misses clamped 3–5 or 5, no fold if ≤1 left, words "+ {n} more" / "+ {n} more, all within target"); DataTable/EngineTable/PrintedDataTable `takeaway` + `expand`; PagedTable takeaway, bars, expand only (server pages); `tableTakeaway`/`printedTakeaway` in insight.ts. Seed from `plan/t619`. Budget ~files<=9 lines<=420.
- **History lane (Plan, ADR 0027 + 69 slice amendment of 24 Nov, PR #626):** all 20 workbooks are on Nimish's Mac at `/Users/nimishshah/argus-data/history/{2022,2023,2024,2025}/*.xlsx` (never into git; `--data` that folder). Label `lane:history`: **#623** review tray + later-dated rows held — seed `plan/t623` pushed, ready; **#624** two-shift fold (seed after 623; it rewrites the two old shift-fold tests); **#625** Jul-23 grid cross-check (seed after 623). ADR 0027's **621** has no seed yet (`plan/t621` empty) → then server setting + `load-legacy --data-from` → 69d. #300 still open: close unmerged per ADR 0027 §1 (my close was blocked). Nothing on staging yet.
- 613–615 **not closed yet**, worktrees not cleaned (coordinator).

## Next step

1. Merge this PR when green (`loop ci <pr>`). 2. Plan: write 619's issue body (sections per loop-ticket; Budget files<=5 lines<=260; files insight.ts, kpi-card.tsx, figure-tile.tsx, changes, handoff), seed + body for 620. 3. Plan: issues for S20 Shift KPIs + S21 Energy (redesign of live v2, drop C shift), S22 Money, S23 Monthly, S24 Annual (ReportsPage deleted in the later of the two), S25 Guide, S26 Settings split in 3 (v1 Plant.tsx/Settings.tsx deleted in the last) — all Blocked-by 620, scope/<screen>.md per screen; then ~7 declaration issues grouped by kit table (EngineTable screens, PrintedTable screens, DataTable screens, Dashboard reusing plan/t613 test-model, Action Center, Breakdown Log, tile/chart screens).

## Blocked / open questions (Nimish)

- S20 availability target source; S22 has no previous-period figure (yardstick vs target only until engine has one); S26 new attention badges need server counts (build v1's jobs badge only); C shift in any answer-key row.

## Don't repeat

- `apps/web/src/ui/**` is protected: kit work needs ADR 0028's carve-out. Seeds' stub files need the eslint unused-vars disable line. Never force-push. "ticket N" in comments.
