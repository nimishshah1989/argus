# 44a — the Action Center rule engine

**What changed for a user:** nothing visible yet: this packet computes and pins the engine, and registers no figure.
The Action Center's whole 36-nudge list for the frozen 11 November plant is now produced by our own code — 14
frequent breakdowns, 7 slow repairs, 6 worsening machines, 4 new machines, 2 long breakdowns, 1 recurring fault, 1
shift pattern and 1 ageing-machines nudge, 6 high / 28 medium / 2 low, naming 29 distinct machines — and it equals
the answer key exactly. The 16 type labels and the 26 plant thresholds are exposed beside it, and the shared seam
(`actionCenterContext`) carries the window, the effective cell, the saved Why-Why records and the ACK/AMC/legal
inputs the figure (44b), the board (44b) and the ack routes (44c) will read.

**Acceptance, exactly as the plan states it.** `actionCenterNudges({data: ENGINE_DATA, asOf: '2026-11-11',
profile: DEFAULT_PROFILE})` deep-equals `ACTION_CENTER.extra.nudges` (36/36, no tolerance, no re-sort);
`ACTION_CENTER_TYPES` deep-equals `extra.types`; `actionCenterThresholds(DEFAULT_PROFILE)` deep-equals
`extra.thresholds` (the 26 numbers, the three inert legacy keys `pmDays`/`noCodePct`/`gapDays` included).
`whyWhyThresholdHours` is the long rule's threshold and stays out of the 26.

