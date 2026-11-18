# Where things stand

Read first. Rewrite when the state changes. Under 50 lines.

## RESUME HERE (M4a analytics parity, 18 Nov 2026, morning)

**State:** `main` = `86a607b1`. **M2 accepted.** M4a: 36, 38, 38.5, 39 done; **ticket 37 done**; **ticket 40 is one packet from
done**: the four figures are exact and merged (seam #316, log #317, A1 + S2 #318, A2 #319, A3 #320) and **two of the four
screens are merged (40e-1 #322: the Breakdown Log and A1)**. Every figure was whole-page-equal to its key with no tolerance,
red first, fresh-reviewed with the covering suite; `pnpm main:check` green after every merge.

**Open, in order:**

1. **40e-2 the A2 and A3 screens** (plan `docs/slices/40-breakdowns.md`, packet 40e-2): reuse 40e-1's key-shaped `page`
   content kind and `PageFigure`, extend the Breakdowns menu and the catalogue keys, extend the page-content tests and the
   e2e journey (a head sees A2's 16 tables/8 charts and A3's 6 tables/7 charts and drills; an operator is refused), and
   flip the remaining breakdown parity rows honestly. A partial attempt was reset during the CI outage — start fresh from
   `main`; the old branch `40e2-screens` and worktree are clean at `86a607b1`.
2. **41–45** → **M4a gate** (`docs/plan/gates/M4a.md`, under 30 lines) → **M4b** (46–54, 67) → **M6** (55–60). M3 out.
3. **Follow-ups recorded:** the move-correction row lock; 38.5's four nice-to-haves; 39d's saved-line reset; 40c's three;
   40d's three; 40e-1's three (a screen-side row cap if history grows, split `figure-content.ts` before adding more
   mappings, and the parity flip when 40e-2 closes).

**Calls and gaps:** **N12 open** — the real legacy-code map is Bhavin's; 37c shipped a synthetic map named as such. CSV not
XLSX for the cell-log export (ADR needed); the analytics Gujarati copy is blank (external N5); the category/cell masters are
derived until `EngineData.lists` carries them.

**Routing:** fixed in `docs/decisions/D31-third-regime-routing-and-quality.md`; never switch silently.
**Review lesson:** reviewers run the covering suite, not the named test — it caught the 39 gaps, 37c's timing case, 40's
plan contradictions and the file-size/CI traps.
**CI note (18 Nov, ~03:30–06:25 IST):** GitHub Actions stalled for nearly three hours (every job, including the 2-minute
static job, sat unstarted). The reviewed PRs merged once runners recovered; the known slow `migration-runner` test also
times out under load. Rerun failed jobs; never change code for these.
**Open PR:** #300 (history plan, draft, Nimish's).

**Next session, first three steps:** 1. read this file, `docs/plan/ledger.md` (17–18 Nov) and `MILESTONES.md`. 2. Build 40e-2 fresh from `main`; review, merge. 3. Write the M4a gate report and continue into 41 per the night exception.

One orchestrator; children use fresh contexts and disjoint files; contract first, never two writers on one file.
