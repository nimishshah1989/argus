# Where things stand — handoff for the next orchestrator session

Read this first, then the tail of `docs/plan/ledger.md`, then "Road to v1" in `docs/plan/MILESTONES.md`.
`git log origin/main` and the PR list beat this text where they differ. State as of 13:50 UTC, 19 Nov 2026.

## How to work (Nimish: non-technical, wants short plain answers, to be challenged, uncertainty flagged)

- Never ask him a technology question; settle it by running something. Ask product questions only.
- No whole-suite local runs, no comprehensive reviews. Builders run only the tests they touch; CI runs the rest.
- Builders: Agent tool, `poteto-agent`, sonnet, worktree. Checks: opus, one narrow independent check only where a
  wrong number, data loss, auth or tenancy bug is possible. Never review your own work.
- Merge squash with `expectedHeadSha` when CI is green on the CURRENT head and nothing blocks. Infra flakes (apt
  mirror 503, `migration-runner` timing) get one rerun.
- Open PRs with `gh api --method POST repos/nimishshah1989/argus/pulls --input <file.json>` (title, head, base, body;
  `gh pr create` is blocked); CI runs on non-draft only.
  Run `pnpm lint` as well as `pnpm precheck`. New routes need their reply in `packages/shared/src/replies.ts`.
- Cubic reviews every push: verify each finding, fix valid ones in the builder's first push, decline wrong ones
  on the thread. A "minor" suggestion that changes behaviour can break CI: test it.
- Server tests need local Postgres 16 (`/usr/lib/postgresql/16/bin`) and `TEST_PG_URL` (localhost only).

## Rulings (Nimish, 19 Nov)

Running grey, Waiting amber, Transferred blue; Indian number grouping; analytics follows system dark/light; floor
and desk keep Bhavin's flow, analytics is redesigned freely. AI work paused (55, 72, 68). Production hardening
(97, 98, 26–28) only when it slows nothing. Weekly staging dump parked. Real data already in the public repo is an
accepted development risk; add no more. Purge it or make the repo private before cutover (N20). Staging deploys on every merge: `https://cosmos.3-108-95-203.sslip.io/api/v1/health`.
Bhavin: Star-01 = S-1, Star-02 = S-2 (bare "Star" sheet kept out and counted); retired TC-2, VC-2, VC-3, VC-5 left
out of history; out of production figures: TC-5, TC-3, VC-6 (only three given); MEC becomes M, ELE becomes E.

## Frontier

- Merged today: 76 (all), 80a–80r, 80t showcase (#448), 78a (#447), 74, 69 plan, 69a importer (#449).
- Merged since: #449 (69a), #451 (69b converter), #452 (77a machines out of production data, API and engine). Nothing of mine is open.
- Next backend: 69c (load four years into a LOCAL Postgres, run the engine per year, compare the workbooks' own
  MTTR/MTBF sheets; adds list entries location 'Plant' and workType 'Utility failure' first), 75 (figures served,
  not recomputed), 79 (`validate:full`), 69d staging load after 79, 77b/78b screens after templates, 90–96 after.
- Frontend: Nimish judges the showcase (https://claude.ai/artifact/MuBThrzeXCNPsKbuXVPLQx); then the navigation
  map, then templates 81–89 in bulk. 80e/80f need his go for one CLAUDE.md line.
- NIMISH MUST RE-UPLOAD the four workbook zips (BD-22..25) before 69b/69c real-file runs. Counts only may enter the repo.

## Tracker

Artifact https://claude.ai/artifact/5Kc9KrYMwnW9EK1UvmA9JJ, dataset `datasets/tickets` (blob `tickets.json`): refresh
half-hourly from merged commits and PRs; do not edit the page file.

<<<<<<< HEAD

## Parked

=======
**Waiting on people (`docs/plan/NEEDS.md`):** N17 February–March 2022, any 2020–21 files, and the 2023 and 2024 workbooks
placed with the others outside git; N18 the ranking method (54); N19 AI thresholds; N5 Gujarati sign-off; N10 the
security reviewer; N15 usability sessions; N7 the production account; N20 (not blocking).

> > > > > > > origin/main

CI downloads fonts on every browser/gallery run (use the prebuilt Playwright image); 78b: reply schema uses
`isoDateTimeSchema` for `createdAt`/`failedAt`; check in 69c whether `recordedMonths` counts plant events; converter
pseudonyms are unsalted hashes (files stay outside git, D21).

## Waiting on people (`docs/plan/NEEDS.md`)

N16 Bhavin's answers (bare Star sheet, more out-of-production machines), N17 Feb–Mar 2022 and older files, N18
ranking method, N19 AI thresholds, N5 Gujarati, N20 purge-or-private before cutover.
