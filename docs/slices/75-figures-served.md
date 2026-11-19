# 75 Figures are served, not recomputed

Ticket 75, stage E. Goal: a figures read answers in 300 ms or less (p95) on a 10,000-row plant with 30 readers, and
the engine runs only from `POST /analytics/run`, the nightly job and a refresh after a change. Frozen interfaces
below; each packet is one acceptance assertion, one PR. Order: 75a, then 75b to 75f. 76 (engine reads many years) is
merged first; no packet here edits `packages/domain/src/analytics` except 75e.

## What was measured (19 Nov, local Postgres 16, 150 machines, 10,000 invented closed tickets and 10,000 reports, 2022 to 2026)

| Step                                           | Before 75a          | After 75a                           |
| ---------------------------------------------- | ------------------- | ----------------------------------- |
| `GET /analytics/figures`, first read of a date | 57 s                | 61 s (computes once, keeps the run) |
| Same read again                                | 56 s                | 0.45 to 0.52 s                      |
| 30 readers at once on a kept run               | not run (30 x 57 s) | p50 7.6 s, p95 13.6 s               |
| `loadEngineData` alone / the stamp query       | 0.10 s / none       | 0.15 s / 0.011 s                    |

The first number is the engine (`run`), which 75e takes down. The last rows are the finding that changes the plan:
the reply is **19.3 MB** here. Four figures hold 99 % of it (`a10-problems` 6.9 MB, `data-checklist` 4.6 MB,
`breakdown-log` 1.2 MB, `machine-page` 0.5 MB; the other 47 together under 0.4 MB). Reading, parsing and sending
19 MB takes about 0.5 s on its own, and 30 of them queue on one Node thread, so a kept run alone cannot reach 300 ms
at 10,000 rows. The fork (a smaller reply per screen versus a faster pipe) was settled by this run, not by argument:
75b slims the reply.

## The design

**One kept run per plant and date, in `kpi_snapshot`; no migration, no new table (D17).** The table's own purpose is
"every calculated number" (DATA-MAP, Figure row). The kept run is one row: profile `served`, key `figures-run`, subject
`plant`, `as_of` = the date asked, `value` = `{ stamp, result }` where `result` is the whole `EngineResult` (drill ids,
`rows`, `excludedMachines`, profile). A new table was rejected: nothing here needs a column the row lacks, and a
second store of "figures" is the duplicate D17 forbids. Per-figure rows (what `POST /run` writes today) were rejected
as the served form: they lose each figure's `screen`, `owner` and `drill`, so the reply could not be rebuilt from them.
Money filtering stays at the reply: the stored result is whole and is never returned unfiltered (every read, the one
that computes included, goes through the reply's filter; a test reads as a supervisor on a miss). Two roles read the
same row.

**Frozen interface** (`apps/server/src/modules/analytics/served.ts`, module-private for 75a; 75d exports it):
`servedRun(tx, { tenantId, asOf, compute }): Promise<EngineResult>` and `dataStamp(tx, tenantId): Promise<string>`.
The reply shape and routes do not change (`figuresReplySchema`, no new route, route count unchanged).

**Invalidation: a stamp of the data, compared on every read.** The stamp is, for each table the loader reads
(`STAMPED_TABLES`: person, login, segment, machine, machine_move, shift, ticket, breakdown_report,
breakdown_report_person, list_item, pm_plan, asset_register, setting), its row count, its newest row
version's `xmin` and the SUM of all its row versions' `xmin`, plus the plant's name and time zone and the build (the
commit when `GIT_COMMIT` is a full SHA, else the process start, so a restart never serves an older build's run). The
maximum alone is not commit-ordered: a transaction that took its id early and commits late writes a version below the
newest one, so the maximum stays put; an update always replaces the row's old id, so the sum moves (a test holds two
transactions open to prove it). Remaining limit: a collision of two different states with equal count, maximum and
sum, which needs a contrived mix of ids and is not guarded. The stored row is served only when its stamp equals the
current one, read after the row so a write that commits in between is never served over.

| Change                                                                     | What moves the stamp                                         |
| -------------------------------------------------------------------------- | ------------------------------------------------------------ |
| A ticket is closed, edited or cancelled                                    | `ticket` (and `breakdown_report` for its report)             |
| A machine is switched (cell, category, scrapped) or moved                  | `machine`, `machine_move`                                    |
| The 77a production flag (`machine.metadata.excludedFromProduction`)        | `machine`                                                    |
| A settings change (profile, nudge ack, lists, shifts, PM plans, registers) | `setting`, `list_item`, `shift`, `pm_plan`, `asset_register` |
| A person is renamed, erased or a login changes (the redactor reads them)   | `person`, `login`                                            |
| The plant's name or time zone changes                                      | the tenant's name and zone                                   |
| A deploy changes the engine                                                | `GIT_COMMIT`                                                 |
| The day rolls over                                                         | a new `as_of`: no kept run for it                            |

Rejected: hooks at each writer (a missed hook is silent stale figures; 12 of the 18 `UPDATE ticket` statements in the
server do not touch `updated_at`, so that column cannot be the stamp either); a plain 5-minute expiry (the engine
re-runs inside a read every 5 minutes, and a settings change shows up late). A guard test makes the table list
honest: it records the tables `loadEngineData` queries and fails when one is not in `STAMPED_TABLES`.

