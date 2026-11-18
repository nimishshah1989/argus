# M4b-52 — Forecast freeze and inspections (ticket 52)

Ticket 52, `docs/plan/MILESTONES.md:452-455` (blocked by 46, merged): `engine.freeze` on the 1st writes one `forecast`
row per machine; after the month the outcome is scored into the same row (fake clock); a Hot machine raises one
inspection ticket per run and its closed outcome is stored on the forecast row; an accepted nudge becomes a linked
ticket. Two packets are figures and writes, one is a route: **no product code in this plan**, three PRs, one writer
each.

Authority: **D17** (`forecast` is the M4b table, `docs/decisions/D17-table-budget.md:17`; `forecast_outcome` is removed
into columns, `:39`), **migration 0015** (`forecast` columns `packages/db/migrations/0015_m4b_schema.sql:84-101`, the
write-once grant `:198`, the two planned channels `:29-31`), **DATA-MAP** (`forecast` row `docs/DATA-MAP.md:106`), 46b's
raise seam (`apps/server/src/modules/tickets/planned.ts:46-104`) and 46a's channel policy
(`packages/shared/src/channel.ts:7-12`). D17 supersedes any sentence elsewhere that names `forecast_outcome`.

## What exists, and what does not

- The A9 planning forecast is a pure figure: `forecastBoard(core, episodes, FC_RUNS)` (`a9-forecast-sim.ts:270-297`)
  simulates 2,000 seeded runs and fills `expN`, `p1`, `expH`, `p80`, `p90`, `pLong`; the page prints them through
  `forecastRow`/`forecastKpis` (`a9-forecast.ts:239-302`) and derives the band and confidence from `bandOf`/`confidenceOf`
  (`a9-forecast.ts:151-156`). Its horizon is `nextMonth(core.to)` (`a9-forecast-sim.ts:254-260`) — the first full month
  after the **last breakdown**, not the calendar.
- **No job exists.** `engine.run`/`engine.freeze` are named in `docs/ARCHITECTURE.md:87,116` but never built; the only
  `forecast`/`kpi_snapshot` writers are the HTTP route `POST /analytics/run` (`apps/server/src/modules/analytics/routes.ts:174-196`)
  and its `snapshotStore` (`snapshot.ts:33-40`). There is **no in-process event bus**: `machine.hot`
  (`docs/ARCHITECTURE.md:110`) is emitted nowhere (`grep machine.hot` finds only docs). 52 therefore raises the
  inspection ticket directly through `tickets.raisePlannedTicket`; see R9.
- A planned raise is `kind: 'stopped'` today (`planned.ts:62,67`). A stopped ticket takes the machine's **one open
  breakdown slot** (`ticket_open_breakdown_unique`, `packages/db/migrations/0009_history_cannot_be_lost.sql:197`), shows
  on the live board (`apps/server/src/modules/tickets/repo/board.ts:38`) and, if it ever carried a report, would count in
  A9 (`a9-forecast-sim.ts:31-34` has no source filter). See R10.

## The loop, frozen

| When                             | Trigger         | What it does                                                                                                                                    | Writes                                                                                           |
| -------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| daily 00:10 UTC, acts on the 1st | `engine.freeze` | if the current plant month has no rows: compute the A9 M0 forecast **as of the month's 1st** and insert one row per production machine          | `forecast` × machines, one `forecast.freeze` audit                                               |
| daily 00:40 UTC                  | `engine.run`    | score every closed month that is unscored or still inside its first 7 days, then raise the missing inspections for the current month's Hot rows | `forecast.outcome`/`scored_at`, `ticket` (inspection), `forecast.score`/`inspection.raise` audit |
| on a person's accept             | HTTP (no job)   | `POST /analytics/action-center/nudges/{key}/ticket` raises one inspection ticket for the nudge's machine and resolves the nudge                 | `ticket`, the nudge's `setting` row, `nudge.accept` audit                                        |

`engine.run` does **not** write `kpi_snapshot` in this ticket (R14); the daily figure series and its 90-day purge stay
37d's remaining piece (D31; the follow-up is recorded in the fragment).

## Frozen interfaces

```ts
// packages/domain/src/analytics/a9-forecast-sim.ts (additive; forecastBoard delegates and stays byte-identical)
export type ForecastBand = 'Hot' | 'Likely' | 'Watch' | 'Stable';
export type ForecastConfidence = 'High' | 'Medium' | 'Low';
export function bandOf(expH: number): ForecastBand; // moved here from a9-forecast.ts:155, threshold 6/3/1
export function confidenceOf(n: number, days: number): ForecastConfidence; // moved from a9-forecast.ts:151
export function monthAt(plantDate: string): Month; // {label:'December 2026', days:31} for '2026-12-01'
export function forecastBoardFor(
  core: BottleneckCore,
  episodes: Map<string, Episode[]>,
  runs: number,
  month: Month,
): ForecastBoard; // forecastBoard(core, episodes, runs) === forecastBoardFor(core, episodes, runs, nextMonth(core.to))
```

