# HANDOFF

> **24 Nov — ADR 0016 (Nimish: yes to all):** Breakdown Log Excel keeps both ticket columns, screen + CSV show one (G1.2a unblocked); draft Shift KPIs + Energy wireframes for his approval; answer key stays frozen; budget 150k; helpers = `helper` (Sonnet), never general-purpose.

> **Read ADR 0012 first.** Nimish is away; the loop runs unattended. Plan decides §6 (ADR each) except answer-key changes, production, money, irreversible data steps.

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-24 · **By:** Plan · **Model:** claude-opus-5-5
**Milestone:** M2 Finish the analytics redesign (building) · **Branch:** plan/handoff-m2-cmp1

## State

- Merged this session: **#592** TF-3 (Team Focus live, v1 deleted; #580 closed) · **#595** CMP-1 `comparePair` (#584; budget 760 for a verbatim move, ADR 0022) · **#597** CMP-3 six tables in the Compare view (#586) · **#596** wireframes S20–S26 (drafts, waiting for Nimish).
- **TF-4 #594** → PR **#598** (review 1 FAIL: dead "I'll take it" on list rows; blank owner name in the owner drawer). Plan fixed the seed `plan/t594` @ `cd537609`: kit callbacks optional (ADR 0022) + `assign-list.test.ts`. Attempt 2 BLOCKED twice: builder says `team-focus.test.ts:104` (gallery `drawer=decision:a02` shows "Assign to Meera K") gets no handlers. The gallery view DOES pass `onAssign` (`gallery/v2-team-focus-view.tsx:41`) → check how the drawer path (`local.tsx` `localAction` / `EntityShell`) gets handlers; likely the drawer is built without View's props. Decide, write it in the ticket, rebuild. Body template = #597's body.
- Compare next: **#585** CMP-2 route (unblocked by #584) → **#587** CMP-4 adapter (Don't now asks for non-empty scorecard/checkup) → **#588** CMP-5 go live (blocked #587).

## Next step

1. Unblock #594 (above) → `loop finish 594` → re-apply body → review → merge. 2. #585 → #587 → #588. 3. S20–S26 wait for Nimish's approval.

## Blocked / open questions

- **Nimish:** approve wireframes S20–S26 (PR #596 lists his questions). ADR 0019 extra drill on Data Checklist; Compare spares ₹0 frozen; ADR 0020 §5–6 "later" Team Focus items.
- Follow-up (review of #595): `compareFigure` now runs `pairYear` twice per call and discards it; no visible test for a pair outside the top category.

## Don't repeat

- **After every merge to main**, refresh each open seed: `git -C /tmp/t<N> merge origin/main`, push, merge the seed into the PR branch from a `/tmp` worktree, set `Plan-base` to the new seed sha. Otherwise loop-guard flags protected files.
- `loop finish` overwrites the PR body every run: keep `/tmp/body<PR>.md`, `gh pr edit --body-file`, then push an empty commit (worktree at `/tmp/e<PR>`, `git commit --allow-empty`, push `HEAD:<branch>`).
- Budget is always `files<=N lines<=M`; N counts `changes/` + handoff. A screen PR must change `scope/<screen>.md` itself (Q16).
- To merge a seed into a build folder: `cd .loop/wt/<N> && git merge -q --no-edit origin/plan/t<N>` as its own Bash call; `loop` commands from the repo root in a separate call.
- **Never force-push.** "ticket N" in comments, never `#N`.
