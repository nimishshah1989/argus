# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-26 ~13:20 IST (after ADR 0055) · **By:** release session `8d81591a…` (context full) · **Goal (Nimish):** all screens live on the newest kit, nothing old remains · **Branch:** plan/handoff-s26b

## State

- Merged today by this session: #823 (ADR 0050), #825 (#770 Desk Mine+Team), #824 (#790 Settings PM plans/registers/roster/ladder), #822 (#795 Desk settings, main 86d3705e). Staging served 47dea7fe at session end; 86d3705e was deploying: confirm `/api/v1/health`.
- #826 (#789 Settings machines/groups/shifts) open, head 1d04cf45, now CONFLICTING with main after #822 (merge main in a throwaway worktree, push without force): one real red test, `settings-production-data.spec.ts:12` (switch "Not counted in production data: VC-7" missing after search). Planner job was running on it (log `…/8d81591a…/scratchpad/plan-789c.log`). loop-guard + loop-tests red are paperwork (seed files, `(#789` comment read as hex, handoff prettier).
- Board bug ticket #828 (seed plan/t828: kit `ui/v2/shell.css` + `shell.tsx` get a `.v2-frame` class; new `e2e/gallery/board-wide.spec.ts` at 1440/1920 px). Next: `loop prep 828`, `loop build 828` (Haiku, budget 1 file/60 lines), finish, CI, review, merge. Planner says 4 `board-settings-order` tests and one `v2-shell` rail-click test already fail locally on main: ticket them separately.
- ADR numbering: seeds 789 and 790 both made an ADR 0053; #789's was renamed 0054 on its PR branch.
- Not started, all seeded: #791 #792 #793 #794 (one at a time, shared Plant.tsx/registry.ts), #812 #813 #814 #815 (OEM), #816 #817 #818, then #819 last.

## Decided by Nimish, 26 Nov (ADR 0055; no question open)

1. Floor: a plant with no machine groups (staging: 0 groups, 192 machines) shows its segments as tiles on step 1.
2. Desk Open/Mine/Team, Board browser view and the ticket page move into the v2 `Shell` (Analytics frame); TV view and Floor keep their own. Needs new S28-S30 wireframes, then Nimish approves.
3. Build-only: the next session builds and merges, back to back, with no new planning except items 1 and 2. Merge on green tests plus a critical-only review (ADR 0050). He wants it live ASAP and is tired of process: report in plain words, briefly.

## Next steps (one session builds everything; two lanes in parallel)

1. #828 Board fix (Haiku), then #826 (merge main, it CONFLICTS; one red test, see the planner log). Confirm `/api/v1/health` serves each merge.
2. Lane A: #791, #792, #793, #794 in order. Lane B: #816, #817, #818, then #812, #813, #814, #815. Then #819.
3. `loop plan` for ADR 0055 items 1 and 2 (Floor segment tiles ticket; S28-S30 wireframes in the Shell for Nimish to approve), then build them.

## Don't repeat

- Rebuild of a PR whose build folder lags its remote: `loop prep <N> --fresh`, ticket "Don't" tells the builder to `git checkout origin/<PR branch> -- <files>` and `git rm` the v1 files (builders can't merge). Publish from a throwaway worktree: merge main, typecheck + unit tests (symlink node_modules from the main checkout), then `git merge -s ours origin/<PR branch>` and push without force (force-push is refused).
- `loop ci` prints GREEN with checks still pending: wait until `gh pr checks` shows no pending.
- zsh: `git show $b:apps/...` breaks (`:a` modifier); write `"${b}:apps/..."`.
- Deploy image build crashes at random (qemu exit 132): `gh run rerun <id> --failed`, sometimes twice.
