# Where things stand — handoff for the next orchestrator session

Read this first, then the tail of `docs/plan/ledger.md`, then "Road to v1" in `docs/plan/MILESTONES.md`. `git log origin/main` and the PR list beat this text where they differ. State: night of 19 Nov 2026, after #484.
Open PRs via `gh api --method POST repos/nimishshah1989/argus/pulls --input <file.json>`, non-draft. Staging deploys on every merge: `https://cosmos.3-108-95-203.sslip.io/api/v1/health` shows the commit it serves.

## How to work (Nimish: non-technical, wants short plain answers, to be challenged, uncertainty flagged)

- Never ask him a technology question; settle it by running something. Product questions only. Technical questions for Bhavin: a short plain list; Nimish forwards it on WhatsApp.
- Builders: Agent tool, `poteto-agent`, sonnet, worktree; resume the same builder for its own PR. Give each the brief
  (PR body sections, lint, format:check and precheck before EVERY push, `Large PR:`, `Tests removed:`). - Checks: opus, one narrow independent check only where a number, permission or data-loss bug is possible. Local history database `argus_local`: port 5433.
- Merge squash with `expectedHeadSha` (the CURRENT head) only after READING the check runs of that head; a "check suite
  completed" event can be for an old head. Merge main into a PR (`update_pull_request_branch`) once its builder is idle,
  then re-read the check runs of the resulting head before merging.

## Rulings (Nimish)

Earlier: Running grey, Waiting amber, Transferred blue; Indian number grouping; analytics follows system dark/light; AI work
paused (55, 72, 68); weekly staging dump parked; purge real data or make the repo private before cutover (N20); real data
already in the public repo is an accepted risk, add NO more. 19 Nov: power and air failures COUNT in plant downtime AND
AVAILABILITY (91); heads see failed jobs (78c); supervisors get a desk link to Analytics (86b). Night of 19 Nov: "build all
the pages and get them live", staging only, no production stack; floor and desk stay on Bhavin's v3 flow (only colour,
type, depth, motion change); the approved analytics design (Instrument look, white field, functional motion) wins over DESIGN.md's earlier motion text.

## Frontier

- Merged 19 Nov night: 85 templates (#473), 83 elements (#474), 83b (#475), 83c-1 (#478), 86 Today (#476), fix (#477), and 87
  pages: Action Center, checklist, Team Focus (#479), Money (#480), Reports (#481), Breakdown Log, registers, machine page (#482),
  forecast and Forecast Lab (#483), Energy (#484). Earlier 19 Nov: 76, 75a, 77a/b, 78a/b/c, 79 (nightly workflow open), 69a/b/c, 81, 82, 86a/b.
- Active: **84 Charts** (in progress: draw-in #475; bundle size after 83c-2 unmeasured); **91 Utility loss** (in progress: 2023 hours
  unreconciled); **85** in progress until the 19-of-27 count and critique scores are recorded. In flight tonight: PM calendar + Guide (87 rest), 88a desk lists and ticket detail.
- Left in 87: PM calendar and keyboard Move to date, Guide, other analytics group screens, `ui:check` guard. Then 83d (shared-element
  gaps), 83c-2 (showcase tile, heat map, trend, Pareto onto shared elements; report the dark heat-map shift), 75b/c/d/f, 69d, 77b/78b restyle, 88, 89, 90, 92-96.
- Follow-ups (ledger): `screen-state.tsx` `empty` required; pager nav name; spares caption; Today's monthly sparkline needs a
  field; shared search palette (87); nightly validate workflow; failed-jobs alarm; DESIGN.md changes should run the api shards; `ui/sheet.tsx` dark
  scrim, `floor-pieces.tsx` TAP contrast 4.15:1; day-boundary flakes and `sla-timers.test.ts` deadlocks; jsdom ADR; prior-date figures endpoint; machine page prints spares and PM hours twice; engine fetches the whole plant per drill chunk.

## Open numbers (do not state as final)

History vs Bhavin's sheets (`docs/plan/evidence/69c-real-load.md`): of 2,084 machine-months, 1,561 (75%) match raw and 1,855 (89%) once his
counting rules are applied; 229 unexplained until he answers. Plant-event hours are a LOWER BOUND (named machines only); 2023 is 1,646.6 against
the ticket's about 1,480; at most 44.4 h may double count with breakdowns; lost hours may include non-CNC machines. Staging is the Cosmos tenant without the 2022-2025 history (69d).

## Tracker and waiting on people

Tracker: https://claude.ai/artifact/5Kc9KrYMwnW9EK1UvmA9JJ, `datasets/tickets`, refresh half-hourly, never edit the page file.
Waiting on Nimish: which way is good for PM hours, breakdown hours with no downtime, manpower hours and spend (all "neither" now); staging history
(re-upload the four zips BD-22..BD-25; real data stays out of the repo); downtime family colour vs attention orange; Energy heat shading replaced by a chart (#484);
Monthly/Annual as shell tabs or one tab with a switch (#481); no change shown on Team Focus (#479). `docs/plan/NEEDS.md`: N16 answered (Bhavin, 19 Nov); N17 older files
open (Bhavin, Nimish); N18 technician ranking, N19 AI thresholds open (Nimish); N20 purge open, not blocking (Nimish); N5 Gujarati: a native reader signs off, and Nimish rules whether analytics must be Gujarati.
