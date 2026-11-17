# Where things stand

Read first. Rewrite when the state changes. Under 50 lines.

## RESUME HERE (M4a analytics parity, 18 Nov 2026)

**State:** `main` = `84ae2428`. **M2 accepted.** M4a: 36, 38 done; **ticket 39 done** (#304, #305, #309, #311 — the
Machines face incl. the audited move-date correction); **38.5 done** (#308 — the Dashboard draws its object figures and
no tile says "Ready"). Unattended runs follow `docs/plan/night-run.md`.

**Open, in order:**

1. **37c the 2026 breakdown-log load — in flight on branch `37c-load`** (pushed, no PR). Plan
   `docs/slices/37c-breakdown-load.md` is revised after a fresh review: the 60 `bd_live_` rows are excluded (1,283
   loaded), refs are the collision-free `BD-9xxxx` band (the live counter will jump), shifts are the seeded two windows
   (1ST/2ND/3 folded, close placed inside the window so `validateLocal` accepts long downtimes), the desk observable is
   `GET /tickets?from&to` (not `/state`), and **N12** (the real code map) is recorded as a config swap, not a guess.
   The generator is on the branch (`1bf20a48`, the real reconcile passes all 1,283); the load test (37c-2) was in flight.
   Next: finish 37c-2 (seed the history people the harness lacks), fresh review, PR, CI, merge.
2. **40 Breakdown analyses — plan on branch `40-breakdowns`** (pushed, no PR): `docs/slices/40-breakdowns.md` holds the
   skeleton plus the fresh review's ten rulings — the log includes PM (1,343); its value is the key's page shape; a3 =
   6 tables + 7 charts; a2 = 16 tables; MTBF has four bases; recorded downHrs, effective-cell + cellFrac, Indian
   grouping and raw labels must be ported from discovery; ticket 38's S2 (align dashboard.total-breakdowns) is due; 40e
   splits into log+A1 screens and A2+A3 screens. Rewrite to those rulings, re-review, then dispatch 40a.
3. **41–45** → **M4a gate** (`docs/plan/gates/M4a.md`, under 30 lines) → **M4b** (46–54, 67) → **M6** (55–60). M3 out.
4. **Follow-ups:** the correction's row lock (concurrency test); 38.5's four nice-to-haves; 39d's saved-line reset.

**Calls and gaps:** CSV not XLSX for the cell-log export (ADR needed); the analytics Gujarati copy is blank (external N5);
the category/cell/location masters are constants until `EngineData.lists` carries them.

**Routing:** the routes, review tiers and budgets are fixed in
`docs/decisions/D31-third-regime-routing-and-quality.md`; never switch one silently.
**Review lesson:** reviewers run the covering suite, not the named test (twice it caught what a named-test review missed).
**Open PR:** #300 (history plan, draft, Nimish's).

**Next session, first three steps:** 1. read this file, `docs/plan/ledger.md` (17–18 Nov) and `MILESTONES.md`. 2. Finish 37c from branch `37c-load` and merge it. 3. Rewrite the 40 plan to the recorded rulings, re-review, dispatch 40a.

One orchestrator; children use fresh contexts and disjoint files; contract first, never two writers on one file.
