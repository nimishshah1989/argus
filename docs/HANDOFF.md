# Where things stand

Read first. Rewrite when the state changes. Under 50 lines.

## RESUME HERE (M4a analytics parity, 18 Nov 2026)

**State:** `main` = `036f1487`. **M2 accepted.** M4a: 36, 38, 38.5, 39 done. **Ticket 37 done** (37a/37b/37c, log load #314).
**Ticket 40's four figures are done**: 40h the seam (#316), 40a the breakdown log (#317), 40b A1 + the S2 alignment (#318),
40c A2 (#319), and **40d A3 (MR #320) reviewed PASS, blocked only by the pre-existing slow `migration-runner` CI timeout**
(a rerun was in flight; merge when green, then `pnpm main:check`).

**Open, in order:**

1. **Merge #320 (A3)** if not already merged: review PASS, no must-fix. Then **40e-1 and 40e-2, the four Breakdowns screens**:
   the Breakdown Log (its platform columns, filters, the export) and A1; then A2 and A3 with the kit's charts — each with
   the two new object→content mappings in `figure-content.ts`, catalogue keys, and an e2e journey; parity rows updated.
   Plan: `docs/slices/40-breakdowns.md` (40e split rule: log+A1 / A2+A3).
2. **41–45** → **M4a gate** (`docs/plan/gates/M4a.md`, under 30 lines) → **M4b** (46–54, 67) → **M6** (55–60). M3 out.
3. **Follow-ups recorded:** the move-correction row lock; 38.5's four nice-to-haves; 39d's saved-line reset; 40c's three
   (No-category bucket ruling, chart-call dedup, shared drill-test helper); 40d's three (zero-count Total comment, soft size,
   the sanctioned two-file split).

**Calls and gaps:** **N12 open** — the real legacy-code map is Bhavin's; 37c shipped a synthetic map named as such. CSV not
XLSX for the cell-log export (ADR needed); the analytics Gujarati copy is blank (external N5); the category/cell masters are
derived until `EngineData.lists` carries them.

**Routing:** fixed in `docs/decisions/D31-third-regime-routing-and-quality.md`; never switch silently.
**Review lesson:** reviewers run the covering suite, not the named test — it caught the 39 gaps, 37c's timing case, 40's
plan contradictions and the file-size/CI traps.
**CI flakes (known, not ours):** `migration-runner`'s fault-injection test times out under load (failed twice, passed on
rerun); `escalation`/`state-scale` flaked once. Rerun failed jobs; do not change code for them.
**Open PR:** #300 (history plan, draft, Nimish's).

**Next session, first three steps:** 1. read this file, `docs/plan/ledger.md` (17–18 Nov) and `MILESTONES.md`; merge #320 if
open. 2. Build 40e-1 (log + A1 screens), then 40e-2 (A2 + A3). 3. Plan 41 with its fixtures after 40e merges.

One orchestrator; children use fresh contexts and disjoint files; contract first, never two writers on one file.
