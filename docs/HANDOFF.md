# Where things stand

Read first. Rewrite when the state changes. Under 50 lines.

## RESUME HERE (M4a analytics parity, 18 Nov 2026)

**State:** `main` = `6c6d440f`. **M2 accepted.** M4a: 36, 38 done; **ticket 39 done** (#304, #305, #309, #311); **38.5 done**
(#308 — the Dashboard draws its object figures, no tile says "Ready"); **ticket 37 done** — 37a/37b earlier and **37c the
2026 breakdown-log load (#314)**: 1,283 non-live rows through the past-breakdown path, source references, the alias map
(N12 synthetic), once-only, visible on the desk list, erasable.

**Open, in order:**

1. **40 Breakdown analyses — in flight on branch `40-breakdowns`** (pushed). Plan `docs/slices/40-breakdowns.md` at
   `7dda6908` carries the two reviews' rulings (the log includes PM; the key's page shape; self-contained tables/charts
   counts; four MTBF bases; recorded hours; cellAt/cellFrac; en-IN grouping; S2 and its guard-test inversion; the Done By
   display seam). **40h (the shared seam) is building**; then 40a log → 40b A1 (+S2) → 40c A2 → 40d A3 → 40e-1/40e-2
   screens. Review each with the covering suite, merge one at a time.
2. **41–45** → **M4a gate** (`docs/plan/gates/M4a.md`, under 30 lines) → **M4b** (46–54, 67) → **M6** (55–60). M3 out.
3. **Follow-ups:** the move-correction row lock (concurrency test); 38.5's four nice-to-haves; 39d's saved-line reset;
   the 40 review's three should-fixes are already in the plan.

**Calls and gaps:** **N12 open** — the real legacy-code map (MEC→M, NI/INT/FS/PP/UTI→MIS) is Bhavin's; the load ships a
synthetic map named as such. CSV not XLSX for the cell-log export (ADR needed); the analytics Gujarati copy is blank
(external N5); the category/cell/location masters are constants until `EngineData.lists` carries them.

**Routing:** the routes, review tiers and budgets are fixed in
`docs/decisions/D31-third-regime-routing-and-quality.md`; never switch one silently.
**Review lesson:** reviewers run the covering suite, not the named test — it caught the 39 gaps, 37c's timing case and
40's plan contradictions.
**Open PR:** #300 (history plan, draft, Nimish's).

**Next session, first three steps:** 1. read this file, `docs/plan/ledger.md` (17–18 Nov) and `MILESTONES.md`. 2. Take 40h's evidence, review it, then 40a. 3. Continue 40b–e, then 41–45 and the gate.

One orchestrator; children use fresh contexts and disjoint files; contract first, never two writers on one file.
