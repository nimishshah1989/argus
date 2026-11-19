# 52 — forecast freeze and inspections

**This fragment is written by the planning pass; each packet appends its own evidence (red/green command tails, the
covering suite, deviations) as it lands.** The plan is `docs/slices/52-forecast-freeze.md` (`plan/52`, one commit).

**What changes for a user (the whole ticket, in one paragraph).** On the 1st of each month the plant's planning forecast
is frozen: one row per production machine, holding the A9 model's own numbers — the expected breakdowns and hours, the
chance of at least one, the plan-for (80%) and worst-case (90%) hours, the chance of a long one, the risk band, the
confidence and the month's length. A week after the month ends the row is scored with what actually happened (hours,
episodes, whether the plan held, and the inspection ticket's close), and it never changes again; the monthly scorecard
(53) reads those rows. A machine the frozen forecast called **Hot** gets one inspection ticket, raised by the nightly
run, never more than one per machine per month; the ticket's close (done or cancelled, and when) is stored on the
forecast row. A supervisor who accepts an Action Center nudge gets one inspection ticket linked to that nudge, and the
nudge is resolved.

**The rulings frozen by the plan** (each with its cost-if-wrong in the plan): the row set is A9's 125-machine production
fleet (R1); `predicted` holds raw numbers, not printed strings (R2); the horizon is the calendar month that starts on the
freeze day, while the observation window stays A9's last-breakdown window (R3, R4); the freeze is a no-op after the first
success and never rewrites `predicted`, so the 0015 column grant holds (R5); `engine.freeze` runs daily and acts when the
plant's current month has no rows, backdated to the month's 1st (R6); the outcome is scored on the 1st and re-scored
through the 7th, then final (R8); **Hot** is the frozen forecast band, read from the row — not the A9 risk rating — and
there is no `machine.hot` event because no bus exists (R9); 46c already makes every planned ticket a `general` (WR-)
work request, so the inspection never takes a machine's one open-breakdown slot or the live board and 52 adds nothing to
the kind (R10); one inspection per frozen row, ever, deduped by the ticket's raise-event source and serialised by an
advisory lock (R11); the closed outcome maps ticket id/ref/status/close_kind/closed_at and copies no text or person
(R12); **hit = actual hours ≤ the frozen plan-for**, exactly (R13); no `kpi_snapshot` write and no plant-level row
(R14); a month with no breakdowns is still scored, with 0 hours and a hit (R15); the nudge link lives in
`ticket_event.payload.source.nudge` on the raise event, not in the nudge's setting row (reopen deletes it) and not in a
new column (D17), read by a narrowed unindexed jsonb filter whose index is a recorded follow-up (R16); accept raises one
inspection ticket, resolves the nudge, audits once and is idempotent for that nudge key forever (R17); two UTC pg-boss
queues, worker role only, per-tenant transactions with aggregated errors (R18).

**What the packets will prove (the plan's acceptance, not yet run).** Packet 1: `frozenForMonth` pins 125 rows and
WJ-01's exact December numbers (`expH 6.091584054818952`, `p80 12.02`, `p90 19.86`, band Hot) on the frozen key data,
the A9/Forecast Lab keys stay byte-identical, a second freeze is a no-op, and the plant-time boundary is proven with an
`America/New_York` tenant. Packet 1 also lands the first two public names and pins them in D2 (`registry.test.ts`), as
packet 2 does for its three. Packet 2: the November freeze scores WJ-01 at `12.02 h / 1 episode / hit false` against a
`p80` of 10.17, a late report inside the 7-day window corrects the row and one after the 7th does not, a Hot row raises
exactly one `inspection` ticket (`kind general`, `WR-`, its raise event carrying `{source:{forecast:<row id>}}`), a
second night raises none, the ticket's `done` close is stored on the forecast row, and `inspectionProblem` pins the
ticket's words. Packet 3: the live `freq` nudge accepts into one linked ticket with the nudge resolved (`created:true`,
then `created:false` for the same ticket), and the multi-machine, no-machine, info, role and tenant refusals.

**No parity:** the freeze, the scoring window and the inspection loop do not exist in the v3 platform; the planning
forecast's own row `m4a.a9-bottleneck-forecast` is already done (`docs/spec/parity.yaml`). The four stale
`analytics.forecasting.*` rows (M4) duplicate the two `m4a` forecast rows and stay as they are — a milestone-gate ledger
cleanup, recorded here so it is not lost.