```ts
// packages/domain/src/analytics/forecast-freeze.ts (new)
export const FORECAST_MODEL = 'a9.m0.1';
export interface FrozenPrediction {
  days: number; // the frozen month's calendar length
  expN: number; // expected breakdowns (episodes) in the month
  expH: number; // expected breakdown hours in the month
  p1: number; // chance of at least one breakdown
  p80: number; // plan-for: hours the machine stays under 4 months in 5
  p90: number; // worst case: hours it stays under 9 months in 10
  pLong: number; // chance of a long (8 h+) breakdown
  band: ForecastBand;
  confidence: ForecastConfidence;
  hoursProfile: { prodHrsPerDay: number; workDaysPerYear: number }; // the two numbers the model read
}
export interface FrozenForecast {
  machineId: string;
  predicted: FrozenPrediction;
}
/** One row per production machine, in fleet order; [] when the plant has no production breakdown. */
export function frozenForMonth(
  data: EngineData,
  profile: { prodHrsPerDay: number; workDaysPerYear: number },
  month: string, // 'YYYY-MM-01', or a RangeError
  runs?: number, // FC_RUNS
): FrozenForecast[];

export interface InspectionOutcome {
  ticketId: string;
  ref: string;
  status: Status; // open | working | waiting | closed | cancelled
  closeKind: 'report' | 'no_report' | 'done' | null;
  closedAt: string | null; // ISO instant
}
export interface ForecastOutcome {
  hours: number; // effective hours of production, non-PM reports dated in the month
  episodes: number; // merged episodes that began in the month
  hit: boolean; // hours <= predicted.p80, exact (no tolerance)
  inspection: InspectionOutcome | null;
}
export function monthActuals(
  data: EngineData,
  month: string,
): Map<string, { hours: number; episodes: number }>;
export function outcomeFor(
  predicted: FrozenPrediction,
  actual: { hours: number; episodes: number },
  inspection: InspectionOutcome | null,
): ForecastOutcome;
```

```ts
// apps/server/src/modules/tickets/planned.ts (46b's seam, extended)
export interface PlannedTicketInput {
  // … unchanged …
  kind?: 'stopped' | 'general'; // default 'stopped'
  source?: { nudge?: string; forecast?: string }; // written on the raise event's payload as {source}
}

// apps/server/src/modules/tickets/repo/analytics.ts → tickets/index.ts
export interface RaisedTicket {
  id: string;
  ref: string;
  status: string;
  closeKind: string | null;
  closedAt: Date | null;
}
/** The ticket whose raise event carries {source:{<kind>: id}}, for each id (one query for the batch). */
export function raisedTicketsFor(
  tx: Db,
  tenantId: string,
  kind: 'nudge' | 'forecast',
  ids: string[],
): Promise<Map<string, RaisedTicket>>;
```

Job payloads (zod, the `notify.send` shape `apps/server/src/modules/notifications/jobs.ts:12-17`):
`{ v: z.literal(1), tenantId: z.string().uuid().optional() }` for both queues; the schedule enqueues `{v: 1}` and the
handler iterates `jobTenantIds(pool)` (`apps/server/src/modules/identity/repo.ts:367-370`, `0010_retention_support.sql:39-46`)
when no tenant is named.

## Rulings (frozen; cost if wrong)

**R1 — The row set is A9's production fleet.** A9's core is `data.machines.filter(isProduction)` (`a9-bottleneck.ts:149-178`;
`isProduction` = CNC and not Robot/excluded, `machine-facts.ts:4-5`), so the freeze writes **exactly one row per
production machine** — 125 on the frozen 11 Nov key (`packages/domain/test/a9-value.test.ts:84`), no status or history
filter (a scrapped machine keeps its rows and scores 0 hours). _Cost if wrong: a handful of dead rows per month, or one
row missing for a machine the plant counts._

**R2 — `predicted` holds the raw model numbers, never printed strings.** The keys of `FrozenPrediction` above, computed by
the same `modelOf`/`simulate` (`a9-forecast-sim.ts:161-186,220-244`) the A9 table prints. `band` and `confidence` are
stored because they are the frozen judgement the inspection reads; `days` and `hoursProfile` make the row reproducible
after a profile edit. No `run_id`: D17 removed `engine_run` and 52 writes no `kpi_snapshot`, so the row's provenance is
`as_of` + `profile` + `model` + the data at `as_of`. _Cost if wrong: 53 re-derives a definition from raw numbers; adding a
key later is additive._

**R3 — The horizon is the month that starts on the freeze day, not `nextMonth(core.to)`.** `monthAt` supplies
`{label, days}`; a `month` that is not the 1st is a `RangeError`. The A9 page keeps its own horizon (the month after the
last breakdown). On a normally busy plant the two agree on the 1st; on a plant quiet for over a month the page names an
older month than the frozen one. _Cost if wrong: on such a plant the page and the frozen row disagree by a month; one
paragraph in the Guide._