**The key's quirks the engine pins.** Every report lookup is a report whose machine is in the CNC master
(`segment === 'CNC'`; the Robot and excluded machines included), so PCM-01, a process machine with four
breakdowns, is not a 37th freq nudge; production is the narrower CNC-and-not-excluded fleet for the plant-wide
rules. The recurring rule skips NO DT and blank codes, freq/rise keep NO DT entries, long/mttr count effective
hours only, and the aggregation follows the source exactly (mttr's fleet average is per entry with hours, the age
rule's is per machine; the age rule reuses `mttrDays` as its window). Windows count back from `asOf` in whole
plant days. A saved Why-Why on a report's ticket suppresses its long nudge. The order is a stable sort by severity
weight (high 3, med 2, low 1, info 0) then evidence day descending, a null evidence last.

**Tests that prove it.** `pnpm exec vitest run packages/domain/test/analytics-action-center.test.ts` — 6 tests:
the three acceptance assertions above; a second key test deriving the rule counts, the severity spread and the 29
machines from the key; and a clearly labelled **not key-pinned** tiny-plant suite that pins the nine rules the key
cannot (cell, spike, good news, human mistakes, shift, team, spares, AMC, legal — the plan lists nine, shift
included, although the key's plant happens to fire shift too) plus the long rule's saved-Why-Why suppression and
the AMC/legal "a later line clears it" rule. Red first: `Test Files 1 failed (1)`, `Tests no tests`,
`TypeError: actionCenterNudges is not a function` (the module did not exist). Green: the named file 6/6, then
`pnpm exec vitest run packages/domain/test` — 39 files, 446 tests (440 before plus the 6 new tests).

**Precheck.** `pnpm precheck`: 13 checks passed (prettier checked 12 files); lint reports only the repo's
pre-existing warnings, and the only size warnings are the soft ones — the two largest new source files are 272 and
312 lines, both under the hard 400 rail.

**Files.** `packages/domain/src/analytics/action-center-model.ts` (new: rule/severity types, the 16 labels, the
key builder, the 26 thresholds, the window/context), `action-center-rules.ts` (new: the nine machine rules and
the whole-list builder), `action-center-plant.ts` (new: the plant-wide trend, human, shift and team rules),
`action-center-ext.ts` (new: AMC and legal), `types.ts` (the additive seams: `NudgeAck`, `AmcLine`,
`LegalLine`, `EngineData.amc`/`legal`, `EngineSettings.nudgeAcks`/`amcRemindDays`/`legalRemindDays`,
`ReportRow.spareCost`), the answer-key fixture (`workbook.ts` + `action-center.ts` + `fixture.ts` map
`acAcks`→`nudgeAcks`, `machAmc`/`machLegal`, the two reminder days and `cost1+cost2+cost3`), the new test
and this fragment. No figure registration; no runtime change to the package's public API.

**Deviations recorded.**

1. **The 13 data rules live in two modules.** The hard 400-line rail could not hold the 13 rules plus the builder in
   one file without cutting the comments the plan asks for, so `action-center-rules.ts` holds the nine machine
   rules and `action-center-plant.ts` the four plant-wide ones. This is exactly the split the plan's size note
   sanctions ("split by the nine machine rules and the seven plant rules"); the whole-nudges assertion is still in
   this packet and unchanged.
2. **One test-only helper is a new file.** `packages/domain/test/answer-key/action-center.ts` holds the key
   reader and the three input mappers because `fixture.ts` was already at 377 lines (the same reason `keys.ts`
   holds the page-shape types). `fixture.ts` re-exports it, so a test keeps one import. All files stay ≤400
   lines.
3. **`analytics/index.ts` exports the three type seams.** Nothing new is exported at runtime (the figure packet
   imports the module directly), so the pinned public API in `registry.test.ts` is unchanged and its D2 case still
   passes.
4. **The team key uses the person's display name**, the coded name the platform prints ("Person 51"), as the plan's
   `team|<person name>` says. The engine's `teamCodes` are codes, so the name is resolved through `people`.
5. **The spares rule's `entries` are the machine's cost rows**, as the plan's table says. The platform's own
   `entries` array also held the machine's non-cost window rows; the key has no spares nudge, so no key byte
   changes, and the plan's narrower count is the one the tiny-plant test pins.
6. **AMC/legal line ids are derived in the fixture** (`amc-1`, `legal-1`) because `input.json`'s lines carry
   none. Both lines have an empty start/last date, so no AMC or legal nudge fires on the key; the derived id only
   matters to the tiny-plant test, which sets its own ids.

# 44b — the Action Center figure, its machine table and its board

**What changed for a user:** the Action Center is now a real analytics figure. For the frozen 11 November plant the
engine returns the answer key whole: one "Action Center" page with no KPIs, the one "Machines needing attention"
table (8 rows) and no charts, plus an `extra` payload of the 16 type labels, the 26 plant thresholds, the six saved
acks and the 36 nudges. The drill names all 29 machines those nudges name, deduped. The screen's board (the read
model, not a registered figure) lists all 36 open — 6 high / 28 medium / 2 low — and its risk rows are the same
eight the page prints, cut from one core so the two cannot drift. The screen's money tile
`action-center.spares-spend` stays `not_computed`; no rupee enters the figure value.

**Acceptance, exactly as the plan states it.** `expect(computed.value).toEqual(ACTION_CENTER)` runs the registered
`action-center` computer through the real engine; the page is the key's (title "Action Center", 0 KPIs, the one
"Machines needing attention" table, 0 charts); the drill's computer order equals the key's nudge-machine order and
the engine's sorted ids are the same 29, every one a real machine; `actionCenterBoard(...)` is 36/36 open and
`board.risk` maps to the key's page rows exactly (machine text, score and why); an empty plant answers `null` with
no drill. The six acks are the fixture's `input.json` acks (`ENGINE_DATA.settings.nudgeAcks`), never read out of the
key, and the test asserts the figure echoes that input.

**Statuses on the key.** Two of the six stored acks name a live nudge — `freq|VC-16` (done, 27 Oct, evidence 5 Nov)
and `freq|GRD-2` (done, 27 Oct, evidence 29 Oct) — so both reopen; the other four keys no longer fire (`long|` a
report that no longer nudges, `rise|TC-6`, `rise|VC-22`, `freq|VC-30`), so no card inherits them. All 36 still open.
The `why` order is the platform's insertion order: HMC-2 prints "Frequent breakdowns Recurring fault Ageing
machines" because the nudge list orders freq before recur and the age nudge adds 1 to each of its machines.

**Tests that prove it.** Named: `pnpm exec vitest run packages/domain/test/analytics-action-center-value.test.ts` —
6/6. Domain: `pnpm exec vitest run packages/domain/test` — 40 files, 453 tests. `pnpm precheck` — 13 checks
passed, 15 files checked by prettier. Red first: the named file failed with `Cannot find module
'../src/analytics/action-center-figure.js'` — `Test Files 1 failed (1)`, `Tests no tests`.

**Files.** `packages/domain/src/analytics/action-center-figure.ts` (new: status, risk, page, value, board, drill),
`computers.ts` (the one `actionCenterComputers` entry, `'action-center': actionCenterFigure`; the money tile stays
uncomputed), `packages/domain/test/analytics-action-center-value.test.ts` (new) and this fragment. No new
dependency; no migration; no schema change.

