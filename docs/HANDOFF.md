# Where things stand — handoff for the next orchestrator session

Read this first, then the tail of `docs/plan/ledger.md`, then "Road to v1" in `docs/plan/MILESTONES.md`.
`git log origin/main` beats this text where they differ. State: night of 19 Nov 2026, after #484.
Open PRs via `gh api --method POST repos/nimishshah1989/argus/pulls --input <file.json>`, non-draft. Staging deploys on every merge: `https://cosmos.3-108-95-203.sslip.io/api/v1/health` shows the commit it serves.

## How to work (Nimish: non-technical, wants short plain answers, to be challenged, uncertainty flagged)

- Never ask him a technology question; run something to settle it. Technical questions for Bhavin: a short plain
  list; Nimish forwards it on WhatsApp.
- Builders: Agent tool, sonnet, worktree; resume the same builder for its own PR; give each the brief
  (rules for PR body, `pnpm lint`, `pnpm format:check`, `pnpm precheck` before EVERY push, `Large PR:` and `Tests removed:` lines).
- Merge squash with `expectedHeadSha` only after READING the check runs of the CURRENT head.

## Rulings (Nimish)

Earlier: Running grey, Waiting amber, Transferred blue; Indian number grouping; AI work paused (55, 72, 68); power and
air failures count in plant downtime (91); heads see failed jobs (78c); supervisors get an Analytics link (86b).
Night of 19 Nov: "build all the pages and get them live", staging only, no production stack. Floor and desk stay on
Bhavin's v3 flow (only colour, type, depth, motion change). The approved analytics design (Instrument look, white
field, functional motion) is the showcase and wins over DESIGN.md's earlier motion text for analytics.

## Frontier

- Merged 19 Nov night: 85 templates (#473), 83 elements (#474), 83b (#475), 83c-1 (#478), Today (#476), fix (#477),
  and 87 pages: Action Center, checklist, Team Focus (#479), Money (#480), Reports (#481), Breakdown Log, registers,
  machine page (#482), forecast and Forecast Lab (#483), Energy (#484).
- Left in 87: PM calendar and keyboard Move to date, Guide, the other analytics group screens, the `ui:check` guard.
  Then 83d (shared-element gaps), 83c-2 (move the showcase tile, heat map, trend, Pareto onto shared elements; report
  the dark heat-map shift), 75b/c/d/f, 69d, 77b/78b restyle, 88, 89, 90, 92-96.
- Follow-ups, one line each in the ledger: `screen-state.tsx` `empty` required; pager nav name; spares caption;
  Today's monthly sparkline needs a field; shared search palette (87); nightly validate workflow; failed-jobs alarm;
  DESIGN.md changes should run the api shards; `ui/sheet.tsx` dark scrim and `floor-pieces.tsx` TAP contrast 4.15:1;
  day-boundary flakes and `sla-timers.test.ts` deadlocks; jsdom ADR for hook tests; prior-date figures endpoint;
  machine page prints spares and PM hours twice; the engine fetches the whole plant per drill chunk.

## Open numbers (do not state as final)

History vs Bhavin's sheets (`docs/plan/evidence/69c-real-load.md`): of 2,084 machine-months, 1,561 (75%) match raw and
1,855 (89%) with his counting rules; 229 unexplained until he answers. Plant-event hours are a LOWER BOUND; 2023 is
1,646.6 against the ticket's about 1,480. Staging is the Cosmos tenant without the 2022-2025 history (69d).

## Waiting on Nimish

- Which way is good for PM hours, breakdown hours with no downtime, manpower hours and spend (all "neither" now).
- Staging history: re-upload the four workbook zips BD-22..BD-25 (real data must not go into the repo).
- Downtime family colour vs attention orange; the heat shading on Energy replaced by a chart (#484).
- Monthly and Annual as shell tabs or one tab with a switch (#481); no change shown on Team Focus (#479).
  Tracker: https://claude.ai/artifact/5Kc9KrYMwnW9EK1UvmA9JJ. `docs/plan/NEEDS.md`: N16-N20 wait on others.
