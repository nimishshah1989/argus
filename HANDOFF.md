# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-26 08:30 IST · **By:** release session (`local_7710e647-bb9d-4008-ab43-c6a316dec3ff`) · **Goal (Nimish):** all screens live on the newest kit · **Branch:** plan/handoff-s26b

## State

- Merge rule is ADR 0050: tests and build green + no critical fault → merge. `loop-guard` paperwork does not hold a merge. Nimish approved #753's screen list, #765's file deletion and the unbuilt rows in #768-#772 (follow-ups in #803).
- Staging serves 7539319a (#801 merged). 18 of 29 screens on the newest kit, 11 left. #801 had no second review: late critical-only review still open.
- `loop auto` was stopped 08:25; two app sessions replace it.

## Who owns what (never touch the other's tickets)

- RELEASE session (owns this file, all merges): #802 (#767 Floor report), #753 (5 screens), #769 (Desk open list), #765 (Annual).
- BUILD session (up to open PR with green tests, never merges): #772 → #789-#795 → #763 fixes 1, 2, 4 (3 is not a defect: ADR 0036 §3 English only) → #768 once #767 is merged → #770, #771 once #769 is merged.
- Neither switches branches in the main checkout; the build session commits nothing there.

## Follow-ups (plan job needed)

- #751 comment lists 4; S26-1 follow-ups issue. #799 old handoff: close it. ADR 0050 + this file need a PR to main.

## Don't repeat

- Never `loop clean` or remove a `.loop/wt/<N>` until its branch is pushed: only copy.
- Branch conflicts with main: merge main in a throwaway worktree OUTSIDE `.loop/wt`, hooks ON, push, close/reopen the PR.
- `loop finish` says "CI GREEN" even when the PR is CONFLICTING and no CI ran. Check `gh pr view --json mergeStateStatus`.
- `loop clean` deletes the remote `plan/t<N>` branch: re-push it before any further `loop prep`.
- Never merge with red api, browser or gallery shards.