**Deviations recorded.**

1. **`actionCenterRecords` is exported from the 44a engine.** The six-field public nudge cannot carry the evidence
   day or the `agg`/`noRisk` flags, and the plan's status rule needs the evidence day ("reopen when the evidence
   is after the ack") while the risk table needs the flags. The record list and its stable sort were already there;
   this packet exports it and leaves `actionCenterNudges` as a thin map over it, so the 44a test and behaviour are
   unchanged. No rule logic moved.
2. **The plan's "three of the six stored acks match a live nudge" is two on this frozen input.** Only
   `freq|VC-16` and `freq|GRD-2` match a current key; the other four are stale, which the plan also describes. The
   key still has all 36 open and the risk rows are exact, so no key byte changes; the board test pins two reopened
   and two inherited acks.
3. **`excluded` on the board is false for a nudge that names no machine** (shift/team/good news). "Every machine is
   excluded" is vacuously true for an empty list, which would wrongly show the "Not in production data" chip; the
   screen's chip needs a machine that is actually out of production. The key has no such nudge, so this is a board
   decision only.
4. **The board's `ev` is a plant date (`YYYY-MM-DD`)**, not the platform's `Date`: 44d formats it as DD-MM-YYYY
   like the rest of the screen, and the read model stays JSON.
5. **The figure file is 255 lines**, a soft size warning (soft 250) and well under the hard 400 rail; the functions
   stay under 60.

# 44c — acknowledge and snooze persistence

**What changed for a user:** a supervisor, head or admin can now Acknowledge, Snooze or mark Resolved any open Action
Center nudge, with an owner, a due date and a note, and Reopen it later. The state is one `setting` row per nudge
(`nudge:<full platform key>`), so it survives a new browser and two heads working different nudges cannot overwrite
each other; a reopen deletes the row and the nudge is open again. A snooze lasts the plant profile's `snoozeDays`
(default 7), and a plant that shortens that setting changes its next snooze. The six acks the frozen key carries are
seeded rows and the `action-center` figure echoes them unchanged. The live loader now also reads `spare_cost` into
the report row and the stored nudge acks into the engine settings, so the spares rule can fire on the live plant and
the figure's `extra.acks` is real. `GET /settings` no longer lists `nudge:` or `focus:` item rows, which are read
by their own screens.

