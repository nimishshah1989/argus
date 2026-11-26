# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-26 11:20 IST · **By:** release session `local_abd659d2…` (context full) · **Goal (Nimish):** all screens live on the newest kit, nothing old remains · **Branch:** plan/handoff-s26b

## State

- Staging serves a5c83744 = main (health checked). Merged 26 Nov: #805 #806 #808 #811 #804 #809 #820 #807 #821. Nimish merges some himself (#806 went in red; #811 fixed it).
- Still old: Desk Mine + Team (#770), Settings sub-pages (#789-#795), OEM not live (#812-#815), /who, /password, analytics fallback, dead v1 code (#816-#819).
- #822 (#795) open, conflicting: merge main and `origin/plan/t795` in a throwaway worktree (seed renamed `fixture.ts` to `fixture-rows.ts`).
- OEM: ADR 0051. Seeds `plan/t812`-`t819` pushed. Order: #816 #817 #818, #812 #813, #814 (after #812), #815 (after #813 + #814), #819 last. Bhavin owes the claim-amount rule.
- Merge rule: ADR 0050.
- Tests: #811 #804 #809 #807 #821 passed test shards, static, secrets and critical-only review (#809, #807: `loop-guard` red, not critical). Screens not opened by eye.

## Next steps (RELEASE role: owns this file and all merges)

1. Merge #823 (ADR 0050 + handoff; conflict with main resolved) when `gh pr checks` is green.
2. Build session (or, if none, finish built work): #822, #789, #770, #790; then #791-#794 one at a time; then #812-#819.
3. Review (critical-only), merge, confirm `/api/v1/health`, then `loop clean <N>`. Build handover: `~/Library/Application Support/Claude/side-session-notes/local_7710e647-bb9d-4008-ab43-c6a316dec3ff/build-handover.md`.
4. Fold its "Don't repeat" into LESSONS.md. Older follow-ups: comment on #751, S26-1; #800's handoff says #782 merged with no review (no late one recorded).

## Blocked

- New building: the build session `local_975943c3…` stopped (context full) and its replacement card is not started. Release card `task_40f525ec` also not started.

## Don't repeat

- `loop ci` says "CI GREEN" with shards pending or GitHub unreachable: check `gh pr checks` and `mergeStateStatus`.
- `engine-scale.test.ts` (20 s) fails on a busy Mac and burns a `loop finish` attempt. If the branch holds all of origin, push without force and let CI judge.
- `loop finish` force-pushes: pull a behind build folder first. Never run `loop finish 763` again.
- Deploy build crashes at random (`qemu` exit 132): `gh run rerun <id> --failed`. A handoff "Blocked" section in a builder note reads exactly `None.`.
- Merge conflicts: throwaway worktree outside `.loop/wt`; never switch branches in the main checkout. New keys in a shipped namespace need Gujarati.
- The app auto-archives sessions on PR close (setting on).
