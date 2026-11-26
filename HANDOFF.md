# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-26 ~16:40 IST · **By:** coordinator session `c39914a2…` + planner (#846) · **Goal (Nimish, ADR 0055):** all screens live on the newest kit, nothing old remains · **Branch:** plan/handoff-t846

## State

- Merged (by Nimish, before review finished): #840 (#814 OEM screen), #843 (#793 Settings lists), #845 (#840 review follow-ups: owner-range test exception, COVERAGE S18 section).
- Post-merge reviews: #839 FAIL → ticket **#842** (seed plan/t842), builder was running at handoff. #840 PASS. #843 FAIL (profile "not set" checks only null, server never sends null → every plant "0 of 33 not set"; tiles show 0 while loading/on error; "All entries" lost heading) → ticket **#846** "S26-6 lists and profile fixes" seeded on `plan/t846` (9527f8a5, 16 red tests, typecheck green). ADR 0056 (on the seed): "not set" = value equals `DEFAULT_PROFILE`; there are 34 numbers, not 33.
- #815 ready: `plan/t815` head 858637e6 (Cause column for every reader, `v2m.oem.empty`, no "suggest" words).
- Nimish saw `/desk` still old: ADR 0055 point 2 (Desk Open/Mine/Team, Ticket, browser Board into the v2 Shell) never got its S28–S30 redraw. Planner job started for it at handoff; check for its plan/ PR, then send Nimish the screen ids to approve.
- **Nimish's written yes needed:** S18 shows no rupees (ADR 0051 A5 Assumed); row stays DROPPED in COVERAGE.md until he says yes.
- Planner follow-ups: #826 coverage dropped per-segment machine count and segment per machine row; OEM figure null when young machines have no breakdowns; 29 Feb warranty date prints wrong. `docs/loop/handoff/*.md` not folded (814.md is stale).

## Next steps

0. S28–S30 Shell wireframes → Nimish approves → tickets (part of the goal). 1. `loop finish 842` → review → merge. 2. `loop run-ticket 846`. 3. #815, #794, then #819 last. 4. #803 and Floor segment tiles via `loop plan`.

## Blocked

None.

## Don't repeat (details in LESSONS.md)

- Nimish merges green PRs before review; #839 and #843 then failed review. Run the reviewer the moment CI goes green.
- plan/handoff is checked out by another session's worktree; this session used plan/handoff-s28.
- Builders: plain literal commands only (no `{a,b}`, loops, heredocs, `python3 -`, `cd &&`, `VAR=` prefix); `git rm`; one-line commits; `## Blocked` = exactly `None.`; prettier the handoff. Never `#NNN` in apps/web comments (hex guard). New API route → `REPLY_SCHEMAS` + route count in `reply-contract.test.ts`.
- Seed fix on an open PR: planner pushes `plan/t<N>`; coordinator edits PR body `Plan-base:` first, then merges the seed into the PR branch in a scratch worktree and pushes.
- `loop finish` can print GREEN with checks pending: confirm with `gh pr checks`. Rebuild after a seed fix: `git branch -f backup-t<N>`, `loop prep <N> --fresh`.
- Model tests use real server-shaped replies, not hand-made nulls (#843).
- Sessions share `/Users/nimishshah/argus` and one stash list: plan in your own `git worktree add` from `origin/main`, never `git stash` there (the #846 planner's `metrics.jsonl` stash was taken by another session).
