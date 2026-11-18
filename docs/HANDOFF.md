# Where things stand — handoff for the next orchestrator session

Read this first, then `docs/plan/ledger.md` (17–18 Nov), then `docs/plan/MILESTONES.md`. Under 50 lines; rewrite at session end.

## START HERE (M4a tail → M4a gate → M4b → M6)

**State:** `main` = `68701f2a`. M2 accepted. **M4a: 36, 37, 38, 38.5, 39, 40 all done.** Ticket 40's four figures are exact
against the platform key (seam #316, log #317, A1 + S2 #318, A2 #319, A3 #320) and **all four Breakdowns screens are live**
(#322 the log + A1, #325 A2 + A3). Every merge had a fresh review with the covering suite, red first, green CI and
`pnpm main:check`. **Only open PR:** #300 (history plan, draft, Nimish's — leave it).

**First action — refresh Graphify** (the graph was just regenerated on `68701f2a`; still refresh if you branch onward):
`GRAPHIFY_BACKEND=none graphify update .` in your session worktree (missing: `graphify extract . --code-only &&
GRAPHIFY_BACKEND=none graphify cluster-only .`), then `graphify query "<area>" --budget 2000` before reading code. Refresh
it after every merge.

**Frontier, in order:**

1. **41 Manpower, energy, root cause** (M4a): A4 manpower, A5 energy heatmap, A6 Why-Why, A10 problem analysis — exact against
   `a4-manpower`, `a5-energy`, `a6-why-why`, `a10-problems`; sortable tables; a Why-Why record saved in ticket 36's home and
   printable; person-level minutes with coded names only. Write its slice plan first (`docs/slices/41-*.md`) and get a fresh
   plan review.
2. **42 Forecast** (A9 bottleneck, planning forecast with the seeded Monte Carlo, Forecast Lab backtest; the machine page shows
   its band) — needs the deterministic seed scheme in `fixtures/answer-key/README.md`.
3. **43 Compare, Team Focus, Money, Fix Finder** (money heads/admin only; Team Focus status/owner/note persist).
4. **44 Action Center** (the 13 nudge rules exact on the fixture; a snooze persists across sessions).
5. **45 Reports, export, Guide** (monthly/annual reports + PDFs, the whole-workbook export under an ADR, every Guide entry
   opens its figure). Then **write `docs/plan/gates/M4a.md` (<30 lines)** and, per the night exception, continue into **M4b
   (46–54, 67)** and **M6 (55–60)**. **M3 is out.**

**How this repo is worked (non-negotiable):** `docs/BUILD-PROTOCOL.md`; routing and review tiers in
`docs/decisions/D31-third-regime-routing-and-quality.md` (never switch a route silently); `docs/plan/night-run.md` (loop,
evidence standard, night exception at gates). One writer per file area; **reviewers run the covering suite, never only the
named test**; one PR per ticket, rebased, one CI run, merge one at a time, `pnpm main:check` after each; never weaken a test.
**PR guards:** `Large PR: <reason>` or `size:large`; `No parity: <reason>` or update `docs/spec/parity.yaml`; `Merge train:`
for multi-fragment PRs; fragments named `changes/<digits>-<slug>.md`.
**Known traps:** `check-size` counts the trailing newline (keep files ≤399 wc-lines); `migration-runner`, `escalation` and
`state-scale` flake under CI load (rerun; never change code); GitHub Actions stalled ~3 h on 18 Nov (a pending/red run may be
infrastructure — check job timings before debugging).

**Calls and gaps:** **N12 open** — the real legacy maintenance-code map is Bhavin's (37c ships a labelled synthetic map). CSV
not XLSX for the cell-log export (ADR needed); the analytics Gujarati copy is blank (external N5); category/cell masters are
derived until `EngineData.lists` carries them. Recorded follow-ups: move-correction row lock; 38.5/39d/40c/40d/40e-1/40e-2
nice-to-haves (each in the ledger).

One orchestrator; children use fresh contexts and disjoint files; contract first, never two writers on one file.
