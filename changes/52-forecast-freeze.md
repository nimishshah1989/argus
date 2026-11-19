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
