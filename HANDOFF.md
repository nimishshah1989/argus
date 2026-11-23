# HANDOFF

> **23 Nov — unattended run is BLOCKED by permissions.** In `loop auto` sessions ("don't ask" mode) subagents may not run
> `mv`, `git add` or `git commit`, and some orchestrator shell commands are refused too. Ticket #551 (two file renames)
> can't be built, and until it lands every local `loop finish` fails on the Mac case-clash. Nimish must allow shell for
> builders (permission allowlist for `git`, `mv`, `pnpm` in the build folders) or run #551 by hand. ADR 0012 still applies.

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-23 · **By:** Plan · **Model:** claude-opus-5-5
**Milestone:** M1 Stabilise (in progress) · **Branch:** plan/handoff-permission-block · **PR:** #559

## State

- #550 (ADR 0013) merged. #556 (G1.5 escalation clock test, plan PR): all CI green except `pr-meta` parity; body has a
  "No parity:" line and label `no-parity`; closed/reopened to retrigger. Merge it when green.
- #557 (G1.6 money-rights tests, plan PR): api 5/5 fails, every request 500s. Diagnosis (inferred, not run): real product
  bug, filed as #558 (Team Focus has a value but drills to nothing → engine guard throws → whole figures route 500s).
  Keep #557 open as #558's visible test; #558 needs a seed branch `plan/t558` via `loop-ticket`.
- Tickets #552–#555: builder edits sit uncommitted in `.loop/wt/<N>/` (552 cell-log dash, 553 PM report names,
  554 dashboard `numbers`, 555 problem-analysis `numbers`). 553's `loop finish` failed only on the case-clash (attempt 1/3).
- #551: not built (3 builder runs, all denied the shell). Attempts not counted by `loop finish` (never run).

## Next step

1. Unblock permissions (Nimish). 2. Build #551, `loop finish 551`, merge. 3. `loop finish` 552–555 (edits are in place).
4. Merge #556. 5. `loop-ticket` #558, then fix #557 CI. 6. Rest of M1, then M2 coverage gap.

## Don't repeat

- Don't retry builders in a "don't ask" session expecting shell: `mv`, `git mv/add/commit` are all denied to subagents.
- Editing a PR body or adding a label did not start a new `pr-meta` run; `gh run rerun` reuses the old body. Close+reopen.
- Shell commands with `>` plus an `apps/web/...` path trip the frontend guard.

## Files touched this session

- HANDOFF.md, LESSONS.md; issue #558; PR #556 body/label.
