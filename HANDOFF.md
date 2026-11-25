# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-25 · **By:** Coordinator (sweep #706 + Money Matters) · **Model:** Opus 5.5
**Milestone:** M2b screens lane · **Branch:** plan/handoff-sweep-706

## State

- ADR 0041 (sweep #706 page map) merged in #742. Kit on main: #684 #686 #690 #691 #693 #694 #697 #698 #699.
- A second `loop plan` was started ~12:50 to cut batch tickets A–D + seeds + i18n words in one plan PR (and ADR 0042 addendum). It may still be running or may have opened its PR: check `gh pr list` before re-running.
- **Decisions (25 Nov):** (1) machine page OUT of batch A; A = dashboard, action-center, data-checklist, team-focus, machines-register, no Blocked-by #707. (2) **Nimish, own words: "No, keep bubble"**: the dashboard keeps its bubble chart (press a dot to open, zoom); batch A applies every other kit change. If A's ticket/seed still has the quadrant swap, Plan must remove it before building. (3) #694 ranked bars mapped in the same batches. Not yet an ADR: put (2) into ADR 0042 if Plan's PR lacks it.
- **#644 Money Matters step 1:** built (7 visible tests pass); `loop finish 644` failed only on prettier for `docs/loop/handoff/644.md`. **MERGED in #745** (88f0ce8d) after review fixes (source `{{date}}` braces, −0%). #678: code done but 3/3 attempts burned on text under `## Blocked`; Fable rescue running (empty Blocked, View uses `model.source`). Then `loop finish 678`, then #679.
- **#678 MERGED in #748** (3fb6447a, reviewer PASS, cleaned). Next: #679 (switch route to v2, delete v1 MoneyPage). Reviewer follow-up for Plan: View matches table takeaways by position (`TABLE_SECTIONS`); if the engine omits the levers table the lost table gets the wrong line — carry section id per table; add a `model.source` no-braces test.
- Batch planner exited; plan PRs #746 + #747 merged, but no batch A–D issues were visible at stop: check its HANDOFF on main for what was cut.
- Plan PR #747 (ADR 0043) records the quadrant swap as "gated on Nimish's yes"; he already said **no, keep bubble**. When batch A's ticket is cut, make sure it says keep bubble before `loop build`. Batch tickets A–D not cut yet at 13:50 (planner pid 16331 still running).
- #707/#643 (coordinator, ~13:55): e2e fix a6521bc is already in `origin/t643-ins-machine-page-spares-meanin`. Do: `loop prep 643 --fresh` (drops the stuck merge in .loop/wt/643), builder deletes only the duplicate `<p className="v2-sub">{model.spares.note}</p>` at machine/View.tsx:149, `loop finish 643`. One attempt; if anything else gets in the way, close #707 and fold the machine page into its sweep batch. Not started.
- Batch-ticket `loop plan` (pid 16331, started ~12:43) still running at 12:55; wait for it, don't start another.
- **#643 / PR #707 machine page: stopped (stop rule).** Fresh rebuild builder ended BLOCKED: it pulled the old build branch and hit a merge conflict in protected `analytics-machine-reliability.spec.ts`; `.loop/wt/643` is mid-merge. Previous finished code kept at branch `keep/t643-prev` (`27ecfd85`). Fix needs Plan: e.g. `loop prep 643 --fresh` and a brief that forbids `git pull` (prep's branch tracks origin).

## Next step

1. Check the batch-ticket plan PR; enforce "keep bubble" on A; merge when green.
2. `loop prep`/`loop build --bg` for A–D in parallel (load < 10), `loop finish`, reviewer, merge on PASS.
3. Finish #644, then #678 → #679 (v1 MoneyPage deleted in #679's PR).

## Don't repeat

- Builders must never `git pull`/merge: the hook allows no way back from a conflict in a protected test.
- Stop hook "HANDOFF older than last commit" fires when other sessions move local main; it is not this session's commit.