**R4 — The observation window stays A9's.** The forecast is computed on `dataAsOf(data, month)` (so the ticket/report cut
is the month's 1st, `as-of.ts:22-38`) but the model's window still ends at the **last breakdown** on or before that day
(`periodOf`, `a9-bottleneck.ts:113-119`). Closing the window at `asOf` would be a second model and would make the frozen
row disagree with the page on every day the plant is quiet. _Cost if wrong: quiet months are over-forecast, so more
inspections than strictly needed; changing it is one line in a later model ticket, and the frozen rows keep their own
numbers._

**R5 — The freeze is a no-op after the first success, never a replace.** `INSERT … ON CONFLICT (tenant_id, machine_id,
month) DO NOTHING` (`forecast_tenant_machine_month_unique`, `0015:99`); `predicted` is never updated (the column grant,
`0015:198`, and its proof `packages/db/test/m4b-schema.test.ts:292-307`). A second run inserts nothing, writes **no audit
line** and leaves `frozen_at`/`predicted` byte-identical. _Cost if wrong: a bad forecast cannot be corrected in the app;
a later ticket adds a controlled re-freeze (delete + insert as the owner, audited)._

**R6 — `engine.freeze` runs daily and freezes the current plant month iff it has no rows.** That is the 1st's behaviour
and the catch-up in one rule: a missed 1st is frozen on the 2nd (or any later day of that month) with **`as_of` = the
month's 1st**, so the numbers are the ones the 1st would have produced. A plant with no production breakdown yields no
rows and is recomputed cheaply each night. Cron `10 0 * * *` UTC; for a plant west of UTC that lands up to ~24 h after
local midnight, with the right `month`. _Cost if wrong: a late freeze is backdated to the month's first day (by design);
one cheap query per tenant per day._

**R7 — The freeze's writes are one statement and one audit line per tenant.** `frozen_at` = the run's instant (written
explicitly, so a fake-clock test pins it); `profile` = `'legacy'` (the only stored profile name, `snapshot.ts:8`); `model`
= `FORECAST_MODEL`; `as_of` = `month`. Audit: `forecast.freeze`, entity `forecast`, entity_id null, `before` null,
`after {month, rows}`. _Cost if
wrong: a new audit area in the trail, one label._

**R8 — The outcome is scored into the same row, on a fixed calendar.** `engine.run` scores a month on the first run whose
plant date is after the month's end (the 1st), and **re-scores it nightly through the 7th** (the plant's own no-report
grace is 7 days, `apps/server/src/modules/tickets/repo/list.ts:77`), then never again. `scored_at` is the time of the last
write. The scorecard (53) therefore reads a month only from the 8th. _Cost if wrong: a report or an inspection closed
after the 7th is missed for that month; a longer window is one constant and delays the scorecard._

**R9 — Hot means the frozen forecast band, read from the row, never recomputed.** `predicted.band === 'Hot'`
(`bandOf`: expected hours ≥ 6, `a9-forecast.ts:155-156`) for the **current plant month**. The A9 _risk rating_
(Critical/High/Watch/Low, `a9-bottleneck.ts:194-206`) is a different figure and raises nothing. There is no `machine.hot`
event (no bus exists); the run calls `tickets.raisePlannedTicket` in its own tenant transaction. A machine that becomes
Hot after the freeze gets no inspection this month, by design (the frozen row is the thing scored), and the row stays
authoritative if the machine is excluded from production later — only a scrapped machine is skipped (R11). _Cost if
wrong: a mid-month Hot machine waits for the next freeze; wiring an event bus is a separate decision._

**R10 — The inspection ticket is `kind: 'general'` (WR- ref).** A stopped ticket would occupy the machine's one open
breakdown slot (`0009…:197`), block a real breakdown raise (`repo/list.ts:121-124`, `outcome.ts:32-34`) and switch-off (`tickets/index.ts:48-53`), and appear on the
live board (`repo/board.ts:38`). A general ticket is a work request: it is hidden from the board, has no report form
(the app closes a general ticket with "Mark done" and hides the no-report close, `apps/web/src/components/actionSpecs.ts:93-102,115-121`), and never
reaches a figure. `raisePlannedTicket` gains `kind` (default `'stopped'`; **49 decides PM's kind** — an open PM job would
block a breakdown the same way). _Cost if wrong: inspections live in the work-request list rather than the breakdown
list; one word to change._