**Docs and seams this plan amends.** `docs/ARCHITECTURE.md`: the job payload row for `engine.run`/`engine.freeze` becomes
`v`, `tenantId` (the plant date is derived per tenant from the plant clock, not enqueued); the analytics paragraph gains
the freeze/scoring/inspection loop and says `machine.hot` is not emitted (no bus: the run calls
`tickets.raisePlannedTicket`); the `pm` module row loses "inspection tickets". `docs/DATA-MAP.md`: the `forecast` row
gains the outcome keys and the eighth-of-the-month finality.

**The 53 hand-off (frozen in the plan).** Forecast rows are final from the 8th of the following month; `hit` is
`hours <= plan-for`, so the rate is plan-for exceedance ("machines that stayed inside their plan"), **not** model
accuracy — the Forecast Lab's pinball/coverage stays the accuracy statement; unscored rows are out of the denominator; a
quiet month scores 0 and a hit; there is no plant-level forecast row; and `outcome.inspection` is the ticket's close, not
a finding.

**Follow-ups recorded, not done here.** (1) The daily `kpi_snapshot` series and its 90-day purge are 37d's remainder
(52 writes no figures). (2) `apps/server/src/modules/manifest.ts` still lists no `analytics` tables though the module
writes `kpi_snapshot` and now `forecast`; adding them forces `load.ts`/`snapshot.ts` under `repo/`, so it is its own
ticket. (3) A partial expression index on `ticket_event` for `(tenant_id, payload->'source'->>'forecast')` (and the nudge
twin) in the next migration that owns one: the payload link is an intentional narrowed scan until then (R16), upgraded
when a plant's `down` events pass ~50k or the batch read passes ~50 ms. (4) The Action Center card grows an "accept"
button (and can show the linked ticket) in the later frontend ticket; 52 ships the route only.

## Packet 1 (52a) — the freeze

**What landed.** `packages/domain/src/analytics/forecast-freeze.ts` (new): `FORECAST_MODEL`, `FrozenPrediction`,
`FrozenForecast` and `frozenForMonth` — the plant as it stood on the month's 1st, A9's own observation window, the
month's own calendar, one row per production machine in fleet order. `a9-forecast-sim.ts` gains `monthAt`,
`forecastBoardFor`, `bandOf` and `confidenceOf`; `forecastBoard` now delegates to
`forecastBoardFor(core, episodes, runs, nextMonth(core.to))`, so its output is unchanged (the A9 and Forecast Lab keys
stay byte-identical). `packages/domain/src/analytics/index.ts` publishes the two runtime names and the four frozen
types; `monthAt`/`forecastBoardFor`/`bandOf`/`confidenceOf` stay deep imports, and D2 pins the two new keys.
`apps/server/src/modules/analytics/repo/forecast.ts` (new) is the one writer: `monthFrozen` is the freeze's first read,
and `insertForecasts` is one `INSERT … SELECT` from `jsonb_to_recordset` into `(tenant_id, machine_id, month, as_of,
profile, model, predicted, frozen_at)` with `ON CONFLICT (tenant_id, machine_id, month) DO NOTHING`, `as_of` = the
month, `profile = 'legacy'`, `model = FORECAST_MODEL`, `frozen_at` = the run's instant. `freeze.ts` (new) owns
`engine.freeze` (`freezeTenant`, `runEngineFreeze`): the plant's own current month, catch-up with `as_of` the month's
1st, one `forecast.freeze` audit line `{month, rows}` only when rows were inserted, per-tenant transactions,
aggregated errors, and the shared 24-hour clock guard. `jobs.ts` (new) creates `engine.freeze` for every role and,
away from `api`, works it and schedules `10 0 * * *` UTC; `apps/server/src/index.ts` starts it. `AUDIT_AREAS` gains
`forecast` (`audit.area.forecast` = "Forecast"; gu stays blank). `docs/ARCHITECTURE.md` and `docs/DATA-MAP.md` carry
the amendments the plan froze.

**Red first (the failing assertions, not weakened tests).**

```
$ pnpm exec vitest run packages/domain/test/analytics-forecast-freeze.test.ts
TypeError: frozenForMonth is not a function
 Test Files  1 failed (1)

$ pnpm exec vitest run apps/server/test/forecast-freeze.test.ts
Error: Cannot find module '../src/modules/analytics/freeze.js'
 Test Files  1 failed (1)

$ pnpm exec vitest run packages/domain/test/registry.test.ts   # export in, literal not yet
-    "figures",
+    "frozenForMonth",
     "handbackConfirm",
 Tests  1 failed | 2 passed (3)
```

