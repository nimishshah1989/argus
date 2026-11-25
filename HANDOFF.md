# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-25 (late) · **By:** Coordinator (Sonnet 5.5) · **Branch:** plan/s26-a (handoff rides here; `plan/handoff` is held by another worktree)
**Milestone:** M2 last old-design screens

## State

- Merged on main: #760 kit, #761 sign-in, #777 heading fix, sweep A–D coverage rows (PR #780), #762 S25 Guide (PR #779, merged by Nimish while its browser shards 1/3/4 were RED: `analytics-shell.spec.ts:110` expects menu links `['Guide','Desk']`, `analytics.spec.ts:235` expects heading "Guide"). **Check main's CI for f7e59bc9; if those specs fail on main, fix first** (likely the e2e still expects the v1 Guide page; plan job to update the spec or the screen).
- #763 S23 Monthly: built by rescuer (Fable), local checks pass, branch `t763-s23-monthly-report-on-the-v2-p` pushed (f127d6dd, Gujarati keys left to English fallback). **No PR yet: GitHub GraphQL and REST returned 502 for ~10 min.** Next: retry `gh pr create --base main --head t763-s23-monthly-report-on-the-v2-p` with the body in the `loop finish` log (Closes #763, Budget: files<=10 lines<=800, Screens: S23-monthly-report; Attempts 4, rescuer) — do NOT rerun `loop finish 763`. Then `loop ci`, reviewer, merge, `loop clean 763`. Main moved (live.tsx touched by #762): if conflicting, `loop prep 763 --fresh` + re-apply.
- #750 SWEEP-A: PR #781 open; CI red on loop-guard + browser 4/5, 5/5 (cause unread; GitHub logs were not available). Read with `loop ci 781`.
- #765 S24 Annual: prep done, not built. Start after #763 merges (`loop build 765 --bg`, `loop wait 765`, prettier on `docs/loop/handoff/765.md` via builder-small, `loop finish 765`).
- #751/#752/#753 sweep B–D: not started; coverage rows are on main now.
- S26-1..8: not planned. Next: ONE `loop plan "Plan the Settings sub-pages S26-1..S26-8 on the shared CRUD kit from #776 and ADR 0036, tickets plus light seeds (ADR 0034), no new decisions"` (Bash timeout 600000; on timeout check `gh pr list`). `plan/s26-a` has ADR 0046 only.
- S27–S30 (tickets #767–#772) still wait for Nimish's wireframe approval.

## Don't repeat

- NEVER run `loop finish N` twice without a code change: each run burns an attempt. A GitHub 5xx on `gh pr create` is not a build failure: branch is already pushed, create the PR by hand.
- Ticket "Files to change" lines must be one path per line as `- path — text`.
- New v2 report/page screens need the figure key in `PAGE_KEYS` (figure-content.ts).
- Every v2 screen PR touches live.tsx (+ Analytics.tsx): merge one at a time, `loop prep N --fresh` + re-apply when main moved; builders cannot `git merge`.
- A Bash command that names `.loop/wt/<N>` is blocked for the coordinator: inspect with `git log <branch>` instead.
- Builders cannot run prettier: use `loop:builder-small` for `pnpm exec prettier --write docs/loop/handoff/<N>.md`.
- Builders can lose Bash mid-run; check `loop wait` text for BLOCKED.