**R11 — One inspection per frozen row, ever.** Dedupe by the raise event's `{source:{forecast: rowId}}` (R16), not by
machine and month: a cancelled or closed inspection counts, so the engine never re-raises. The run takes
`pg_advisory_xact_lock(hashtext('engine.inspection:' || tenantId))` before reading, so two workers serialise and the
second sees the first's ticket (the pattern at `repo/ticket.ts:329`). At most one raise per Hot machine per run and 125
rows per month at worst. An inspection raised from a nudge (R17) is a different reason and **does not** satisfy this
dedupe: a Hot machine whose nudge was accepted can carry both tickets that month. _Cost if wrong: a cancelled
inspection is not retried; reopen is a person's manual raise._

**R12 — The inspection's closed outcome maps ticket fields one-to-one.** `id→ticketId`, `ref→ref`, `status→status`,
`close_kind→closeKind`, `closed_at→closedAt`. **Nothing else is copied**: no problem text, no note, no person — the
`forecast` row is pseudonymous per DATA-MAP (`docs/DATA-MAP.md:106`) and free text can carry names. Recorded at scoring
time (R8), so an inspection still open on the 7th is stored `open` with `closeKind`/`closedAt` null. _Cost if wrong: the
scorecard cannot say what the inspection found beyond its close state; a structured finding needs its own decision._

**R13 — `hit` is `outcome.hours <= predicted.p80`, exactly, no tolerance.** `hours` = Σ `effectiveHours` over the
production, non-PM reports dated in the month (`fleetRows`, `a9-forecast-sim.ts:31-34`; NO-DT counts 0, `rows.ts:39-42`);
`episodes` = merged episodes whose **first** day is in the month (`episodesOf`, `a9-forecast-sim.ts:37-63`), so a
month-boundary episode counts once, in the month it began. 53's hit rate = hits ÷ rows whose `outcome` is not null. The
plan-for is a line a calibrated model should exceed about 1 machine-month in 5, so a high hit rate can mean a conservative model; the
Forecast Lab's pinball/coverage stays the accuracy measure (`forecast-lab-sim.ts:340-394`). _Cost if wrong: one boolean
definition; 53 prints a less useful number._

**R14 — No `kpi_snapshot` write, no plant-level row.** `forecast.machine_id` is NOT NULL (`0015:87`), and the plant's
plan-for percentiles (438.37/518.55 on the key) are not recoverable by summing machine rows, so 52 does not freeze them.
53's forecast section is the per-machine hits and outcomes; a plant plan-for line is 53's own scope (it would need one
`kpi_snapshot` row written at freeze). _Cost if wrong: one extra insert in the freeze plus a key, if the gate wants the
plant line._

**R15 — A month with no data is still scored.** Rows exist but the plant had no breakdown: `hours 0`, `episodes 0`,
`hit true` (0 ≤ p80). A forecast row is never skipped for lack of data — skipping would read as "unscored" to 53. When
the freeze wrote **no rows** (no production breakdown history at all, R1/R6), there is nothing to score and 53 says "no
forecast for this month". _Cost if wrong: a quiet month counts as a hit; the scorecard's wording explains it._

**R16 — The nudge link is the ticket's raise-event payload: `ticket_event.payload.source.nudge`.** `ticket` has no source
column and 0015 is the milestone's one migration (D17). `raisePlannedTicket` writes `{source:{nudge:<key>}}` (or
`{forecast:<rowId>}`) on the `down` event through `persistEvents`' existing `payloadFor` (`repo/ticket.ts:193-229`), and
`tickets.raisedTicketsFor` (SQL over `ticket_event`/`ticket`, in the tickets repo that owns both tables) reads it back.
Rejected: `NudgeAck.ticketId` in the nudge's `setting` row — reopen **deletes** that row (`analytics/nudges.ts:145-168`,
44's plan `docs/slices/44-action-center.md:202-207`), so the link would vanish, and the inspection dedupe needs the same
seam; a `ticket.source_nudge_id` column is a migration this ticket may not add. _Cost if wrong: the Action Center card
needs one extra read to show its ticket (the function is already published); a future column backfills from the payload in
one statement._

**R17 — An accepted nudge raises one inspection ticket and resolves the nudge, once.** `POST
/api/v1/analytics/action-center/nudges/{key}/ticket`, body `{machineId?}` (uuid, strict). The nudge must name a machine:
when it names one, `machineId` may be omitted; when it names several, `machineId` is required (422 on `machineId`); a
machine not in the nudge is 422; a nudge naming no machine (shift/team/good, and hum/spike name machines) is 422; an info
nudge is 409 (`conflict`, "Good news has nothing to raise", field `key`); an unknown key is 404. Any current non-info nudge
is accepted whatever its ack status (a resolved or snoozed nudge can still become a ticket; the link check comes first).
The raise is `channel:'inspection'`, `kind:'general'` (R10), problem = the nudge's title, `reportedByPersonId` = the
acting person (nullable), `raisedLoginId` = the login, `at` = the database's now. It also writes the ack `done` with
`owner`, `due` and `note` empty (the resolve's own record, `nudges.ts:72-83`) and one audit line `nudge.accept` (entity
`ticket`, id = the new ticket, `before` = the existing ack or null, `after {key, ticketId, ref, ack}`). It is idempotent **for the key's lifetime**: an existing linked ticket returns
`{ticketId, ref, created:false}` without a second write, under `pg_advisory_xact_lock(hashtext('nudge-accept:' || tenantId
|| ':' || key))`. Reopen does not reset the link (the ticket stays the one for that nudge instance). _Cost if wrong: a
recurring nudge instance gets one ticket, and a new one after reopen needs a manual raise._

