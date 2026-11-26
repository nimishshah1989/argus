# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-26 ~13:00 IST · **By:** release session `8d81591a…` (context full) · **Goal (Nimish):** all screens live on the newest kit, nothing old remains · **Branch:** plan/handoff-s26b

## State

- Merged today by this session: #823 (ADR 0050), #825 (#770 Desk Mine+Team), #824 (#790 Settings PM plans/registers/roster/ladder), #822 (#795 Desk settings, main 86d3705e). Staging served 47dea7fe at session end; 86d3705e was deploying: confirm `/api/v1/health`.
- #826 (#789 Settings machines/groups/shifts) open, head 1d04cf45, now CONFLICTING with main after #822 (merge main in a throwaway worktree, push without force): one real red test, `settings-production-data.spec.ts:12` (switch "Not counted in production data: VC-7" missing after search). Planner job was running on it (log `…/8d81591a…/scratchpad/plan-789c.log`). loop-guard + loop-tests red are paperwork (seed files, `(#789` comment read as hex, handoff prettier).
- Board bug: /desk/board broken on a wide desktop window (side columns crushed, age numbers overlap). Planner was writing a new bug ticket + seed (log `…/scratchpad/plan-board.log`): check `gh issue list` for it, then build, merge.
- ADR numbering: seeds 789 and 790 both made an ADR 0053; #789's was renamed 0054 on its PR branch.
- Not started (no build session running; Nimish has not answered who builds): #791 #792 #793 #794 (one at a time, shared Plant.tsx/registry.ts), #812 #813 #814 #815 (OEM), #816 #817 #818, then #819 last.

## Open questions for Nimish (asked, not answered)

1. Floor: staging plant has 0 machine groups (192 machines, segments only), so "tap its group below" shows nothing. Show segments as tiles when no groups (recommended), or plant sets up groups?
2. Desk/Board/Ticket look "old": they match approved S28-S30 wireframes (own Desk menu, LOCK rule). Move them into the Analytics v2 Shell frame (new wireframes + approval) or keep?
3. Start the build session for the 11 unstarted tickets, or release session builds them?

## Next steps (RELEASE role)

1. Confirm staging serves main. Finish #826 (seed merge or builder per planner), CI, merge. Then the Board bug ticket.
2. Act on Nimish's answers above. `loop clean` after each merge.

## Don't repeat

- Rebuild of a PR whose build folder lags its remote: `loop prep <N> --fresh`, ticket "Don't" tells the builder to `git checkout origin/<PR branch> -- <files>` and `git rm` the v1 files (builders can't merge). Publish from a throwaway worktree: merge main, typecheck + unit tests (symlink node_modules from the main checkout), then `git merge -s ours origin/<PR branch>` and push without force (force-push is refused).
- `loop ci` prints GREEN with checks still pending: wait until `gh pr checks` shows no pending.
- zsh: `git show $b:apps/...` breaks (`:a` modifier); write `"${b}:apps/..."`.
- Deploy image build crashes at random (qemu exit 132): `gh run rerun <id> --failed`, sometimes twice.