**Green.**

```
$ pnpm exec vitest run packages/domain/test/analytics-forecast-freeze.test.ts
 ✓ … (10 tests)

$ pnpm exec vitest run apps/server/test/forecast-freeze.test.ts
 ✓ … (6 tests)

$ pnpm exec vitest run packages/domain/test/registry.test.ts
 ✓ … (3 tests)

$ pnpm exec vitest run packages/domain/test
 Test Files  45 passed (45)
      Tests  502 passed (502)

$ pnpm exec vitest run apps/server/test/analytics-engine.test.ts apps/server/test/retention-jobs.test.ts
 Test Files  2 passed (2)
      Tests  26 passed (26)

$ pnpm boundaries
boundaries: 231 files scanned, 0 problem(s)

$ pnpm exec tsc --noEmit
(no output)

$ pnpm exec vitest run packages/domain/test apps/server/test
 Test Files  1 failed | 185 passed (186)
      Tests  1 failed | 2128 passed (2129)
   # the only failure is state-scale.test.ts: p95 356.1 ms against the 300 ms budget on the
   # loaded 25-minute run (17 test files plus shared local containers); alone it is 93.3 ms.

$ pnpm exec vitest run apps/server/test/state-scale.test.ts
 ✓ state p95 93.3 ms, median 65.1 ms over 40 calls (green)

$ pnpm precheck
precheck: OK — 17 file(s) checked by prettier, 13 checks passed
```

