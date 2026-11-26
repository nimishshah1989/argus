# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-26 08:46 IST · **By:** release session `local_7710e647…` (context full) · **Goal (Nimish):** all screens live on the newest kit · **Branch:** plan/handoff-s26b

## State

- Merge rule: ADR 0050 (tests + build green, critical-only review → merge; `loop-guard` paperwork does not hold). Nimish approved #753's screen list, #765's deletion, unbuilt rows in #768-#772 (#803).
- Staging serves e15007eb: Floor report page (#802) is live. main is d74a0846: Desk Open list (#805) merged, deploy run 45747570394 in progress, NOT yet verified. 18 of 29 screens fully on the newest kit (Floor and Desk are partial).
- BUILD session `local_975943c3-1b05-46a2-a59c-4e29214a3f58` (idle, waiting on its own checks: #772, #763, two ticket-fix planning jobs). #768, #770, #771 unblocked. It never merges.

## Next steps (RELEASE role: owns this file and all merges)

1. Verify d74a0846 live at `/api/v1/health`.
2. #806 (#765 Annual, head 5a75e883, main merged by hand): wait CI, critical-only review, merge. If `analytics-shell` e2e is red (last v1 page gone) → `loop plan`.
3. #804 (#753, head 8d84f294, planner added tests): builder adds the `rest` row in shift-kpis `paretoRows` and passes `t('insight.rest')` in View.tsx. DANGER: `.loop/wt/753` is BEHIND the remote and `loop finish` force-pushes: the builder must first `git pull --ff-only origin <branch>` (put that in the ticket). 1 of 3 attempts used. Then re-review, merge.
4. #807 (#763, from the build session): CI, review, merge. Then whatever the build session opens.
5. Late critical-only review of #801 (merged without a second review).
6. PR this branch (ADR 0050 + handoff) to main.

## Don't repeat

- Deploy image build crashes at random (`qemu` illegal instruction, exit 132; ded7d084, e15007eb): `gh run rerun <id> --failed`.
- After close/reopen, `loop ci` says "CI RED" for cancelled `${{ matrix.shard }}` runs and `loop finish` says "CI GREEN" on a CONFLICTING PR: check `gh pr checks` and `mergeStateStatus`.
- Conflicts (usually `insight-coverage.test.ts`): merge main in a throwaway worktree outside `.loop/wt`, keep both sides, dedupe imports, close/reopen.
- A builder handoff "Blocked" section must read exactly `None.`. New i18n keys in a shipped namespace need Gujarati values.
- Neither session switches branches in the main checkout. Never `loop clean` an unpushed ticket.
- Follow-ups from reviews are comments on #802 and #805.
