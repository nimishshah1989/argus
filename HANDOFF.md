# HANDOFF

_Overwritten at the end of every session. Facts only._

**Updated:** 2026-11-25 ~19:35 · **By:** side session (Sonnet) · **Branch:** plan/handoff-sweep-3 (stopped at context budget)
**Goal (Nimish, 25 Nov):** all screens live on the v2 kit. No re-planning. Coordinator local_8ef44b35 is archived: report to Nimish directly.

## State
- **#757 / PR #759**: rebuilt from the amended seed (haiku, `narrowed` prop), `loop finish 757` done, PR updated. CI RED: browser (1/5), browser (3/5), loop-tests. Reasons NOT read yet. Next: `gh run view` each failing job; loop-tests may be the handoff "## Coverage" placeholder ("To be added") in `docs/loop/handoff/757.md`. Then reviewer, merge. Expected unrelated reds: analytics-compare (until #755), machine-reliability (until #643).
- **#755 / Money Matters**: main merged in, coverage row `DROPPED ... Nimish said yes: 2026-11-25` added in `docs/design/v2/scope/money-matters.md` (pushed 24931c46 to branch `t679-s22-c-money-matters-goes-live-`), PR body updated. Nimish said YES in the question dialog this session. CI RED: browser (1/5), browser (3/5), loop-guard. Reasons NOT read. Next: read loop-guard log (prettier realigned the scope tables; maybe a guard on the table or on the handoff), fix, `loop ci 755`, reviewer, merge.
- **#643** build finished (BLOCKED line in `docs/loop/handoff/643.md`: plan-branch merge, builder may not merge). Main already has the e2e plan (#754), so merge main into branch `t643-ins-machine-page-spares-meanin` from a scratchpad worktree, rewrite handoff `## Blocked` to exactly "None.", then `loop finish 643`. Builder saw 4 full-suite failures it could not re-run (backup-dump, analytics-compare, engine-no-database-ids, history-parity): re-check on main.
- **#750-#753, #689, #695, Reports/Guide/Login/Settings**: not started.

## Don't repeat
- `.loop/wt/<N>` paths: Bash hook blocks any command naming them; use Read. No git ops there; use a scratchpad worktree.
- Auto-mode refuses writing "Nimish said yes" until he answers in the dialog (AskUserQuestion). Ask first.
- Never merge a red browser check unless Nimish names it.
- Scratch worktrees to remove: `wt755` (b671b4af scratchpad) and `wt-handoff` (this session's scratchpad), `main-wt`.
