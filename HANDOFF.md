# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-26 · **By:** release session `local_abd659d2…` (context full) · **Goal (Nimish):** all screens live on the newest kit, nothing old remains · **Branch:** plan/handoff-s26b

## State

- Staging serves a5c83744; main is a5c83744 (checked at session end).
- Merged 26 Nov: #805 #806 #808 #811 #804 #809 #820 #807 #821. Nimish merges some himself (#806 went in red; #811 fixed it). #821 was already merged when this session ran the merge; its review had passed.
- Still old: Desk Mine + Team (#770), Settings sub-pages (#789-#795), OEM not live (#812-#815), /who, /password, analytics fallback, dead v1 code (#816-#819).
- #822 (#795) open and CONFLICTING: merge main and `origin/plan/t795` in a throwaway worktree (seed renamed `fixture.ts` to `fixture-rows.ts`).
- OEM decisions are ADR 0051. All seeds `plan/t812`-`t819` pushed. Order: #816 #817 #818, #812 #813, then #814 (after #812), #815 (after #813 + #814), #819 last. No question open for Nimish; Bhavin owes the claim-amount rule.
- BUILD session `local_975943c3…` stopped (context full). Its replacement card is NOT started. Read its handover: `~/Library/Application Support/Claude/side-session-notes/local_7710e647-bb9d-4008-ab43-c6a316dec3ff/build-handover.md`.
- Merge rule: ADR 0050.

## Next steps (RELEASE role: owns this file and all merges)

1. Confirm staging serves main; merge this branch's PR (ADR 0050 + handoff) when green.
2. Build session (or, if none, finish built work): #822, #789, #770, #790; then #791-#794 one at a time; then OEM / old-page tickets.
3. Review (critical-only), merge, confirm `/api/v1/health` after each. Then `loop clean <N>`.
4. Fold the build handover's "Don't repeat" into LESSONS.md. Review follow-ups are comments on each PR (#801-#821).

## Don't repeat

- `loop ci` says "CI GREEN" while shards are pending or GitHub is unreachable: always check `gh pr checks` and `mergeStateStatus`.
- `engine-scale.test.ts` (20 s) fails on a busy Mac and burns a `loop finish` attempt. If the branch holds all of origin, push without force and let CI judge.
- `loop finish` force-pushes: a build folder behind its remote must pull first. Never run `loop finish 763` again.
- Deploy image build crashes at random (`qemu` exit 132): `gh run rerun <id> --failed`.
- A builder handoff "Blocked" section reads exactly `None.`. New keys in a shipped namespace need Gujarati.
- Conflicts: merge main in a throwaway worktree outside `.loop/wt`. Neither session switches branches in the main checkout.
- The app auto-archives sessions on PR close (setting on); detaching a PR was blocked by the permission check.
