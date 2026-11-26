# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-26 ~10:20 IST (interim) · **By:** release session `local_abd659d2…` · **Goal (Nimish):** all screens live on the newest kit, nothing old remains · **Branch:** plan/handoff-s26b

## State

- Merge rule: ADR 0050 (tests + build green, critical-only review → merge; `loop-guard` paperwork does not hold).
- Staging serves 6e4c7b99: #805, #806 (Annual), #808 (Board) are live. Nimish merged #806 and #808 himself; #806 went in with 2 red e2e tests and a wrong tab-row name. #801 late review PASS.
- #811 (ticket #810, approved by Nimish) fixes both: open, testing, in review. Until it merges every other PR is red on `analytics-reports` + `analytics-shell`.
- #804 (#753) and #809 (#768): critical review PASS, only those 2 tests red. #807 (#763) is with the build session.
- Nimish, 26 Nov: add OEM (facts only, people pick each cause, no keyword guess, no claim amount until Bhavin's rule); rebuild /who and /password with no wireframe approval; nothing old remains. One `loop plan` job is running for ADR, PROJECT.md, tickets.
- BUILD session `local_975943c3-1b05-46a2-a59c-4e29214a3f58` builds (#771 ticket page first), never merges. Told about OEM; send it the new ticket numbers.

## Next steps (RELEASE role: owns this file and all merges)

1. Merge #811 when green + PASS; confirm `/api/v1/health` serves it.
2. For #804 then #809: `gh pr update-branch`, wait for CI, merge, confirm staging. Then `loop clean 753 768 810` one by one.
3. Review/merge the build session's PRs (#807, #771, #770, #789-#795).
4. Planner's ticket numbers → build session. Questions it raises → Nimish.
5. PR this branch (ADR 0050 + handoff) to main.

## Don't repeat

- Deploy image build crashes at random (`qemu` exit 132): `gh run rerun <id> --failed`.
- `loop ci` can say "CI GREEN" while shards are pending: check `gh pr checks` and `mergeStateStatus`.
- `engine-scale.test.ts` (20 s limit) fails when the Mac is loaded; check `uptime` before `loop finish` (it burns an attempt).
- `loop finish` force-pushes: a build folder behind its remote must pull first. A network timeout can stop it after the push: create the PR by hand.
- Conflicts (usually `insight-coverage.test.ts`): merge main in a throwaway worktree outside `.loop/wt`.
- A builder handoff "Blocked" section must read exactly `None.`. New i18n keys in a shipped namespace need Gujarati values.
- Neither session switches branches in the main checkout. Review follow-ups are comments on each PR.
