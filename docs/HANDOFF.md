# Where things stand

Read first. Rewrite when the state changes. Under 50 lines.

## RESUME HERE (M4a analytics parity, 18 Nov 2026, night)

**State:** `main` = `7395ac17`. **M2 is accepted.** M4a: 36, 38 done; **ticket 39's figures and screens are merged**
(#304 engine: registers with both key tables, footprint with all five, age, machine page, cell log — exact against the
11 Nov key; #305 screens: register pages, cell log + controlled-document CSV, one page per machine). Both PRs were held
for real defects found in review and CI: an empty plant threw the engine, the key comparison was a slice, the screen read
`topProblem` as a string, the catalogue hit its 250-line guard, and the strict drill reply did not grow with the loader.

**Unattended runs:** follow `docs/plan/night-run.md` — the loop, the evidence standard, the post-gate backend review,
and the night exception to gates (write and merge the gate report, continue; nothing irreversible unattended).

**Open, in order:**
1. **38.5 the Dashboard's object figures** (Nimish's report: tiles printed "Ready" and drew nothing). Plan
   `docs/slices/38-charts.md` (four packets); branch `38-charts`: A1 kit `8e8c4a9e` (scatter + mixed, `chartOption`
   exported and node-tested) and B1 mapper `d45d3a3d` are built. **Rebase first**: 39b split `analytics.en.ts` into
   `analytics-machines.*`, so B1's +30 keys conflict. Then B2 (FigureTile/Dashboard/DataChecklist render + spans), B3
   (e2e inversions, parity evidence, fragment), fresh review, CI, merge.
2. **39c/39d the audited move-date correction** — ticket 39 goal 1's third clause is not in the code yet. Plan
   `docs/slices/39-move-audit.md` on branch `39-move-audit` (re-reviewed: bounds = not future, not reordering; audit
   entity `machine` with the machine id; one fragment per packet; parity via 39d).
3. **37c the 2026 breakdown-log load** (1,343 rows through the past-breakdown path; source refs, `list_item` aliases,
   leaver erasure), then **40** Breakdown Log/A1/A2/A3 against `breakdown-log`, `a1-bd-pm`, `a2-category-cell`,
   `a3-mttr-mtbf`. Then 41–45 → **M4a gate** → M4b (46–54, 67) → M6 (55–60). **M3 is out.**

**Calls and gaps:** CSV, not XLSX, for the cell log (an XLSX writer needs an ADR); the analytics Gujarati copy is still
blank (`blank(analyticsEn)`, external N5); the platform's category/cell/location masters are constants until
`EngineData.lists` carries them (recorded from the 39a review); the "Ready" tile is fixed by 38.5, no screen may print it.

**Routing:** per `docs/decisions/D31`. Coder `isoquant/deepseek-v4.1-flash-1017-fast`; plan/reviews
`isoquant/glm-5.3-flash`. **Review lesson (17 Nov):** a reviewer that runs only the named test passed a branch that was
red in the covering suite and in CI — the review prompt now names the covering suite.
**Open PR:** #300 (history plan, draft, Nimish's).

**Next session, first three steps:** 1. read this file, `docs/plan/ledger.md` (17 Nov lines) and `MILESTONES.md`;
rebase the `38-charts` branch. 2. Finish 38.5's B2/B3, review, merge. 3. Build 39c/39d, then plan 37c + 40 together.

One orchestrator; children use fresh contexts and disjoint files; contract first, never two writers on one file.
