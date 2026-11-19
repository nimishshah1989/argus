# Where things stand — handoff for the next orchestrator session

Read this first, then the tail of `docs/plan/ledger.md`, then "Road to v1" in `docs/plan/MILESTONES.md`.
`git log origin/main` and the PR list beat this text where they differ. State as of 17:00 UTC, 19 Nov 2026.
Open PRs via `gh api --method POST repos/nimishshah1989/argus/pulls --input <file.json>`, non-draft. Staging deploys on
every merge: `https://cosmos.3-108-95-203.sslip.io/api/v1/health` shows the commit it serves.

## How to work (Nimish: non-technical, wants short plain answers, to be challenged, uncertainty flagged)

- Never ask him a technology question; settle it by running something. Product questions only. Technical questions
  for Bhavin: write them as a short plain list; Nimish forwards them on WhatsApp.
- Builders: Agent tool, `poteto-agent`, sonnet, worktree; resume the same builder for its own PR. Tell every builder:
  `pnpm lint` AND `pnpm precheck` before EVERY push, a `Large PR:` line over 800 lines, a `Tests removed:` line.
- Checks: opus, one narrow independent check only where a number, permission or data-loss bug is possible. The local
  history database `argus_local` is on port 5433, not 5432.
- Merge squash with `expectedHeadSha` only after READING the check runs of the CURRENT head. A "check suite
  completed" event can be for an old head: it says nothing. Merge main into a PR (`update_pull_request_branch`) once
  its builder is idle.

## Rulings (Nimish)

Earlier: Running grey, Waiting amber, Transferred blue; Indian number grouping; analytics follows system dark/light;
floor and desk keep Bhavin's flow; AI work paused (55, 72, 68); weekly staging dump parked; purge real data or make the
repo private before cutover (N20); real data already in the public repo is an accepted risk, add NO more. 19 Nov, later: power and air failures COUNT in plant downtime and availability (91);
heads see failed jobs (78c); supervisors get a desk link to Analytics (86b); all merged.

## Frontier

- Merged 19 Nov: 76, 75a, 77a/b, 78a/b/c, 79 (nightly workflow open), 69a/b/c, 81, 82, 84 (size goal unmeasured), 86a
  frame, 86b desk link, 91 (2023 hours unreconciled, so still in progress); fixes #463, #468. 77b and 78b went in
  ahead of the page templates as additions to existing Settings lists; restyle in wave 3.
- No PR open. Next: **83 Elements, 85 Page templates**, then wave 1 (86) on Today (my suggestion, he has not picked) with a before and after for his
  approval (screens only from approved mockups, `docs/design/LOCK.md`). Also 75b (smaller replies via `?keys=`), 75c/d/f,
  69d (staging load: needs his yes to real data on staging), 90, 92-96. Follow-ups: shared search palette (87),
  nightly validate workflow (`docs/TESTING.md` 10), failed-jobs 5-minute alarm.

## Open numbers (do not state as final)

History vs Bhavin's sheets: 89% of 2,084 machine-months match; 229 unexplained until he answers (`docs/plan/evidence/
69c-real-load.md`). Plant-event hours are a LOWER BOUND (named machines only); 2023 is 1,646.6 against the ticket's
about 1,480; at most 44.4 h may double count with breakdowns; lost hours may include non-CNC machines. Staging: demo data.

## Tracker and waiting on people

Tracker: https://claude.ai/artifact/5Kc9KrYMwnW9EK1UvmA9JJ, `datasets/tickets`, refresh half-hourly, never edit the page
file. Waiting on Nimish: which way is good for PM hours, breakdown hours with no downtime, manpower hours and spend
figures (all "neither" now); staging history yes or no. `docs/plan/NEEDS.md`: N16 Bhavin (bare Star sheet, more
out-of-production machines), N17 older files, Bhavin's batch (power cut against every machine or the plant; PM/UTI
rows count; blank-minute rows; sheet vs log; hours vs minutes), N18, N19, N5 Gujarati (native reader), N20 purge.