The pinned freeze, on the frozen 11 November key: 125 rows in fleet order, exactly one Hot (WJ-01) and the row
`{"days":31,"expN":1.5467071634579725,"expH":6.091584054818952,"p1":0.6073360870269124,"p80":12.02,"p90":19.86,"pLong":0.245637461502746,"band":"Hot","confidence":"High","hoursProfile":{"prodHrsPerDay":20,"workDaysPerYear":300}}`;
the plant's expected hours are `193.7460706225213` (the A9 KPI prints 193.7). The freeze's server acceptance covers
the December rows and `after.rows = 2` (the fixture's production fleet is VC-01 and VC-02), the second run's no-op,
the write-once grant, the America/New_York month boundary, a missed 1st frozen on the 20th as of the 1st, a quiet
plant (no rows, no audit line) and the clock guard refusing a >24 h fake clock without writing.

**Deviations (each recorded, none weakening a rail).**

1. **The clock guard was already moved.** R18 planned to move `retention.ts`'s local guard into `kernel/jobs.ts`; 51b
   had already done it (`kernel/jobs.ts:24`, retention and `register.due` share it), so 52a only consumes
   `assertClockNearDatabase` and changes no existing behaviour. Retention's suite is green untouched.
2. **The server fixture's production fleet is two machines**, not one: VC-01 (`M_FREE`) and VC-02 (`M_USED`) are both
   CNC, so the December freeze writes two rows. R1 (one row per production machine) still holds; the plan's
   "one row for M_USED" is the row that exists, and `after.rows = 2` is the fixture's count, not a change to the rule.
3. **`runEngineFreeze(pool, options)`** takes the pool first, matching the plan's packet-1 acceptance call
   (`runEngineFreeze(f.db.app, {now, tenantId, allowFakeClock: true})`); the other nightly jobs keep their `deps`
   object, so this one seam is deliberately per the frozen acceptance.
4. **The write-once grant is asserted through the app role** (`UPDATE … SET predicted` → `permission denied`) as well
   as by 0015's own proof; 52a never issues an `UPDATE predicted` or a `DELETE`.

No new table, no migration, no new dependency; every file is under 400 lines. **No parity:** the freeze, the scoring
window and the inspection loop do not exist in the v3 platform; the planning forecast's own row
`m4a.a9-bottleneck-forecast` is already done.

## Packet 2 (52b) — the outcome, the score and the inspection run

**What landed.** `packages/domain/src/analytics/forecast-freeze.ts` gains the outcome half: `monthActuals(data,
month)` (the production, non-PM reports dated in the month, by `effectiveHours`, and the merged episodes whose first
day is in it — a month-boundary episode counts its hours where they fell but its one episode in the month it began),
`outcomeFor(predicted, actual, inspection)` (`hit = hours <= predicted.p80`, exactly) and `inspectionProblem({code,
month, p80})`, whose words are pinned: `WJ-01 is Hot for December 2026: plan for 12.0 hrs`. The `InspectionOutcome`
and `ForecastOutcome` types are the plan's frozen shapes and `formatNumber` stays off the root. `analytics/index.ts`
publishes the three runtime names and D2 pins `inspectionProblem`, `monthActuals` and `outcomeFor` (type-only exports
need no line). `apps/server/src/modules/analytics/repo/forecast.ts` gains `pendingMonths` (closed on the plant's clock
and either unscored or `today <= month + 1 month + 6 days`), `rowsForMonth`, `hotRows` (the current month's
`predicted->>'band' = 'Hot'`, read from the row, never recomputed) and `saveOutcomes` (one
`UPDATE … FROM jsonb_to_recordset` writing only `outcome` and `scored_at`, the two columns the 0015 grant allows).
`apps/server/src/modules/tickets/repo/analytics.ts` gains `raisedTicketsFor(tx, tenantId, kind, ids)`: one narrowed
query over `ticket_event`/`ticket` for `type = 'down'` events whose `payload.source.<kind>` is in the batch,
`DISTINCT ON` the source key, the latest raise first; `planned.ts` gains the one `source` field, written on the `down`
event's payload as `{source:{nudge|forecast: id}}` and nothing else changes (kind `general`, `WR-`, no new column).
`apps/server/src/modules/analytics/run.ts` (new) owns `engine.run`: `scoreTenant` (one `loadEngineData` per plant,
one `raisedTicketsFor` per month, one statement and one `forecast.score` line `{month, rows, hits}` per month) and
`inspectTenant` (the `engine.inspection:<tenantId>` advisory lock, the current month's Hot rows, their links, one
`machinesByIds` for the codes, one `raisePlannedTicket` per unlinked row, one `inspection.raise` line `{month, refs}`),
both per-tenant transactions with aggregated errors and the shared clock guard. `jobs.ts` creates and schedules
`engine.run` at `40 0 * * *` UTC beside `engine.freeze` (both queues for every role, workers off `api`). No
`kpi_snapshot` write and no plant-level row.

**Red first** (the packet's source reverted, its tests in place — the missing names and the D2 literal).

```
$ pnpm exec vitest run packages/domain/test/analytics-forecast-freeze.test.ts \
    apps/server/test/forecast-loop.test.ts packages/domain/test/registry.test.ts
 FAIL  packages/domain/test/analytics-forecast-freeze.test.ts [ … ]
 TypeError: monthActuals is not a function
 FAIL  apps/server/test/forecast-loop.test.ts > the scoring pass > …
 TypeError: pendingMonths is not a function
 FAIL  packages/domain/test/registry.test.ts > domain registries > D2: the public API is unchanged
 -   "inspectionProblem",
 -   "monthActuals",
 -   "outcomeFor",
 Test Files  3 failed (3)
      Tests  10 failed | 2 passed (12)
```

**Green.**

```
$ pnpm exec vitest run packages/domain/test/analytics-forecast-freeze.test.ts \
    apps/server/test/forecast-loop.test.ts packages/domain/test/registry.test.ts
 Test Files  3 passed (3)
      Tests  33 passed (33)

$ pnpm exec vitest run packages/domain/test apps/server/test
 Test Files  194 passed (194)
      Tests  2253 passed (2253)

$ pnpm exec vitest run apps/server/test/m4b-write.test.ts apps/server/test/sla-timers.test.ts
 Test Files  2 passed (2)
      Tests  18 passed (18)      # 46c's WR-/general and same-machine breakdown raise, no edit to that file

$ pnpm exec tsc --noEmit
(no output)

$ pnpm boundaries
boundaries: 235 files scanned, 0 problem(s)
```

The pinned numbers, on the frozen 11 November key: `monthActuals(data, '2026-11-01')` gives WJ-01
`{hours: 12.02, episodes: 1}` and the plant `51.06` hours over 42 episodes from 58 November reports; the November
freeze's plan-for for WJ-01 is `10.17`, so `outcomeFor` is `{hours: 12.02, episodes: 1, hit: false, inspection:
null}`, and the plant is 121 hits of 125. The server acceptance runs the whole calendar: a November row scored on
1 December (0 h / 0 episodes / hit true on a quiet month), a late report growing it on the 4th, a second late report
changing nothing from the 8th, the America/New_York boundary (1 December 00:30 UTC does not score November; 05:30 UTC
does), three frozen Hot December rows raising two inspection tickets (`kind general`, `WR-`, `raised_channel
inspection`, problem `VC-02 is Hot for December 2026: plan for … hrs`, the `down` event carrying `{source:{forecast:<row
id>}}`), a scrapped Hot machine skipped without failing the job, the same run a night later raising none, a cancelled
inspection still counting, the link read back through `raisedTicketsFor`, the done close stored on the December row at
the January score, no `kpi_snapshot` row — and one `forecast.score`/`inspection.raise` audit line where the plan says.

**Deviations (each recorded, none weakening a rail).**

1. **A test-only third machine on the fixture.** The acceptance needs a Hot row scrapped before its inspection run, and
   the shared fixture has two production machines (one raised, one cancelled in the same run). `forecast-loop.test.ts`
   seeds `M_EXTRA` / `VC-03` on plant A for that one branch; no product code, fixture or rail changes.
2. **`hotRaises` is not a separate repo function.** The packet's file list names `hotRows` and `hotRaises`, but the
   frozen interface puts the link read in `tickets.raisedTicketsFor`, and the score needs the month's rows. The repo
   therefore adds `pendingMonths`, `rowsForMonth`, `saveOutcomes` and `hotRows`; a `hotRaises` would be `hotRows` +
   `raisedTicketsFor` under another name.
3. **The inspection's machine code is read from the row, not assumed.** The packet's acceptance words say `VC-01`; on
   the shared fixture `M_USED` is `VC-02` (`VC-01` is `M_FREE`), which 52a already recorded. The test reads the code and
   the `p80` from the database and asserts the real sentence.
4. **The close is the app's own path and starts the ticket first.** A `general` ticket open on nobody cannot be closed
   (the state machine answers "Ticket is not being worked on"), so the test has a supervisor start the inspection and
   then mark it done — the app's own flow. The HTTP close stamps the database's now, so the test asserts
   `outcome.inspection.closedAt` equals the ticket's stored `closed_at` rather than a fake date.
5. **Two tenant transactions per run.** Scoring and inspecting are separate `withTenant` transactions (R18's per-pass
   rule), so a failing inspection never loses the night's scoring; `runEngineRun` aggregates errors exactly as the
   freeze does and is idempotent on every pass.
6. **`ForecastActual` is a module type, not a root export.** The public type list stays the plan's (`ForecastOutcome`,
   `InspectionOutcome`); `monthActuals`/`outcomeFor` keep their frozen signatures (the same shape, named for the
   implementation).

`inspection.raise` names entity `forecast`, entity id null and no login (the engine's lines are "System" in the trail),
like `forecast.freeze`/`forecast.score`; the mutation is still the ticket's, written through the tickets seam.

No new table, no migration, no new dependency; every file is under 400 lines. **No parity:** the freeze, scoring and
inspection loop are not in the v3 platform; the planning forecast's own row `m4a.a9-bottleneck-forecast` is already
done.

## Packet 3 (52c) — the accepted nudge

**What landed.** `POST /api/v1/analytics/action-center/nudges/:key/ticket` (R17): one `withTenant` transaction reads
the board at the plant's today, refuses an unknown key (404), a good-news nudge (409, "Good news has nothing to
raise", field `key`), then takes `pg_advisory_xact_lock(hashtext('nudge-accept:<tenantId>:<key>'))` and reads the
link through `tickets.raisedTicketsFor(…, 'nudge', [key])` (R16) — an already-linked nudge answers that same ticket
with `created:false` and writes nothing. Only then is the machine chosen: a nudge naming one machine needs no body, a
nudge naming several needs `machineId` from its own list (422 on `machineId` for a missing, foreign or non-uuid
choice), and a nudge naming no machine (a shift/team card) is a 422 on `key`. The raise is
`tickets.raisePlannedTicket` unchanged (kind `general`, `WR-`, channel `inspection`, problem = the nudge's title,
`reportedByPersonId` = the acting person, `raisedLoginId` = the caller) with `source:{nudge:key}`, which the seam
writes on the raise event's `payload.source`; the nudge's `setting` row is written `done` with `owner`/`due`/`note`
empty, and one `nudge.accept` line names entity `ticket`, the new ticket, `before` = the existing ack or null and
`after {key, ticketId, ref, ack}`. Reply: `{ticketId, ref, created}`.

`packages/shared/src/action-center.ts` (141 → 165) adds `nudgeAcceptSchema` (strict `{machineId?: uuid}`) and
`nudgeTicketReplySchema`; `packages/shared/src/replies.ts` (239 → 240) registers the route's reply.
`apps/server/src/modules/analytics/nudges.ts` (214 → 329) gains `acceptNudge`, `machineFor` and the POST route, and
`nudgeFor` becomes the pure lookup: the good-news 409 moves to its two old callers (worded "acknowledge") and to the
accept (worded "raise"), so 44c's suite stays green untouched. The accept takes `canAnalytics` and `canRaise` (the
board login is refused by the first; `canRaise` is the plan's second gate). No screen: the Action Center already
renders the board, and the card's accept button (and its linked ticket) is the recorded frontend follow-up.

**Red first** (the packet's route absent, its test in place).

```
$ pnpm exec vitest run apps/server/test/nudge-accept.test.ts
 ❯ apps/server/test/nudge-accept.test.ts (9 tests | 8 failed) 2034ms
   × accepts the live freq nudge into one inspection ticket linked by its raise event 19ms
     AssertionError: expected 404 to be 200
   × needs a machine for a nudge that names several, and raises the chosen one 8ms
     AssertionError: expected 404 to be 422
   … (the 404 test passes trivially: there is no route to answer it)
 Test Files  1 failed (1)
      Tests  8 failed | 1 passed (9)
```

**Green.**

```
$ pnpm exec vitest run apps/server/test/nudge-accept.test.ts
 ✓ apps/server/test/nudge-accept.test.ts (9 tests) 7239ms

$ pnpm exec vitest run apps/server/test/analytics-nudges.test.ts \
    apps/server/test/reply-contract.test.ts apps/server/test/m4b-write.test.ts \
    apps/server/test/forecast-loop.test.ts
 Test Files  4 passed (4)
      Tests  37 passed (37)

$ pnpm exec vitest run apps/server/test packages/domain/test
 Test Files  198 passed (198)
      Tests  2293 passed (2293)

$ pnpm boundaries
boundaries: 235 files scanned, 0 problem(s)

$ pnpm precheck
precheck: OK
```

The acceptance, as the test pins it: the live `freq|M_USED` nudge accepts into exactly one ticket
(`kind general`, `WR-`, `raised_channel inspection`, `machine_id M_USED`, problem = the card's title, reporter =
the acting supervisor's person and login), the raise event's `payload.source` is exactly `{nudge:'freq|M_USED'}`,
`raisedTicketsFor` reads that ticket back, the `nudge:freq|…` `setting` row is `done` with empty owner/due/note, the
board shows the card resolved and there is one `nudge.accept` line. A second accept answers
`{ticketId, ref, created:false}` with no second ticket and no second audit line (and 44c's `PUT` still refuses the
resolved nudge with 409). A `cell` nudge naming two machines is 422 without a choice, 422 for a machine that is not
its own (another tenant's), and raises the chosen one with the same link. A snoozed nudge still accepts into its one
ticket, and a second accept still reads the link (R17). A `shift` card (no machine) is 422 on `key`; the good-news
card is 409; an operator and the board login are 403 with nothing written; a made-up key and another tenant's key are
404; a non-uuid `machineId` and an unknown body field are 422. No new table, migration or dependency.

**Deviations (each recorded, none weakening a rail).**

1. **A snoozed or resolved nudge still accepts — R17's words, not a 409.** The packet brief's shorthand ("a
   closed/snoozed nudge refused, a nudge that is not open 409") describes 44c's _acknowledge_ route, which 52c leaves
   exactly as it was (and the suite above re-proves: `PUT` on a resolved nudge is still 409). R17 is explicit that the
   accept is "accepted whatever its ack status (a resolved or snoozed nudge can still become a ticket; the link check
   comes first)"; the test pins that reading, and the link check precedes the machine choice so a second accept of a
   multi-machine nudge needs no body.
2. **`nudgeFor` is the pure lookup and the info 409 moved out.** The plan asks for this: the two 44c callers now refuse
   good news as "nothing to acknowledge", the accept as "nothing to raise" — one status, two actions' words. 44c's
   `analytics-nudges.test.ts` is green with no edit.
3. **The reply-contract literal is 149, not 138.** The plan wrote 137 → 138 when it was drafted; later tickets added
   routes, and the branch's base already pinned 148. The count gains the one new route (`+1`) and the equality
   assertion is untouched.
4. **The raise event's payload also carries its base `reason`/`isVendor` keys.** The link assertion therefore pins
   `payload.source` exactly rather than the whole payload, the same way 52b's forecast-link test does; the source key
   holds only `nudge`.
5. **The test's five nudge cards are seeded as data.** `nudge-accept.test.ts` seeds the `freq`, `cell`, `shift`,
   `long` (snoozed branch) and good-news evidence for plant A; no product code, shared fixture or rail changes, and no
   other test file is edited except the route-count literal.