**R18 — Jobs: two queues, worker role only, UTC, per-tenant transactions, aggregated errors.** `startEngineJobs(boss,
{pool, now?}, role)` creates `engine.freeze`/`engine.run` for every role (an `api` replica never works them) and schedules
both in UTC (`10 0 * * *`, `40 0 * * *`), the shape of `retention.ts:125-159`. Each pass per tenant is its own
`withTenant` transaction, so a failing tenant does not lose another's work; the job collects errors and throws an
`AggregateError` at the end (pg-boss retries once, and every pass is idempotent). A job's `now` is an argument (the fake
clock), guarded against a clock over 24 h from the database's — the guard moves from `retention.ts:75-82` into
`kernel/jobs.ts` and both callers share it. `AUDIT_AREAS` gains `forecast` (`packages/shared/src/audit.ts:9-28`) with its
label (`i18n/audit.en.ts`; gu is `blank(auditEn)`). _Cost if wrong: one label and one enum word; the guard move touches
retention but changes no behaviour (its suite proves it)._

**R19 — Parity: nothing flips; the PR carries the reason.** 52 is not a v3 screen or calculation: the freeze, the
scoring and the inspection loop do not exist in the platform, and the planning forecast's parity row
(`m4a.a9-bottleneck-forecast`) is already `done` (`docs/spec/parity.yaml:1415-1429`). The four stale `analytics.forecasting.*`
rows (M4, `parity.yaml:1106-1144`) duplicate `m4a.a9-bottleneck-forecast`/`m4a.forecast-lab` and stay as they are — a
milestone-gate ledger cleanup, recorded in the fragment, not an attribution 52 can make. Every PR here states
`No parity: the freeze, scoring and inspection loop are not in the v3 platform; the planning forecast's row is already done.`
_Cost if wrong: one stale ledger row survives one milestone longer._

## Packet 1 — the freeze (one PR)

**Files.** `packages/domain/src/analytics/a9-forecast-sim.ts` (`monthAt`, `forecastBoardFor`, `bandOf`/`confidenceOf`
moved in; `forecastBoard` delegates — its output is unchanged), `packages/domain/src/analytics/a9-forecast.ts` (imports
the two moved helpers), `packages/domain/src/analytics/forecast-freeze.ts` (new: `FORECAST_MODEL`, the prediction types,
`frozenForMonth`), `packages/domain/src/analytics/index.ts` (exports),
`packages/domain/test/analytics-forecast-freeze.test.ts` (new), `apps/server/src/modules/analytics/repo/forecast.ts`
(new: `monthFrozen`, `insertForecasts`), `apps/server/src/modules/analytics/freeze.ts` (new: `runEngineFreeze`,
`freezeTenant`), `apps/server/src/modules/analytics/jobs.ts` (new: `startEngineJobs`, the freeze queue),
`apps/server/src/modules/analytics/index.ts` (exports), `apps/server/src/index.ts` (start the jobs),
`apps/server/src/kernel/jobs.ts` + `apps/server/src/retention.ts` (the clock guard moves, R18),
`packages/shared/src/audit.ts` + `packages/shared/src/i18n/audit.en.ts` (`forecast`), `docs/ARCHITECTURE.md` (the job
payload row `:116` becomes `v`, `tenantId`; the analytics paragraph `:215` gains the loop and the no-`machine.hot`
sentence; the `pm` row `:88` loses "inspection tickets"), `docs/DATA-MAP.md:106` (the outcome keys and the 8th),
`apps/server/test/forecast-freeze.test.ts` (new), `changes/52-forecast-freeze.md` (new).

**The write.** `freezeTenant` reads `loadEngineData`/`readProfile` in the same transaction and calls
`frozenForMonth(data, profile, month)`. One `INSERT … SELECT` from `jsonb_to_recordset` (the `snapshot.ts:17-25` shape)
into `(tenant_id, machine_id, month, as_of, profile, model, predicted, frozen_at)` with
`ON CONFLICT (tenant_id, machine_id, month) DO NOTHING`, `frozen_at` = the run instant, one `forecast.freeze` audit line
when the statement inserted rows. `monthFrozen` runs first and returns before `loadEngineData` when the month has a row.

**Acceptance — Given/When/Then.**

