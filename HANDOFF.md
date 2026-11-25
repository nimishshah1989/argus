# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-26 · **By:** Coordinator (Sonnet 5.5) · **Goal (Nimish):** all screens live on the newest kit · **Branch:** plan/handoff-s26b

## State

- MERGED: #783 sweep B (#751; reviewed PASS, CI green) and #782 Monthly Report (#763; merged by a parallel run/Nimish's account during a planner job — no reviewer pass in this session, UNVERIFIED; check its deploy and the deploy run on main).
- Earlier: #796 S26-1 Settings shell + Jobs, #797 main repair, #781 sweep A.
- Open: #799 (old handoff, superseded by this one — close it).
- Not started: #765 S24 Annual, sweeps #752/#753, S26 tickets #789–#795 (any order; seeds `plan/t789`..`t795`). S27–S30 builds #767/#769 may sit in other sessions' `.loop/wt/`.

## Follow-ups (plan job needed)

- #751 comment lists 4: Excel button empty workbook when figures cache empty (breakdown-log/Page.tsx:36); stale comment + unused `words.export` (View.tsx:158); figures 5+ render below tables via `after` slot (bd-pm, category-cell); export filename uses UTC date.
- S26-1 follow-ups issue.

## Don't repeat

- A builder that edits an existing test fails loop-guard. Fix = `loop plan` puts the corrected test on the seed `plan/t<N>`, then merge main + seed into the PR branch from a throwaway worktree OUTSIDE `.loop/wt` (builders and coordinator are hook-blocked from merging there), hooks ON, then close/reopen the PR so loop-guard rereads `Plan-base:`.
- `loop finish` says "CI GREEN" even when the PR is CONFLICTING and no CI ran. Check `gh pr view --json mergeStateStatus` before review.
- `loop plan` jobs that merge + run CI can exceed 10 min; run them in background with a long timeout and check `gh pr list` before rerunning.
- Never merge with red browser shards.
