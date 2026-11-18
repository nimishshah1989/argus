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