- **G** the answer-key `ENGINE_DATA` and `DEFAULT_PROFILE`, **W** `frozenForMonth(data, profile, '2026-12-01')`, **T**
  125 rows in fleet order; WJ-01 is `{days: 31, expN: 1.5467071634579725, expH: 6.091584054818952, p1: 0.6073360870269124,
p80: 12.02, p90: 19.86, pLong: 0.245637461502746, band: 'Hot', confidence: 'High', hoursProfile: {prodHrsPerDay: 20,
workDaysPerYear: 300}}`; the plant has exactly one Hot machine (WJ-01). (Numbers pinned by the planner with the current
  code; the plant's expected hours are 193.746…, which the A9 KPI prints 193.7.)
- **G** the same data, **W** the A9 and Forecast Lab figures are computed, **T** their values are unchanged from the key
  (`packages/domain/test/a9-value.test.ts`, `analytics-forecast-lab.test.ts` green untouched) — the day-count refactor is
  behaviour-preserving.
- **G** `monthAt('2026-12-01')`, **T** `{label:'December 2026', days:31}`; `monthAt('2027-02-01')` →
  `{label:'February 2027', days:28}`; `monthAt('2026-12-02')` → `{label:'December 2026', days:31}` (it answers for the
  date's month); **W** `frozenForMonth(data, profile, '2026-12-02')`, **T** a `RangeError` (a frozen month is its 1st).
- **G** a plant with no production breakdown, **W** `frozenForMonth`, **T** `[]`.
- **G** the fixture tenant (`A`, `M_USED` with one closed breakdown), **W** `runEngineFreeze(f.db.app, {now:
new Date('2026-12-01T00:30:00Z'), tenantId: A, allowFakeClock: true})`, **T** one `forecast` row for `M_USED` with
  `month = '2026-12-01'`, `as_of = '2026-12-01'`, `profile = 'legacy'`, `model = 'a9.m0.1'`, `frozen_at` = the given
  instant, and one `audit_log` row `forecast.freeze` with `after.rows = 1`.
- **G** that row, **W** the freeze runs again an hour later, **T** still one row, `predicted`/`frozen_at` identical, no
  second audit line, and `result.frozen = 0`.
- **G** tenant `A` moved to `America/New_York`, **W** `now = 2027-01-01T00:30:00Z` (plant date 2026-12-31), **T** no row
  for 2027-01; **W** `now = 2027-01-02T05:30:00Z` (plant date 2027-01-01), **T** the 2027-01 rows exist with
  `as_of = '2027-01-01'`.
- **G** a tenant with no production breakdown history, **W** the freeze, **T** no rows and no audit line.

**Red/green.** Red: `pnpm exec vitest run packages/domain/test/analytics-forecast-freeze.test.ts` and
`pnpm exec vitest run apps/server/test/forecast-freeze.test.ts` (module/function absent). Green: both, then
`pnpm exec vitest run packages/domain/test` (the A9/FL keys), `pnpm exec vitest run apps/server/test/analytics-engine.test.ts`,
`pnpm exec vitest run apps/server/test/retention-jobs.test.ts` (the moved guard), `pnpm boundaries`, `pnpm precheck`.

## Packet 2 — scoring and the inspection run (one PR)

**Files.** `packages/domain/src/analytics/forecast-freeze.ts` (+ `monthActuals`, `outcomeFor`, the outcome types),
`packages/domain/src/analytics/index.ts` (the new exports and `formatNumber` — it is not exported today, and the ticket's
problem text prints through it), `packages/domain/test/analytics-forecast-freeze.test.ts` (extended),
`apps/server/src/modules/tickets/planned.ts` (`kind`, `source`, `payloadFor`), `apps/server/src/modules/tickets/repo/analytics.ts`
(`raisedTicketsFor`), `apps/server/src/modules/tickets/index.ts` (export), `apps/server/src/modules/analytics/repo/forecast.ts`
(+ `pendingMonths`, `rowsForMonth`, `saveOutcomes`, `hotRows`, `hotRaises`), `apps/server/src/modules/analytics/run.ts`
(new: `runEngineRun`, `scoreTenant`, `inspectTenant`), `apps/server/src/modules/analytics/jobs.ts` (the run queue),
`apps/server/test/forecast-loop.test.ts` (new), the fragment.

**The two passes.** Score: `pendingMonths` = `month < date_trunc('month', $today)` and (`scored_at IS NULL` or
`$today <= month + 1 month + 6 days`); one `loadEngineData` per tenant, one `raisedTicketsFor(…, 'forecast', ids)` per
month, one `UPDATE … FROM jsonb_to_recordset` setting only `outcome`/`scored_at` (the only columns the grant allows),
then one `forecast.score` audit line `{month, rows, hits}` (entity `forecast`, entity_id null). Inspect: the advisory
lock, `hotRows` for the current month,
`raisedTicketsFor`, one `plant.machinesByIds` for the machines' codes, one `raisePlannedTicket` per unlinked Hot row
(`PlannedRaiseError` — a scrapped unknown machine — is skipped, not retried), one `inspection.raise` audit line
`{month, refs}` when it raised. Problem text, pinned:
`${code} is Hot for ${label}: plan for ${formatNumber(p80, 1)} hrs` (`WJ-01 is Hot for December 2026: plan for 12.0 hrs`).

**Acceptance — Given/When/Then.**

- **G** the key fixture, a freeze at `2026-11-01` and the full data, **W** `monthActuals(data, '2026-11-01')`, **T**
  WJ-01 = `{hours: 12.02, episodes: 1}` and the plant totals 58 reports / 51.06 hrs over 42 episodes; **W**
  `outcomeFor(predicted(WJ-01 at the November freeze), actual, null)`, **T** `{hours: 12.02, episodes: 1, hit: false,
inspection: null}` (`p80` was 10.17); the November freeze's plant is 121 hits of 125.
- **G** a frozen month `2026-11`, **W** `runEngineRun` with `now = 2026-12-01T00:30:00Z` (plant date 2026-12-01), **T**
  every row has an `outcome` and `scored_at` = that instant, one `forecast.score` audit line; **W**
  `now = 2026-12-04T00:30:00Z` after a late report, **T** the same row's `outcome.hours` grew and `scored_at` moved;
  **W** `now = 2026-12-08T00:30:00Z` after another late report, **T** the row is unchanged.
- **G** a month whose rows exist and no breakdowns, **T** `{hours: 0, episodes: 0, hit: true, inspection: null}`; **G**
  no rows for the month, **T** nothing is written and no `forecast.score` line.
- **G** tenant `A` in `America/New_York` with November frozen and `now = 2026-12-01T00:30:00Z` (plant date 2026-11-30),
  **T** November is not scored (the month has not ended on the plant's clock); **W** `now = 2026-12-01T05:30:00Z`
  (plant date 2026-12-01), **T** it is scored.
- **G** a Hot frozen row — on the server fixture this is made by seeding twelve 12-hour closed breakdowns for `M_USED`
  in the 30 days before the fake freeze, the December freeze has run, and the domain test is what pins exact numbers
  (here only the band is asserted) — **W** `runEngineRun` with `now = 2026-12-02T00:30:00Z`, **T** exactly one ticket with
  `raised_channel = 'inspection'`, `kind = 'general'`, a `WR-` ref, `machine_id = M_USED`, problem
  `VC-01 is Hot for December 2026: plan for <that row's predicted.p80, 1 dp> hrs` (the test reads `p80` from the row
  rather than guessing it), and its `down` event payload `{source:{forecast:<row id>}}`; one `inspection.raise` audit line.
- **G** the same run a night later, **T** still one ticket; **G** that ticket cancelled, **T** still one.
- **G** the inspection is closed through the app's own close (`{kind:'done'}`) on 2026-12-03, **W** the December score
  on 2027-01-04, **T**
  `outcome.inspection = {ticketId, ref, status:'closed', closeKind:'done', closedAt:'2026-12-03T…'}`.
- **G** a Likely row and a Hot row of another tenant, **T** neither raises; **G** a Hot machine scrapped before the run,
  **T** it is skipped and the job does not fail.

**Red/green.** Red: `pnpm exec vitest run packages/domain/test/analytics-forecast-freeze.test.ts apps/server/test/forecast-loop.test.ts`.
Green: both, `pnpm exec vitest run apps/server/test/m4b-write.test.ts` (the raise seam's defaults unchanged),
`pnpm exec vitest run apps/server/test/sla-timers.test.ts` (a planned ticket still takes no clock),
`pnpm exec vitest run packages/domain/test`, `pnpm boundaries`, `pnpm precheck`.

## Packet 3 — the accepted nudge (one PR)

**Files.** `packages/shared/src/action-center.ts` (`nudgeAcceptSchema`, `nudgeTicketReplySchema`),
`packages/shared/src/replies.ts` (the new route's schema), `apps/server/test/reply-contract.test.ts` (the literal 137 →
138; the equality assertion is untouched), `apps/server/src/modules/analytics/nudges.ts` (the POST route: `nudgeFor`
becomes the pure lookup and the info 409 moves to the two callers), `apps/server/test/nudge-accept.test.ts` (new), the
fragment.

**The route.** `POST /api/v1/analytics/action-center/nudges/:key/ticket`, `canAnalytics` (supervisor+) and the raise
permission (`canRaise`: everyone but board, `permissions/ticket.ts:17-19`), in one `withTenant` transaction: board at the
plant's today, `nudgeFor` (404), info 409, the advisory lock, `raisedTicketsFor(…, 'nudge', [key])` (found → 200
`created:false`), machine choice and refusals (R17), `raisePlannedTicket` with `source:{nudge:key}`, the ack `done`, the
`nudge.accept` audit line, reply `{ticketId, ref, created:true}`.

**Acceptance — Given/When/Then.**

- **G** the fixture's live `freq|M_USED` nudge (44c's own test builds it, `analytics-nudges.test.ts:31-32,44-62`), **W** a
  supervisor POSTs `{}`, **T** 200 `{ticketId, ref, created:true}`; one ticket with `raised_channel='inspection'`,
  `kind='general'`, `machine_id = M_USED`, problem = the nudge title, its `down` event payload
  `{source:{nudge:'freq|<M_USED>'}}`; the `nudge:freq|…` setting row is `done`; one `nudge.accept` audit line.
- **G** the same POST again, **T** 200 `{created:false}`, the same `ticketId`, no second ticket, no second audit line.
- **G** a nudge naming two machines (a `cell` key), **W** POST `{}`, **T** 422 `machineId`; **W** POST
  `{machineId: <a machine of another nudge>}`, **T** 422 `machineId`; **W** POST `{machineId: <one of the two>}`, **T**
  200 and the ticket names that machine.
- **G** a `team` nudge (no machine) **T** 422; **G** an info nudge **T** 409; **G** an operator **T** 403; **G** a key that
  names no current nudge (404) and a key of another tenant (404).

**Red/green.** Red: `pnpm exec vitest run apps/server/test/nudge-accept.test.ts` (404, no route). Green: it,
`pnpm exec vitest run apps/server/test/analytics-nudges.test.ts` (the moved info 409 and the write routes),
`pnpm exec vitest run apps/server/test/reply-contract.test.ts` (138 routes, every one with a reply schema),
`pnpm exec vitest run apps/server/test packages/db/test packages/domain/test`, `pnpm precheck`.

## Parity

No row flips (R19). Each PR's description carries
`No parity: the freeze, scoring and inspection loop are not in the v3 platform; the planning forecast's row is already done.`
The four `analytics.forecasting.*` rows stay `todo` with the gate-time cleanup recorded in the fragment.

## Rails

- **No migration, no table** beyond D17 (0015 is the milestone's one schema change); `forecast`'s only new writer is
  `repo/forecast.ts`; the write-once grant is never exercised (no `UPDATE predicted`, no `DELETE`).
- **No new dependency.** One writer per packet, packets in order 1 → 2 → 3. Red first; never delete, skip or weaken a
  test. File ≤ 400 lines, function ≤ 60: `nudges.ts` 214 → ~285, `a9-forecast-sim.ts` 297 → ~312, `a9-forecast.ts` 355 →
  ~350, `planned.ts` 105 → ~120, `repo/analytics.ts` 32 → ~70, `routes.ts` untouched; the new files are well under.
- **Tenancy:** every write inside `withTenant`; `jobTenantIds` for the iteration; RLS unchanged; no query without the
  tenant predicate. `forecast` is pseudonymous (R12).
- **Audit:** four actions (`forecast.freeze`, `forecast.score`, `inspection.raise`, `nudge.accept`), `AUDIT_AREAS` gains
  `forecast`; the engine's lines carry no login (the app shows "System", `settings/Audit.tsx:75`).
- **Docs:** ARCHITECTURE's job payloads and analytics paragraph, DATA-MAP's forecast row, this plan and the fragment. Do
  not add `forecast`/`kpi_snapshot` to the manifest's `OWNERS` here (it would force `load.ts`/`snapshot.ts` into `repo/`;
  recorded as a follow-up).
- The covering suite for every packet: the named files, `pnpm exec vitest run apps/server/test packages/db/test packages/domain/test`,
  `pnpm boundaries`, `pnpm precheck`; `main:check` after each merge (the orchestrator's job).

## What the reviewer should attack

1. **R3/R4 together**: does the frozen month + the stale observation window give a forecast the plant would trust? The
   numbers in packet 1's first acceptance line are the whole answer to "what is frozen"; recompute them independently.
2. **R8's 7-day window** against 53's timing: is the 8th acceptable for the scorecard, and is a 7-day grace the right
   number (the plant's own no-report list uses 7)?
3. **R10**: is a `general` (WR-) ticket the right home for an inspection, and does that leave 49's PM jobs blocking the
   open-breakdown slot (R10's note)?
4. **R16**: the payload link over the `setting` row — reopen deletes the ack, but a screen may want the link where the ack
   is. Attack the query cost (no index on `ticket_event.payload`) and the one-ticket-per-key-forever rule.
5. **R13**: `hit = hours <= p80` on a light month gives ~97% hits (121/125 in November on the key data) — is that the
   scorecard number the product wants, or should it be the plant in-band line?

## Not in this ticket

No screen (the Action Center accept button and the forecast card are a later frontend ticket), no PM generation (49), no
scorecard (53), no intervention runner (54), no daily `kpi_snapshot` series (37d's remainder), no `machine.hot` bus, no
re-freeze correction path (R5), no model change (the Lab's M1–M3 remain the Lab's).
