# Where things stand

Read first. Rewrite when the state changes. Under 50 lines.

## RESUME HERE (M4a analytics parity, 18 Nov 2026, night)

**State:** `main` = `dc4b539c`. **M2 is accepted.** M4a: 36, 38 done; **ticket 39 is three packets in** — figures #304,
screens #305, and the audited cell-move date correction #309 (API) are merged; the screen action (39d-1/39d-2) is the
remainder. **38.5 is merged (#308): the Dashboard draws its object figures** (bubble chart, expansion timeline,
breakdown-free, costliest problems, data checklist) and no tile prints "Ready" — the exact complaint Nimish raised.

**Unattended runs:** follow `docs/plan/night-run.md` — the loop, the evidence standard, the post-gate backend review,
and the night exception to gates (write and merge the gate report, continue; nothing irreversible unattended).

**Open, in order:**

1. **39d-1 / 39d-2 the cell-log correction screen** — plan `docs/slices/39-move-audit.md` (settled after two reviews):
   39d-1 the form mapping (api.ts + the pure mapper in machine-values.test.ts + i18n + `changes/39-move-correct-form.md`),
   39d-2 the action and journey (CellChangeLog.tsx + e2e + parity rows + `changes/39-move-correct-e2e.md`). **Carry the
   review's SHOULD FIX:** the bounds read takes no lock, so two simultaneous corrections of one machine can reorder its
   history — lock the moves read (`FOR UPDATE`) or the machine row, with a concurrency test, in 39d-1.
2. **37c the 2026 breakdown-log load** (1,343 rows through the past-breakdown path; source refs, `list_item` aliases,
   leaver erasure), then **40** Breakdown Log/A1/A2/A3 against `breakdown-log`, `a1-bd-pm`, `a2-category-cell`,
   `a3-mttr-mtbf`. Then 41–45 → **M4a gate** → M4b (46–54, 67) → M6 (55–60). **M3 is out.**

**Calls and gaps:** CSV, not XLSX, for the cell log (an XLSX writer needs an ADR); the analytics Gujarati copy is still
blank (`blank(analyticsEn)`, external N5); the platform's category/cell/location masters are constants until
`EngineData.lists` carries them; 38.5's four nice-to-haves (a checklist group list mirrored from the engine, a NaN guard
in the costliest cells, two wording nits) are recorded in the PR, not fixed.

**Routing:** the routes, the review tiers and the budgets are fixed in
`docs/decisions/D31-third-regime-routing-and-quality.md`; never switch one silently.
**Review lesson (17 Nov, recorded in the ledger):** reviewers must run the covering suite, not the named test — both 39
PRs passed a named-test-only review and were red in CI, and #304's strict reply contract slipped through.
**Open PR:** #300 (history plan, draft, Nimish's).

**Next session, first three steps:** 1. read this file, `docs/plan/ledger.md` (17–18 Nov lines) and `MILESTONES.md`. 2. Build 39d-1/39d-2 with the concurrency fix, review (covering suite + e2e), merge. 3. Plan 37c + 40 together.

One orchestrator; children use fresh contexts and disjoint files; contract first, never two writers on one file.
