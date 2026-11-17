# Where things stand

Read first. Rewrite when the state changes. Under 50 lines.

## RESUME HERE (M4a analytics parity, 18 Nov 2026)

**State:** `main` = `60742480`. **M2 is accepted.** M4a: 36, 38 done; **ticket 39 is DONE** — figures #304, screens #305,
the audited correction API #309 and its screen action #311. **38.5 is done (#308): the Dashboard draws its object figures
(bubble chart, expansion timeline, breakdown-free, costliest problems, data checklist) and no tile says "Ready"** — the
complaint Nimish raised from the running app.

**Unattended runs:** follow `docs/plan/night-run.md` — the loop, the evidence standard, the post-gate backend review, and
the night exception to gates (write and merge the gate report, continue; nothing irreversible unattended).

**Open, in order:**

1. **37c the 2026 breakdown-log load** — 1,343 rows through the past-breakdown path (source refs, `list_item` aliases,
   leaver erasure), its own packet after 39. Then **40** Breakdown Log / A1 / A2 / A3 against `breakdown-log`,
   `a1-bd-pm`, `a2-category-cell`, `a3-mttr-mtbf` (plan them together: the log is 40's input).
2. **41–45** → **M4a gate** (`docs/plan/gates/M4a.md`, under 30 lines) → **M4b** (46–54, 67) → **M6** (55–60). M3 out.
3. **Follow-ups from 39's reviews, in the 37c window or their own small PR:** the correction's bounds read takes no row
   lock (two simultaneous corrections of one machine can race — lock the machine row and add a concurrency test); 38.5's
   four nice-to-haves (a checklist group list mirrored from the engine, a NaN guard, two wording nits); 39d's saved-line
   never resets on a later failure.

**Calls and gaps:** CSV, not XLSX, for the cell-log export (an XLSX writer needs an ADR); the analytics Gujarati copy is
still blank (`blank(analyticsEn)`, external N5); the platform's category/cell/location masters are constants until
`EngineData.lists` carries them.

**Routing:** the routes, the review tiers and the budgets are fixed in
`docs/decisions/D31-third-regime-routing-and-quality.md`; never switch one silently.
**Review lesson (17 Nov, in the ledger):** reviewers run the covering suite, not the named test — both 39 PRs passed a
named-test-only review and were red in CI. CI also flaked once on `escalation.test.ts` and `state-scale.test.ts` (a
timing test) with no code cause; a rerun is the answer, not a code change.
**Open PR:** #300 (history plan, draft, Nimish's).

**Next session, first three steps:** 1. read this file, `docs/plan/ledger.md` (17–18 Nov lines) and `MILESTONES.md`. 2. Plan 37c + 40 together (the Guide's A1–A3 and the 1,343-row log) with a fresh plan review. 3. Build 37c, then 40.

One orchestrator; children use fresh contexts and disjoint files; contract first, never two writers on one file.