**First read, nothing kept (75a):** the read takes a per-plant-and-date advisory lock, looks again, computes once,
keeps the run and answers. A burst of readers on a stale date runs the engine once; the rest wait on the lock and
are served the run saved while they waited, even if a write has moved the stamp past it (otherwise each waiter would
compute in turn and hold a connection); the next read sees the moved stamp. The stamp is read before the data, so a write during the compute leaves the kept stamp
behind and the next read recomputes (never serves a run that misses a committed write). A plant keeps its newest 8
dates; each save drops the rest in a fixed order, skipping rows another reader holds (no deadlock), and a failed drop
never fails the read.

## Packets

**75a Serve the kept run (this PR).** Assertion: a read serves the same figures a fresh compute gives, without
running the engine (the test counts `run` calls: 0 on the second read, 0 for another role, 1 for 12 simultaneous
reads), and runs it once after a closed ticket, an edit, a machine move, the production flag or a profile change.
Files: `served.ts`, `routes.ts`, `analytics-served.test.ts`. Red: `pnpm exec vitest run apps/server/test/analytics-served.test.ts`
(the second read computes). Green: the same command.

**75b The reply carries what the screen asks for.** Assertion: `GET /analytics/figures?keys=a,b` answers only those
figures (unknown key: 422 naming `keys`), and the default reply leaves the four heavy figures' row lists to be asked
by key. A kept run is one `jsonb` column, so the read picks the asked figures in SQL and never parses the rest. Files:
`served.ts`, `routes.ts`, `packages/shared/src/analytics.ts` (query schema), then the web screens that read those four
(frontend lane, asked first). Red/green: `vitest run apps/server/test/analytics-served-keys.test.ts`.

**75c A read never computes.** Assertion: a test counts 0 `run` calls inside any `GET /analytics/figures`; a ticket
closed now is in the served figures within 5 minutes. The read serves the newest kept run for the date even when the
stamp moved; a `figures.refresh` job (pg-boss, singleton per plant) recomputes when the stamp moved, every minute
at most, at plant midnight for the new day, and `POST /run` stores the same row. A plant with no kept run for today
is answered by the one inline compute of 75a (the only read that computes) until the nightly job exists for it.
Files: `jobs.ts`, `served.ts`, `routes.ts`, one test. Red/green: `vitest run apps/server/test/analytics-served-job.test.ts`.

**75d Everything reads the same run.** Assertion: the workbook, both report PDFs and the drill read `servedRun`'s row,
counted by `run` calls. Files: drill in `routes.ts`, the report routes' loaders, one test.

**75e One full run is 20 s or less.** Assertion: `run` on the 10,000-row fixture takes at most 20 s (30.5 s at 13,500
rows today; the forecast simulation is about 60 %). Files: `packages/domain/src/analytics/a9-forecast-sim.ts` and
its callers, after 76. Red/green: a timed test on the fixture, `vitest run packages/domain/test/engine-scale.test.ts`.

**75e result (20 Nov, local, no database).** Timed on the committed plant, `packages/domain/test/scale-plant.ts` (150
machines, 10,000 closed reports, 1,500 follow-up jobs, 300 open tickets, 300 moves, a PM plan per machine; `run` as of
2026-11-11). A full `run` went from 7.1 s to 1.95 s with byte-identical output (sha256 prefix `03722ae3d2c5e806` both
times). By figure group, in ms (before to after): forecast lab 4,600 to 1,400; backlog 540 to 12 (its age walk asked
the same local-midnight question for every open ticket); every other figure together 1,250 to 730 (`plantDay`,
`dayNumber`, the report-to-ticket join and the quantile sorts were each repeated per figure or per month; now
remembered once). `engine-scale.test.ts` holds the 20 s limit and a test that the engine runs on a deep-frozen copy
of its input (the join is kept per report list, so no figure may edit the rows it is given). On this plant the engine
is far under the 20 s goal, so the 57 s of the table above was not the engine's own arithmetic on this shape of data:
the real loader's rows (long problem texts, many open tickets) are not reproduced here, so the first read of
75b/75f must be re-timed on the Postgres plant. Next biggest costs, in order: the forecast lab's 1,000-draw
simulation (about 0.7 s: 4 methods x 52 months x 150 machines, its draw order is pinned so it cannot be skipped, only
made cheaper), the sort of each machine-month's 1,000 sims (0.3 s: a selection of three ranks would do), the Knuth
Poisson draw (0.2 s), then `a10-problems` (0.15 s).

**75f The proof.** Assertion: 30 concurrent readers on 10,000 rows, p95 at most 300 ms
(`apps/server/test/figures-scale.test.ts`, shaped like `state-scale.test.ts`). Also closes MILESTONES 75 goals 1 to 3.

## Risks

A stamp that misses a table the loader later reads: the guard test. A kept row of 1 to 2 MB per plant and date: bounded
by the 7-day prune. A reader on the lock holds a pool connection while the engine runs (about 12 s at 10,000 rows):
75c removes the wait by serving the older run.
