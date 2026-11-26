# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-26 ~16:15 IST · **By:** coordinator session `c39914a2…` · **Goal (Nimish, ADR 0055):** all screens live on the newest kit, nothing old remains · **Branch:** plan/handoff-s28

## State

- Merged (by Nimish, before review finished): #840 (#814 OEM screen, after seed fix 81604632 on plan/t814) and #843 (#793 Settings lists/glossary/profile). Staging served e6732af at session start; confirm it now serves main.
- Post-merge reviews: #839 FAIL → follow-up ticket **#842** (seed plan/t842), builder was running at handoff. #840 PASS with follow-ups. #843 FAIL (profile "not set" only checks null, but the server never sends null → every plant shows "0 of 33 not set"; tiles show 0 while loading/on error; "All entries" lost its heading) → planner was writing a follow-up ticket at handoff (check `gh issue list` for "S26-6 lists and profile fixes").
- Planner job also running at handoff: #840 follow-ups (#815 Done-when gets read-only Cause column + empty key "No machine is under 300 days old"; analytics-engine.test.ts:607 owner range ≤812 → named exception; COVERAGE.md S18 row). Check plan/t815 and open plan/ PRs.
- `docs/loop/handoff/814.md` is stale (says tests red); ignore it. Old notes in docs/loop/handoff/ not folded this session.

## Next steps

1. `loop finish 842` → review → merge. 2. Build the S26-6 fixes ticket. 3. #815 (after its seed update), #794, then #819 last. 4. #803 (13 unbuilt wireframe items) and ADR 0055 items via `loop plan`.

## Blocked

None.

## Don't repeat (details in LESSONS.md)

- Nimish merges green PRs before review; both #839 and #843 then failed review. Run the reviewer the moment CI goes green.
- plan/handoff is checked out by another session's worktree and conflicts on metrics.jsonl; this session used plan/handoff-s28.
- Builders: plain literal commands only; `git rm`; one-line commits; `## Blocked` = exactly `None.`; prettier the handoff. Never `#NNN` in apps/web comments (hex guard).
- Seed fix on an open PR: planner pushes `plan/t<N>`; coordinator edits PR body `Plan-base:` first, then merges the seed into the PR branch in a scratch worktree and pushes.
- Tests for server-backed models must use a real server-shaped reply, not hand-made nulls (#843 lesson).
