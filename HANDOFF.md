# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-25 · **By:** Coordinator (Sonnet 5.5) · **Goal (Nimish):** get all screens live on the most updated kit version · **Branch:** plan/s26-a

## State

- LIVE on main: #762 S25 Guide (PR #779 + fix #784; reviewer PASS on #784, CI green, `loop clean 762` done). Late fix cause: the e2e needs the Guide's figure label as its own `<span>` text node (v1 had it, commit 88c957cf). Reviewer notes, not done: add a unit test for `withDesk` / the label span in `apps/web/src/screens/v2/guide`; if another screen needs the Desk link, move `withDesk` into LiveFrame; `docs/loop/handoff/762.md` omits the span/h1/Desk fixes.
- S27–S30 wireframes ALL APPROVED. Builds in other sessions' `.loop/wt/`: #767 (commit 8c70eae3, session local_bfc6fd20) and #769 (commit 0614a320, session local_77555ba6); no PRs yet, hidden tests and e2e never run.
- Open PRs, rebased with `gh pr update-branch` onto the new main, CI not yet re-read: #781 sweep A (#750), #782 Monthly (#763), #783 sweep B (#751). Known cause before rebase: loop-guard flags `#<n>` / "(#763)" text in code comments as raw colour/size.
- S26 Settings: plan job DONE. PR #786 (`plan/s26-tickets`, ADR 0047 + ADR 0044/0046 to main) is open, CI not read. Next: `loop ci 786`, merge when green, then ONE `loop plan "Write the S26-1..S26-8 issues and light seeds from ADR 0047; no new decisions"`; build S26-1 first, S26-2..8 after it merges. Nimish question recorded in coverage notes: S26-8 restore-clock pauses are read-only, linking to the wait-reasons list.
- Tests: none run by me this session beyond CI on #784 (all green). `.loop.json` commands (setup/test/typecheck/lint) were NOT re-verified.
- Not started: #765 S24 Annual, sweeps #752/#753.
- Flakes seen: who-is-acting.spec.ts:219, detail-downtime.spec.ts:7, desk lifecycle 409, desk-lists.spec.ts:11 (phone).

## Next step

1. `loop ci 781`, `loop ci 782`, `loop ci 783`. For loop-guard reds: rewrite the `#<n>` comments (do NOT loosen `.github/loop/check_pr.py`). Merge one PR at a time (all touch live.tsx/Analytics.tsx), `gh pr update-branch` the rest after each.
2. `loop finish 767`, `loop finish 769` etc. in the sessions' folders, one at a time, then reviewer and merge.
3. Merge #786, plan the S26 issues (see State), then build S26 tickets; then #765 S24, #752, #753.

## Blocked / open questions

None. Nimish: `design/approved.json` has uncommitted S27–S30 approvals in this checkout; commit on a plan branch.

## Don't repeat

- `loop build N` reads the issue BODY, not comments: put fix notes in the body (`gh issue edit`) before `loop prep`. `loop finish` commits leftover builder work itself.
- NEVER run `loop finish N` twice without a code change. `loop prep N` on a finished ticket needs `gh issue reopen N` first. `loop finish` removes `.loop/wt/N`.
- Re-running `/loop:init` overwrites `.github/loop/check_pr.py` with the stock file (drops ADR 0035/0038/0040 carve-outs) and writes machine paths into `.claude/settings.json`: `git checkout` both. Branch protection on main was NOT enabled.
- Hooks block `git -C .loop/wt/N` for the coordinator and holdout paths for builders. New v2 page needs a `PAGE_KEYS` entry in figure-content.ts; v2 page title is the screen's own name. Builders cannot run prettier: use builder-small.

## Files touched this session

HANDOFF.md only (committed). `docs/loop/metrics.jsonl` modified by the loop, uncommitted.