**Routes.** All `canAnalytics` (a supervisor acts; an operator and the board login get 403), and every successful
write or reopen answers the whole fresh board:
`GET /api/v1/analytics/action-center?asOf=YYYY-MM-DD` (default the plant's today); `PUT
/api/v1/analytics/action-center/nudges/:key` with `{status: 'ack'|'snooze'|'resolved', owner?, due?, note?}`;
`DELETE /api/v1/analytics/action-center/nudges/:key`. The key is URL-encoded and must name a **current** nudge (404
otherwise, another plant's or a stale key included) and be **open** for a write (409 otherwise); an info (good-news)
nudge refuses a write or a reopen (409). `owner` is at most 80 characters, `note` at most 500, `due` is a plant
date or `''` (422 otherwise). `at` is the database's `now()` and a snooze's `until` is that instant plus the
profile's `snoozeDays`, both read in the write's own transaction. Each write leaves one audit line (`nudge.ack`,
`nudge.snooze`, `nudge.resolve`, `nudge.reopen`; entity `setting`; the row id; before/after).

**Acceptance, exactly as the plan states it.** The six key acks are seeded from `input.json` and `GET
/analytics/figures` returns `extra.acks` equal to those six; a live freq nudge (four breakdowns in the last 30 days)
is a supervisor's ack with owner/due/note (one row and one audit line), an operator's and the board login's 403, a
snooze at 7 days then 3 after the profile changes (exact `until - at` deltas), an earlier ack reopened by a newer
breakdown, a reopen that restores open and removes the key from `extra.acks`, one row for a second ack over a stale
one, a resolve, 404 for made-up/stale/other-tenant keys, 409 for a non-open nudge and for good news, 422 for a
too-long note, and a settings list with no `nudge:` or `focus:` row.

**Tests that prove it.** Red first with the routes unregistered: `Test Files 1 failed (1)`, `Tests 9 failed | 3
passed (12)` (every route test saw 404; the figure and settings assertions still passed). Green:
`pnpm exec vitest run apps/server/test/analytics-nudges.test.ts` — 12/12;
`pnpm exec vitest run apps/server/test/analytics-engine.test.ts` — 18/18 (the loader's `spareCost` 450.5 and the
profile); `pnpm exec vitest run packages/domain/test` — 40 files, 453 tests. `pnpm precheck` — 13 checks passed,
28 files checked by prettier; lint reports only the repo's pre-existing warnings.

**Files.** `packages/shared/src/action-center.ts` (new: `NUDGE_RULES`, `nudgeAckSchema`, `nudgeAckBodySchema`,
the board schema and its reply), `packages/shared/src/index.ts` and `replies.ts` (export and the three reply
contracts), `apps/server/src/modules/analytics/nudges.ts` (new: `readNudgeAcks`, the routes, the audits and the
snooze clock), `load.ts` (nudge acks into `settings.nudgeAcks`, `spare_cost` into `ReportRow.spareCost`),
`routes.ts` (register, and the one board loader the write paths share), `apps/server/src/modules/plant/repo/config.ts`
(one setting row per nudge: read, upsert, delete; the `^(focus|nudge):` list filter), `apps/server/src/modules/tickets/repo/analytics.ts`
(select `spare_cost`), `apps/server/src/modules/manifest.ts` (analytics calls ops for its audit), `apps/server/test/analytics-nudges.test.ts`
(new) and the loader assertion in `apps/server/test/analytics-engine.test.ts`. No migration, no new dependency.

**Deviations recorded.**

1. **The `setting` SQL lives in the plant module.** `modules/analytics` may not name `setting` (the boundary rail:
   only the owner's `repo/` may), so `nudges.ts` owns `readNudgeAcks` and the route logic while the SQL and the
   list filter are in `plant/repo/config.ts`, reached through `plant/index.ts`. The plan's file list is honoured in
   spirit; the table stays where the manifest says it belongs.
2. **`analytics` now calls `ops`.** The audit lines need it; `CALLS` is updated in `manifest.ts` (analytics ->
   ops, a bottom-up direction). Without that the audit of a write would break the boundary check.
3. **`actionCenterBoard` is now on the domain's public API.** The server package has one entry point, so the board
   function and its `ActionCenterBoard`/`BoardNudge`/`NudgeStatus`/`RiskRow` types are exported from
   `analytics/index.ts`; `registry.test.ts`'s D2 pinned list gains the one runtime name. 44b exported nothing at
   runtime; this packet needs the function the routes answer with.
4. **`readNudgeAcks` is exported from `nudges.ts` and called by the loader.** `nudges.ts` does not import the
   loader: the route module injects the board loader (`NudgeBoardOf`), so the loader -> nudges direction has no
   cycle and the write path reuses the one load it already made.
5. **Stored notes are not length-capped.** The write body enforces 80/500, as the plan says; the stored record's
   `owner`/`note` schemas accept any string so a legacy platform note longer than 500 characters cannot turn the
   board reply into a 500. The write path never stores one.
6. **"Two acks of one key keep one row" is pinned as an upsert over a stale ack.** The plan also says a write on a
   non-open nudge is 409, so two live acks of the same open nudge cannot both succeed through the route; the test
   seeds the first (stale, reopened) ack and the route's second write keeps the same row id, which is the invariant
   the unique `(tenant_id, key)` gives. A second write while the first ack still holds is the separate 409 case.

**Open questions settled.**

- **6. The setting key shape.** `nudge:<full platform key>` (`nudge:recur|HMC-2|ATC`, `nudge:long|bd_...`,
  `nudge:rise|TC-6`), never `nudge:<rule>|<machine>`: the full key is what the six acks use and what `recur`,
  `long`, `amc` and `legal` need. 0014's `<subject>` is read as the rest of the key; migrations are immutable, so
  the correction lives here and in the ledger.
- **7. The write role.** `canAnalytics` for read and write (supervisor, head, plant head, admin). DATA-MAP's
  "maintenance head and admin (analytics role)" is the settlement point; a supervisor acts on a nudge, an operator and
  the board login do not see the screen.
- **8. Snooze precision.** A snooze stores `at` and `until` as instants but the engine holds plant **days**: the board
  is snoozed while `plantDay(until) > asOf` and opens on that day. The tests pin the exact `until - at` delta (7 and
  then 3 days); the last day's exact-hour boundary remains the platform difference the plan accepts.
- **9. `GET /settings` leaks.** Filtered in the settings read with `key !~ '^(focus|nudge):'`; a `focus:test` row
  is seeded by the test and never appears.
