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
there is no `machine.hot` event because no bus exists (R9); the inspection is a `general` (WR-) work-request ticket, so
it never takes a machine's one open-breakdown slot or the live board (R10); one inspection per frozen row, ever, deduped
by the ticket's raise-event source and serialised by an advisory lock (R11); the closed outcome maps ticket
id/ref/status/close_kind/closed_at and copies no text or person (R12); **hit = actual hours ≤ the frozen plan-for**,
exactly (R13); no `kpi_snapshot` write and no plant-level row (R14); a month with no breakdowns is still scored, with 0
hours and a hit (R15); the nudge link lives in `ticket_event.payload.source.nudge` on the raise event, not in the
nudge's setting row (reopen deletes it) and not in a new column (D17) (R16); accept raises one inspection ticket, resolves
the nudge, audits once and is idempotent for that nudge key forever (R17); two UTC pg-boss queues, worker role only,
per-tenant transactions with aggregated errors (R18).

**What the packets will prove (the plan's acceptance, not yet run).** Packet 1: `frozenForMonth` pins 125 rows and
WJ-01's exact December numbers (`expH 6.091584054818952`, `p80 12.02`, `p90 19.86`, band Hot) on the frozen key data,
the A9/Forecast Lab keys stay byte-identical, a second freeze is a no-op, and the plant-time boundary is proven with an
`America/New_York` tenant. Packet 2: the November freeze scores WJ-01 at `12.02 h / 1 episode / hit false` against a
`p80` of 10.17, a late report inside the 7-day window corrects the row and one after the 7th does not, a Hot row raises
exactly one `inspection` ticket (`kind general`, `WR-`, its raise event carrying `{source:{forecast:<row id>}}`), a
second night raises none, and the ticket's `done` close is stored on the forecast row. Packet 3: the live `freq` nudge
accepts into one linked ticket with the nudge resolved (`created:true`, then `created:false` for the same ticket), and
the multi-machine, no-machine, info, role and tenant refusals.

**No parity:** the freeze, the scoring window and the inspection loop do not exist in the v3 platform; the planning
forecast's own row `m4a.a9-bottleneck-forecast` is already done (`docs/spec/parity.yaml`). The four stale
`analytics.forecasting.*` rows (M4) duplicate the two `m4a` forecast rows and stay as they are — a milestone-gate ledger
cleanup, recorded here so it is not lost.

**Docs and seams this plan amends.** `docs/ARCHITECTURE.md`: the job payload row for `engine.run`/`engine.freeze` becomes
`v`, `tenantId` (the plant date is derived per tenant from the plant clock, not enqueued); the analytics paragraph gains
the freeze/scoring/inspection loop and says `machine.hot` is not emitted (no bus: the run calls
`tickets.raisePlannedTicket`); the `pm` module row loses "inspection tickets". `docs/DATA-MAP.md`: the `forecast` row
gains the outcome keys and the eighth-of-the-month finality.

**Follow-ups recorded, not done here.** (1) The daily `kpi_snapshot` series and its 90-day purge are 37d's remainder
(52 writes no figures). (2) `apps/server/src/modules/manifest.ts` still lists no `analytics` tables though the module
writes `kpi_snapshot` and now `forecast`; adding them forces `load.ts`/`snapshot.ts` under `repo/`, so it is its own
ticket. (3) 49 must choose the PM job's ticket `kind`: `raisePlannedTicket` defaults to `stopped`, and an open PM job
would occupy the machine's one open-breakdown slot exactly as an inspection would have (R10). (4) The Action Center card
grows an "accept" button (and can show the linked ticket) in the later frontend ticket; 52 ships the route only.
