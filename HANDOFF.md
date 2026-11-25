# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-25 · **By:** Coordinator (last-screens session 4, started by local_8ef44b35) · **Model:** Sonnet 5.5
**Milestone:** M2 last old-design screens · **Branch:** plan/s26-a (context budget)

## State

- Merged on main: #760 kit (PR #776), #761 sign-in (PR #775), #777 heading fix (PR #778).
- #762 S25 Guide: PR #779 CONFLICTS with main (live.tsx, Analytics.tsx; real content conflicts, `gh pr update-branch` fails, builders and the coordinator are barred from `git merge`). Fix in progress: old work saved as local branch `backup-t762-old`; `loop prep 762 --fresh` done on current main; builder subagent (a8763382b130f26f1) re-applies the old files from `backup-t762-old` and hand-merges live.tsx/Analytics.tsx, commits, no push. Next: check `git -C .loop/wt/762 log` for its commit, `loop finish 762` (must force the PR branch; if finish cannot update PR #779, close #779 and let finish open a new PR), `loop ci`, reviewer, merge, `loop clean 762`.
- #763 S23 Monthly: ROOT CAUSE of the red tests found: `'monthly-report'` was missing from `PAGE_KEYS` in `apps/web/src/screens/analytics/figure-content.ts` (not in the ticket's file list), plus the Gujarati keys in `analytics-report.gu.ts`. Ticket bodies #763 and #765 EDITED to list both (and the i18n lines split into two bullet lines, because `ticket_files` only parses `- path — ...` lines: "a.en.ts + `.gu.ts` —" was silently ignored). Attempts used 3 of 3 (I wasted one by re-running `loop finish 763` unchanged). A rescuer (agent a2dd03f1ccb1b9582, Fable) is adding PAGE_KEYS + gu keys in `.loop/wt/763`, commit no push. Next: check its result, `loop finish 763 --rescue` (main merge already in the branch as 9dfd027f; main has moved since: if CI says conflicts, same fix as #762), `loop ci`, reviewer, merge, `loop clean 763`.
- #765 S24 Annual: `loop prep 765` done (fresh, brief includes the PAGE_KEYS line). Not built. Start only after #763 merges (its live.tsx entry goes after monthly's) and `uptime` load < ~10 (was 11.6 at 21:20): `loop build 765 --bg`, `loop wait 765`, prettier on `docs/loop/handoff/765.md` via builder-small, `loop finish 765`.
- S26-1..8: not planned. `plan/s26-a` has ADR 0046 only. Next: ONE `loop plan "Plan the Settings sub-pages S26-1..S26-8 on the shared CRUD kit from #776 and ADR 0036, tickets plus light seeds (ADR 0034) following how #760 and the sign-in/guide tickets were done, no new decisions"` (Bash timeout 600000; on timeout check `gh pr list` first).
- Coordinator was never messaged about PR opens (none opened this session).

## Don't repeat

- NEVER run `loop finish N` twice without a code change: each run burns an attempt.
- Ticket "Files to change" lines must be one path per line as `- path — text`; anything else is ignored and the file's edits are dropped from the commit ("ignored files outside the ticket").
- New v2 report/page screens need the figure key in `PAGE_KEYS` (figure-content.ts) or `pageOf` is null.
- Every v2 screen PR touches live.tsx (+ Analytics.tsx): merge the PRs one at a time, `loop prep N --fresh` + re-apply when main moved; builders cannot `git merge`.
- zsh: write `${T}:path`, not `$T:path` (`:a` modifier).
- Builders cannot run prettier: use a `loop:builder-small` subagent for `pnpm exec prettier --write docs/loop/handoff/<N>.md` before `loop finish`.
- Builders can lose Bash mid-run; check `loop wait` text for BLOCKED.
