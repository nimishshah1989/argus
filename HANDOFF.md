# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-26 08:20 IST · **By:** session with Nimish · **Goal (Nimish):** all screens live on the newest kit · **Branch:** plan/handoff-s26b

## State

- Staging serves 97a00964. 15 of 29 screens on the newest kit, 14 left. Nimish approved restarting the run on 2026-11-26.
- Deploy of the notes-only commit ded7d084 failed (docker build exit 132, cause not checked): confirm the next merge deploys.

## ORDER (only these can merge without Nimish; take them in this order)

- Lane A: #767 (built in `.loop/wt/767`, unpushed: `loop finish 767`, review, merge). Lane B: Settings #789-#795 (seeds `plan/t789`..`t795`). Run both lanes only where the two tickets' file lists share no file.
- Then #763 Monthly: fix review findings 1, 2 and 4 in the issue body. Finding 3 (Gujarati blank) is NOT a defect: ADR 0036 §3, English only.
- Build, open PR and review, but DO NOT MERGE (decision C): #772 (finish list in its `docs/loop/handoff/772.md`), #769 (built: `loop finish 769`).

## WAITING ON NIMISH (do not merge, do not work around; end `LOOP: NEEDS NIMISH` only when nothing above is left)

- A. Approval check on PR #801 (#752, green otherwise, still needs a second review) and #753 (built, unpushed): short screen names, plus no wireframe for cell-change-log, bottleneck, forecast-lab. Do NOT edit any `Screens:` line. Spend nothing on these.
- B. #765 (built, pushed): delete `apps/web/src/screens/analytics/ReportsPage.tsx` and `report-view.ts`. Do not delete them. After his yes: `git rm`, `loop finish 765`. `loop clean` deletes the remote plan branch: re-push `git push -f origin plan/t765` before `loop prep`.
- C. "Unbuilt from the wireframe" rows in #768, #769, #770, #771, #772. #768 waits for #767 merged; #770 and #771 wait for #769 merged.

## Follow-ups (plan job needed)

- #751 comment lists 4 (empty Excel when figures cache empty, stale comment/unused `words.export`, figures 5+ below tables, UTC date in export filename). S26-1 follow-ups issue. #799 old handoff: close it.

## Don't repeat

- Never `loop clean` or remove `.loop/wt/753`, `767`, `769`, `772` until their branches are pushed: only copy.
- A builder that edits an existing test fails loop-guard. Fix = `loop plan` puts the corrected test on `plan/t<N>`, merge main + seed into the PR branch from a throwaway worktree OUTSIDE `.loop/wt`, hooks ON, then close/reopen the PR so loop-guard rereads `Plan-base:`.
- `loop finish` says "CI GREEN" even when the PR is CONFLICTING and no CI ran. Check `gh pr view --json mergeStateStatus` before review.
- `loop plan` jobs can exceed 10 min: run in background, check `gh pr list` before rerunning. Never merge with red browser shards.
