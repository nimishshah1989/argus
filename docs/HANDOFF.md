# Where things stand

Read first. Rewrite when the state changes.

## RESUME HERE (frontend orchestrator, 14 Nov 2026 ~05:50 UTC)

**Two lanes (CLAUDE.md, Nimish 14 Nov):** FRONTEND orchestrator (apps/web, infra, staging, MILESTONES, HANDOFF, ledger
`docs/plan/ledger.md` on branch `claude/orchestrator-m0-gate`) with up to 3 builders; BACKEND orchestrator
session_01KEBF2ANCJYSxcYWMb43Pwz (apps/server, packages, scripts; ledger `docs/plan/ledger-backend.md`) with up to 2.
ONE migration in flight across lanes: backend asks FRONTEND for the lock (now GRANTED to backend for ticket 23).
**Merges: option A** (Nimish): only the two orchestrators merge, fast: reviews start when a PR opens, merge minutes after
green. Builders keep PRs as drafts. Adversarial review (fresh Opus, read-only) for schema/auth/permissions/tenancy/deletes/history.
**Screens:** only from mockups Nimish approved; rulebook `docs/design/LOCK.md`; every screen PR shows built-vs-mockup at 360 px.
**Data:** build and test on Cosmos's real data; only people's names/phones stay coded in anything committed.

## Staging (live)

https://cosmos.3-108-95-203.sslip.io answers; every merge to main deploys itself. Cosmos is loaded (192 machines, 26
logins, 275 tickets, 0 unexplained). Nimish's Mac: ~/argus-staging (tfvars: domain "", server_az_suffix "c", m6g.large,
external_uptime_ping false, github_sub_prefix set). LEFT for ticket 14: the restore drill (infra/RESTORE.md; log in
docs/plan/restore-drill-log.md), then the M0 gate (one short report, docs/plan/gates/M0.md).

## pstack (DONE: #208, vendored in .claude/skills; use /poteto-mode, /interrogate)

Copy pstack into the repo so every session (cloud too) has it, and use it from now on: `add_repo` cursor/plugins
(read), check its licence allows copying, vendor the pstack skills into `.claude/skills/` (as ponytail is), keep a
NOTICE/licence file, then run builds through `/pstack:poteto-mode` and reviews through `/pstack:interrogate` per
CLAUDE.md. If the licence forbids copying, say so and keep the fallback.

## In flight (frontend lane)

- #205 floor fix (builder session_01KEBF28gYoZ8XReuz1auL6F) turns main's browser checks green (main RED since #196/#199).
  Merge FIRST. Then that builder hides the Online pill on the floor (follow-up PR).
- #201 rest of desk screens + #203 board hides hidden groups (builder session_01KEBF26SyRdPQNgdoDa7jw1): after #205, merge
  main into them, merge on green.
- Live board concepts (session_01KEBF29W6XpMpBRfZAEgga6): ONE combined board (A pulse + C 'what is holding us up' + B
  scoreboard), 'now' and 'after M4a' versions; send Nimish the link; build only after he approves.
- Backend lane: fix-main-after-199, 21 follow-up, 23 (+ migration), #204 test teardown fix; then M2, M6 part 1, M4a.

## Next frontend tickets (in order)

18 close/report/PDFs (slice 2 approved) -> 21 goal 2 sign-in, who is acting, account (slice 3 approved) -> mockup slice 4
(settings screens, audit screen, follow-up tasks; needs Nimish's approval) -> 22/23 screens, 19, 20 goal 2.

## Waiting on Nimish

Restore drill; live board approval; desk: Team/Mine inline vs drill-down rows, 24 h vs 12 h time; 31 status labels; old
fault codes MEC/NI/INT/FS/PP/UTI (Bhavin); two vs three shifts; AI gate inputs (Anthropic terms, Cosmos consent, cap,
threshold); a repo admin adds `pr-meta` to the required checks.

Mockups: slice 1 https://claude.ai/artifact/Tr4eCZnmM1wBMQjz3pXsaU, slice 2 https://claude.ai/artifact/3McvVvwWvijMLM6FNcTVLK,
slice 3 https://claude.ai/artifact/UEwV5m4SdfC3UvUprBy1bG, desk evidence https://claude.ai/artifact/JGhmQ67qY14Hsn3WqQur5X.
