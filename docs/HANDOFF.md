# Where things stand — handoff for the next orchestrator session

Read this first, then `docs/plan/ledger.md` (17–18 Nov) and `docs/plan/MILESTONES.md`. Under 50 lines; rewrite at session end.

## START HERE (M4a analytics parity → M4b → M6)

**State:** `main` = `cbb9f906`. M2 accepted. M4a: **36, 38, 38.5, 39, 37 done**; **ticket 40 is one packet from done** — its
four figures are exact and merged (seam #316, log #317, A1 + S2 #318, A2 #319, A3 #320) and two of its four screens are live
(#322: the Breakdown Log and A1). Every merge had a fresh review with the covering suite, red first, green CI and
`pnpm main:check`. **Only open PR:** #300 (history plan, draft, Nimish's — leave it).

**First action — refresh Graphify** (the graph predates the last merges): in your session worktree,
`GRAPHIFY_BACKEND=none graphify update .` (if `graphify-out/` is missing: `graphify extract . --code-only &&
GRAPHIFY_BACKEND=none graphify cluster-only .`). Then query it before reading code:
`graphify query "<area>" --budget 2000`, `graphify explain "<symbol>"`, `graphify affected "<symbol>"`.

**Frontier, in order:**

1. **40e-2 the A2 and A3 screens** (last packet of ticket 40). Plan `docs/slices/40-breakdowns.md` packet 40e-2; reuse
   40e-1's key-shaped `page` content kind and `PageFigure`, extend `BreakdownsPage`/menu, the `analytics-breakdowns`
   catalogue, `page-content.test.ts` and the e2e journey, and flip the remaining breakdown parity rows honestly.
   **In flight:** branch `40e2-screens` (`86a607b1`, 12 uncommitted files, `A1Page.tsx` deletion unverified) — inspect
   `git -C .agents/worktrees/40e2-screens diff` first; if it builds and the covering suite is green, finish and review it,
   else reset the worktree to `main` and start fresh. Nothing of it is merged.
2. **41–45** → **M4a gate** (`docs/plan/gates/M4a.md`, under 30 lines) → **M4b** (46–54, 67) → **M6** (55–60). **M3 out.**
3. **Follow-ups:** move-correction row lock; 38.5/39d/40c/40d/40e-1 nice-to-haves (each in the ledger); N5, N12, CSV/XLSX.

**How this repo is worked (non-negotiable):** `docs/BUILD-PROTOCOL.md`, the routing and review tiers fixed in
`docs/decisions/D31-third-regime-routing-and-quality.md` (never switch a route silently), `docs/plan/night-run.md` (loop,
evidence standard, night exception at gates). One writer per file area; reviewers run the **covering suite**, never only the named test; one PR per ticket,
rebased, one CI run, merge one at a time, `pnpm main:check` after each; never weaken a test.
**PR-body guards:** `Large PR: <reason>` or the `size:large` label; `No parity: <reason>` (or update
`docs/spec/parity.yaml`); `Merge train:` when one PR adds several fragments; a fragment must be named
`changes/<digits>-<slug>.md` (the checker accepts an added **or modified** one).
**Known traps:** `check-size` counts the trailing newline (keep files ≤399 wc-lines); `migration-runner`, `escalation` and
`state-scale` tests flake under CI load (rerun; never change code for them); GitHub Actions stalled ~3 h on 18 Nov — a
red/pending run may be infrastructure, check before debugging code.

**Calls and gaps:** **N12 open** — the real legacy maintenance-code map is Bhavin's; 37c shipped a labelled synthetic map.
CSV not XLSX for the cell-log export (needs an ADR); the analytics Gujarati copy is blank (external N5); category/cell
masters are derived until `EngineData.lists` carries them.

One orchestrator; children use fresh contexts and disjoint files; contract first, never two writers on one file.
