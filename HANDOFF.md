# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-25 · **By:** Coordinator (Sonnet 5.5) · **Model:** Sonnet 5.5
**Milestone:** M2 last old-design screens · **Goal set by Nimish:** get all screens live on the most updated kit version · **Branch:** plan/s26-a (context budget)

## State

- Merged on main: #762 S25 Guide is LIVE (PR #779 + fix PR #784; `loop clean 762` done). Cause of the late fix: e2e needs the Guide's figure label as its own `<span>` text node (v1 did it, commit 88c957cf). Plan PRs #780, #785 (S27–S30 handoff) and #766 (S27–S30 coverage) merged.
- S27–S30 wireframes are now ALL APPROVED (Nimish). Their builds (#767–#772) sit in `.loop/wt/` of sessions local_77555ba6 (floor-desk-ticket-board) and local_bfc6fd20 (build-floor-desk-ticket): #767 committed 8c70eae3, #769 committed 0614a320, neither is a PR yet (no `loop finish`, no hidden tests/e2e run). Next: `loop finish <N>` one at a time, review, merge. Every v2 screen PR touches live.tsx/Analytics.tsx: one merge at a time.
- Open PRs, all just `gh pr update-branch`-ed onto the new main (CI not yet re-read): #781 sweep A (#750), #782 Monthly (#763), #783 sweep B (#751). Known causes before the update: loop-guard flags `#<n>` text and "(#763)" style comments as raw colour/size (strip `#<n>` from those comments; do NOT loosen check_pr.py; plan was agreed in last handoff, Nimish's call still formally pending); the Guide e2e failures should be gone now that #784 is on main. Run `loop ci 781`, `loop ci 782`, `loop ci 783` first.
- Background jobs started this session (check, don't re-run): reviewer for PR 784 (finished, PR merged); `loop plan` for S26-1..S26-8 Settings tickets on the shared CRUD kit (output file bgbymh0gp; check `gh pr list` and `git branch -r | grep s26` before running it again).
- Not started: #765 S24 Annual (prep done earlier, build after #763 merges), sweeps #752 and #753 (C, D; coverage rows are on main), S26 tickets (see plan job above).
- Remaining screens not yet on the kit (the goal): S23 Monthly, S24 Annual, S26 Settings sub-pages, S27–S30 Floor/Desk/Ticket/Board, sweeps A–D pages.
- Possibly unrelated flakes seen in CI: who-is-acting.spec.ts:219, detail-downtime.spec.ts:7, desk lifecycle 409 "Already reported", desk-lists.spec.ts:11 (phone).

## Don't repeat

- `loop build <N>` reads the issue BODY, not comments: put fix notes in the body (`gh issue edit`) before `loop prep`. A builder that cannot commit leaves work uncommitted: `loop finish` commits it itself.
- NEVER run `loop finish N` twice without a code change (burns an attempt). `loop prep N` on a finished ticket needs `gh issue reopen N` first.
- `loop finish` removes `.loop/wt/N` after pushing: `loop prep N` recreates it on the PR branch.
- `/loop:init` re-run overwrites `.github/loop/check_pr.py` with the stock file (drops ADR 0035/0038/0040 carve-outs) and writes machine-specific graphify paths into `.claude/settings.json`: revert both with `git checkout` (done this session; repo was already on the loop since #546, branch protection on main is the only optional leftover and was NOT enabled).
- Hooks block `git -C .loop/wt/N` for the coordinator, and holdout test paths for builders.
- v2 page title must be the screen's own name (`analytics.<x>.title`). New v2 report/page needs a `PAGE_KEYS` entry in figure-content.ts. Builders cannot run prettier: use a builder-small subagent. zsh: write `${T}:path`.

## Blocked

Nothing blocked. Nimish: `design/approved.json` has uncommitted approvals (S27–S30) in this checkout; commit them on a plan branch.
