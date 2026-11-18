# M4a-44 — Action Center (ticket 44)

Ticket 44: [Engine] "The 13 nudge rules fire on the fixture exactly as the platform's." [Browser] "A nudge can be
snoozed and the snooze holds across sessions." Blocked by 41, 42 and 43, all merged. The parity row is
`m4a.action-center` (`docs/spec/parity.yaml`).

## Authority

`fixtures/answer-key/action-center.json`, **whole**: `screen`, `asOf`, one page (`pages[0]`: title "Action
Center", 0 KPIs, the one "Machines needing attention" table, 0 charts) and `extra` = `types` (16 labels),
`thresholds` (26 numbers), `acks` (6 stored records) and `nudges` (36). No tolerance, no re-rounding, no
re-sorting. The nudge records carry only `key, rule, sev, title, machines, entries`; the platform's prose
(`detail`, `action`, latest entry) is **not in the key** and is not part of the figure (open question 3).

The 11 Nov build at `docs/discovery/real-2026-11-13/cosmos_platform-2026-11-11.html` is the rule source. Anchors:
`AC_DEF` 5300–5302, `AC_LABELS` 5303–5314, `acCfg` 5315, `AC_TYPES`/`AC_SEV` 5317–5320, `acCompute`
5322–5456, `acSet` 5467–5475, `acReopen` 5476, `acCard` 5509–5524, `extNudges` 8035–8059, `extRemind`
7956, `amcEnd` 7958, `legalDue` 7959, `extDays` 7960, Guide §15 4003–4015, the AMC/legal reminder paragraph 4213. Helpers: `getEffectiveCell` 794, `isExcluded` 881, `nonRobotMachines` 883, `activeTeam` 917,
`isNoDT` 957, `sumHrs` 987, `sumSpareCost` 993, `nameInField` 1257, `machineAge` 1663, `effH` 4228,
`repEntriesAll` 4841, `codeDesc` 4884, `machDate` 4979, `fmtNum` 687, `fmtDMY` 4258, `computeAge` 722.
**Reimplement from this plan; never copy source.**

The key is a frozen 11 Nov 2026 run. Every window counts back from `asOf`. The plant's own rules come from the
**analytics profile** (`packages/shared/src/analytics.ts`, the 26 `group: 'actionCenter'` fields); the key's
`thresholds` equal the profile defaults, and `pmDays`, `noCodePct`, `gapDays` are inert legacy keys the
figure must still emit. `snoozeDays` is read only by the snooze route. `whyWhyThresholdHours` (12) is the long
rule's threshold, not one of the 26.

**What the key pins** (verified while planning against `input.json`; the 36 and the 8 rows reproduce exactly):
36 nudges — freq 14, mttr 7, rise 6, newm 4, long 2, recur 1, shift 1, age 1; 6 high, 28 medium, 2 low; 29
distinct machines; no cell, spike, good, hum, team, spares, amc or legal nudge. All 36 are **open** on 11 Nov:
three of the six stored acks match a live nudge and all three have newer evidence (so they reopen); the other
three are stored against nudges that no longer fire. The page table's 8 rows are the risk ranking of those open
nudges.

## Frozen interfaces (the seams)

No migration. `setting` exists, and 0014 already owns its `nudge:` erasure trigger.

- `packages/domain/src/analytics/types.ts` (additive):
  - `NudgeAck { status: 'ack' | 'snooze' | 'done'; owner: string; due: string; note: string; at: string; until?: string }`
    (ISO instants; `due` a plant date or `''`).
  - `AmcLine { id; machineId; type; start: string | null; months: number; vendor: string | null; noRenew: boolean }`
    and `LegalLine { id; machineId; tid; name; form: string | null; last: string | null; months: number; cert: string | null }`
    on `EngineData` as `amc?` / `legal?` (M4b ticket 51 fills them from the register; empty today).
  - `EngineSettings.nudgeAcks?: Record<string, NudgeAck>`, `amcRemindDays?: number`, `legalRemindDays?: number`
    (defaults 15).
  - `ReportRow.spareCost?: number | null` (the sum of the platform's three costs; 0014's `spare_cost` column
    exists, the loader does not read it yet). Additive; the 43 spares lane keeps its names-only seam.
- `packages/shared/src/action-center.ts` (new, 44c): the ack/board schemas and the 16-rule enum.
- The answer-key fixture (`test/answer-key/workbook.ts` + `fixture.ts`): map `settings.acAcks` to
  `settings.nudgeAcks`, `machAmc`/`machLegal` to `amc`/`legal`, `amcRemindDays`/`legalRemindDays`, and
  `cost1+cost2+cost3` to `spareCost`. The 6 acks are **input data**, from `input.json`, not read out of the
  key: the key is the expected output, never the input.

## Shared rules

- **Fleet.** The platform's `getMachine` reads the **CNC machine master only**, so every report lookup is a
  report whose machine has `segment === 'CNC'` (the Robot included, excluded machines included). `isProduction`
  (`segment === 'CNC' && !excludedFromProduction`) is the production fleet. The plant-wide rules (spike, good,
  hum, shift, team, age) read production; the machine rules (recur, freq, rise, cell, long, mttr, newm, spares)
  also raise nudges for excluded machines. This is key-pinned: PCM-01 (a process machine) would otherwise be a
  37th freq nudge.
- **Rows.** Every report, history **and live** (`sourcedReports`, no `isHistory` filter); PM is never a
  breakdown; a NO-DT row is a breakdown entry worth 0 hours. Hours are `effectiveHours` (`recordedHours` where
  present, else `downtimeMin / 60`), **never rounded before a comparison** (a 12.02-hour record is over the
  12-hour limit; it prints 12.0).
- **Windows.** `age = asOfDay − reportDay` (plant dates, `dayNumber`); a window `(days, off)` keeps
  `off ≤ age < days + off`, so the last 7 days are ages 0–6 and the previous 30 are 30–59. A future-dated row is
  out. The 30-day pattern window (hum, shift, team) and the 7/28-day trend window are fixed, not profile keys.
- **Keys.** `recur|<machine>|<code>`, `freq|<machine>`, `rise|<machine>`, `cell|<cell>|<code>`,
  `long|<reportId>`, `spike|hrs`, `good|hrs`, `hum|all`, `shift|<shift>`, `team|<person name>`,
  `newm|<machine>`, `spares|<machine>`, `age|all`, `amc|<lineId>|<end ISO>`, `legal|<lineId>|<due ISO>`.
- **Order.** Built in the rule order below; a **stable** sort by severity weight (high 3, med 2, low 1, info 0)
  descending, then evidence day descending (a null evidence sorts last). The key's 36 order reproduces this.
- **Text.** `formatNumber` (halves away from zero, grouped) at the source's decimals; `dmy` for dates; the
  code description is the `maint_code` label before an em dash, trimmed, blank when unknown; append `%` and
  `x` exactly where the source does. The type labels are the key's 16, verbatim (e.g. "Long breakdown").
- **Empty.** No nudge at all, or no nudge that names a machine (a good-news-only plant) → `value: null`,
  `drillIds: []`: the engine refuses a non-empty value that names no rows. The board still shows such nudges; only
  the parity figure is null. Otherwise the value is the key shape.
- **Drill.** The registry's drill is `machine`. `drillIds` = every machine the nudges name, in nudge order,
  deduped; every id is a real machine row. The engine sorts them.

## The 16 types (rule, threshold, severity, key, machines, entries, evidence)

Bracketed numbers are the profile defaults.

| Rule   | Fires when                                                                                                                                                                                                                                  | Severity                                           | Key                      | Machines                             | Entries                       | Evidence          |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------ | ------------------------------------ | ----------------------------- | ----------------- |
| recur  | Same machine + same non-blank code on ≥ `repeatMinDays` **distinct days** in the last `repeatDays` [7], NO-DT skipped                                                                                                                       | high when ≥3 days or any two consecutive, else med | `recur\|<m>\|<code>`     | [machine]                            | rows behind                   | latest row        |
| freq   | A machine with ≥ `freqMin` [4] entries in the last `freqDays` [30]; one nudge per machine, **else-if** rise                                                                                                                                 | high when n ≥ ceil(1.5 × freqMin) = 6, else med    | `freq\|<m>`              | [machine]                            | n                             | latest row        |
| rise   | Otherwise, n ≥ `riseMin` [3] and n ≥ `riseMult` [2] × max(p, 1), p = entries in the previous `freqDays` window                                                                                                                              | med                                                | `rise\|<m>`              | [machine]                            | n                             | latest row        |
| cell   | Same code + **effective cell** ≥ `cellMin` [5] entries in `cellDays` [7] across ≥2 machines; NO-DT and blank codes skipped                                                                                                                  | high at ≥4 machines, else med                      | `cell\|<cell>\|<code>`   | first-appearance order               | rows                          | latest row        |
| long   | `effectiveHours` > `whyWhyThresholdHours` over `longDays` [60] and no saved Why-Why for the report's ticket                                                                                                                                 | high at ≥2× the limit, else med                    | `long\|<reportId>`       | [machine]                            | 1                             | report day        |
| spike  | Production rows: `h7` in the last 7 days vs `hp = (the previous 28 days' hours, ages 7–34)/4`; `hp > 0`, `h7 ≥ hp × (1 + spikePct/100)` [50], `h7 ≥ spikeMinHrs` [10]                                                                       | high when h7 ≥ 2 × hp, else med                    | `spike\|hrs`             | top 3 by hours in the window         | 7-day row count               | latest row        |
| good   | Else-if spike did not fire, the log is fresh (latest entry ≤2 days old), `hp ≥ spikeMinHrs`, `h7 ≤ 0.6 × hp`                                                                                                                                | info                                               | `good\|hrs`              | []                                   | 7-day row count               | latest or asOf    |
| mttr   | A machine's `mttrMin` [3] rows with >0 hours over `mttrDays` [90] average ≥ `mttrMult` [2] × the production fleet average (>0 hours, same window, Σh/Σn)                                                                                    | med                                                | `mttr\|<m>`              | [machine]                            | rows                          | latest row        |
| hum    | Production 30-day n ≥10; rows whose code is `HUM` are ≥ `humShare` [15]%                                                                                                                                                                    | high at ≥2× the share, else med                    | `hum\|all`               | top 5 by count (insertion ties)      | HUM rows                      | latest HUM row    |
| shift  | Production 30-day n ≥20, >1 shift, the top shift ≥ `shiftShare` [55]%                                                                                                                                                                       | low                                                | `shift\|<shift>`         | []                                   | top shift's rows              | latest 30-day row |
| team   | Production 30-day n ≥10; a Settings-team member (active) named in Done By on ≥ `teamShare` [30]% of rows; shared jobs count for every name                                                                                                  | low                                                | `team\|<name>`           | []                                   | that member's rows            | latest 30-day row |
| newm   | A CNC machine with a purchase date, age 0–`newMachDays` [90], ≥ `newMachMin` [2] non-PM rows since purchase (no window)                                                                                                                     | high at ≥4 rows, else med                          | `newm\|<m>`              | [machine]                            | rows                          | latest row        |
| spares | Rows with `spareCost > 0` over `spareDays` [90]; a machine's cost share ≥ `spareShare` [25]% and ≥2 cost rows                                                                                                                               | med                                                | `spares\|<m>`            | [machine]                            | that machine's cost rows      | latest window row |
| age    | Production `mttrDays` [90] window: hours per machine; machines of `machineAge ≥ oldAge` [15] years with hours ≥ 2 × (Σ hours / production machine count)                                                                                    | low                                                | `age\|all`               | the first 5 old machines, hours desc | the old machines' window rows | latest window row |
| amc    | An AMC line of an existing machine (any segment) with `start` and `months > 0`: end = start + months − 1 day; d = end − asOf; `d ≤ amcRemindDays` (15); not `noRenew`; cleared when another line of the same machine + type has a later end | high when d ≤ 7 (overdue included), else med       | `amc\|<lineId>\|<end>`   | [machine]                            | 0                             | null (noRisk)     |
| legal  | A legal line with `last` and `months > 0`: due = last + months months; d = due − asOf; `d ≤ legalRemindDays` (15); cleared by a line of the same machine + test with a later `last`                                                         | high when d ≤ 7, else med                          | `legal\|<lineId>\|<due>` | [machine]                            | 0                             | null (noRisk)     |

Titles are exactly the key's: `fmt` = `formatNumber`, `C` = the profile's 26 thresholds.

- recur: `<m>: <code> (<desc>) came back on <days> different days in the last <C.repeatDays> days`
- freq: `<m> has broken down <n> times in <C.freqDays> days`
- rise: `<m> is getting worse: <n> breakdowns against <p> before`
- cell: `Cell <cell>: <code> (<desc>) on <machines> machines (<n> breakdowns in <C.cellDays> days)`
- long: `<m>: <fmt(h,1)> hrs breakdown on <DD-MM-YYYY> has no root-cause analysis`
- spike: `Downtime this week is <fmt((h7/hp-1)*100,0)>% above the recent weekly average`
- good: `Downtime this week is <fmt((1-h7/hp)*100,0)>% below the recent weekly average`
- mttr: `<m>: repairs take <fmt(avg,2)> hrs on average, <fmt(avg/fleet,1)>x the fleet average`
- hum: `Human mistakes caused <fmt(share,0)>% of breakdowns in the last 30 days (<hum> of <n>)`
- shift: `Shift <shift> had <fmt(share,0)>% of breakdowns in the last 30 days`
- team: `<name> attended <fmt(share,0)>% of breakdowns in the last 30 days`
- newm: `New machine <m> (bought <DD-MM-YYYY>) already has <n> breakdowns`
- spares: `<m> used <fmt(share,0)>% of all spares spend in the last <C.spareDays> days`
- age: `<count> machines aged <C.oldAge>+ years lost at least twice the fleet average hours in the last <C.mttrDays> days`
- amc: `<m>: <type or "AMC"> <when>` with `when` = `expired N days ago` / `ends today` / `ends in N days`
- legal: `<m>: <name>< (Form <form>)> <when>` with `when` = `overdue by N days` / `due today` / `due in N days`

The source quirks the key pins: the age rule reuses `mttrDays` as its window; `newm` requires a purchase
**date** (a Year-only machine never fires); `freq`/`rise` include NO-DT entries while `recur`/`cell`/
`long`/`mttr` do not count them as hours; `mttr`'s fleet average is per **entry with hours**, while the age
rule's is per **machine**; `spares` includes NO-DT rows if a cost is recorded; the effective cell is the cell on
the report's date from the move log (blank → `—`), not the current cell.

## The page, the statuses and the board

**Status** (the figure needs it; the page's table depends on it). For each current nudge and its stored ack:
`ackDay = plantDay(ack.at, timeZone)`. An ack with `ackDay > asOf` did not exist yet → treat as none. If
`status === 'snooze'`: **snoozed** while `plantDay(until) > asOf`, else **open** (no reopened flag; the platform
never reopens a snooze early). Otherwise, if the nudge has an evidence day and it is **after** `ackDay` → **open**
and `reopened`; else `done` → **resolved**, `ack` → **ack**. An ack is stored by key, so a nudge that stops
firing keeps its record (`extra.acks` echoes all six, stale ones included) and a returning key inherits it.

**Risk table.** Only **open**, non-info nudges without `noRisk` (amc/legal). Each contributes to every machine it
names: `agg ? 1 : sevWeight`; `agg` is true for hum, shift, team and age. Sort by score descending, stable over
the nudge order, top **8**. The row is the machine cell (id, a space, the model, trailing space trimmed), the score
as a string, and `why`, which joins the rule labels in insertion order with ` xN` when one rule counted more than
once ("Frequent breakdowns Recurring fault Ageing machines"). The table is `{title: "Machines needing attention",
header: ["Machine","Score","Why"], rows, rowCount: rows.length}` (8 on the key).

**Figure value** (44b): exactly `{ screen: 'action-center', asOf, pages: [page], extra: { types, thresholds, acks,
nudges } }`; the page is `{page: 'ac', title: 'Action Center', kpis: [], tables: [the table], charts: []}`; each
nudge is the key's six fields; `acks` is `settings.nudgeAcks` passed through unchanged.

**Board** (44b, the screen's read model; not a registered figure): `{asOf, snoozeDays, types, nudges, counts,
bySeverity, risk}`. Each board nudge adds `status`, `reopened`, `ev` (plant date or null), `excluded` (every
machine excluded from production), and `ack` (the stored record or null). `counts` = open/ack/snoozed/resolved;
`bySeverity` = open high/med/low/info (the platform's four tiles); `risk` = the same 8 rows (machine, model,
score, why). The figure and the board share one core so they cannot drift.

## 44a — the rule engine (one PR)

**Files.** `packages/domain/src/analytics/action-center-model.ts` (new: the rule/severity types, the 16 labels,
the key builder, the profile thresholds, the shared window/context), `action-center-rules.ts` (new: the 13 data
rules), `action-center-ext.ts` (new: amc and legal), `types.ts` (the seams above),
`test/answer-key/workbook.ts` + `fixture.ts` (the new inputs), `test/analytics-action-center.test.ts` (new),
`changes/44-action-center.md` (new; each packet appends its section). No figure registration in this packet.

**Acceptance** (named subtrees, one test):
`expect(actionCenterNudges({data: ENGINE_DATA, asOf: '2026-11-11', profile: DEFAULT_PROFILE})).toEqual(AC.extra.nudges)`;
`expect(ACTION_CENTER_TYPES).toEqual(AC.extra.types)`;
`expect(actionCenterThresholds(DEFAULT_PROFILE)).toEqual(AC.extra.thresholds)`.
A second, clearly labelled rule test builds a tiny plant and pins the rules the key never fires (cell, spike,
good, hum, shift, team, spares, amc, legal) and the long-rule's saved-Why-Why suppression; it is **not**
key-pinned and says so.

**Red/green.** Red: `pnpm exec vitest run packages/domain/test/analytics-action-center.test.ts` (the module does
not exist). Green: the named file, then `pnpm exec vitest run packages/domain/test`, then `pnpm precheck`.

**Size.** This is the one large packet: about 500 source lines in three files plus the test. It carries a
`size:large` label and a plain `Large PR: <reason>` line; the file split keeps every file under 400 lines and
every function under 60. If the orchestrator wants it smaller, split by the nine machine rules and the seven
plant rules and keep this whole-nudges assertion in the second packet — do not split the assertion.

## 44b — the figure, the machine table and the board (one PR)

**Files.** `action-center-figure.ts` (new: status, risk, page, value, board, drill; about 220 lines),
`computers.ts` (one `actionCenterComputers` entry, `'action-center': actionCenterFigure`; the money tile
`action-center.spares-spend` stays `not_computed`), the test and the fragment.

**Acceptance** (whole key): `expect(computed.value).toEqual(AC)`; the drill is every nudge machine, deduped, each
a real machine (the computer's order and the engine's sorted order both pinned); the board: all 36 open, and
`board.risk` maps to the key's page rows exactly. The key's acks are the fixture's `input.json` acks; nothing is
read from the key. Empty plant → `null`.

**Red/green.** Red: the whole-key test fails because the engine answers `not_computed` for `action-center`.
Green: the named file, `pnpm exec vitest run packages/domain/test`, `pnpm precheck`.

## 44c — acknowledge and snooze persistence (one PR)

The key needs the acks as **input** (44b's fixture supplies them); the product needs a store and the routes the
screen calls.

**Store.** One `setting` row per nudge: key `nudge:` + the full platform nudge key
(`nudge:recur|HMC-2|ATC`, `nudge:long|bd_...`, `nudge:rise|TC-6`), value the `NudgeAck` record. One row per
key means two heads cannot overwrite each other. No migration; 0014's `person_erased_scrub_notes` already
scrubs `^(focus|nudge):` rows. Reopen deletes the row; nothing else deletes one, and stale keys are kept (the
platform's behaviour). The figures doc's `nudge:<rule>|<machine>` and 0014's comment are read as
`nudge:<platform key>` (the `<subject>` is the rest of the key); this plan is the authority, the correction is
recorded in the ledger and the fragment (migrations are immutable).

**Files.** `packages/shared/src/action-center.ts` (new: `nudgeAckSchema`, `nudgeAckBodySchema`, the 16-rule enum,
`actionCenterBoardSchema` and its reply), `apps/server/src/modules/analytics/nudges.ts` (new: `readNudgeAcks`,
the routes, the audits), `load.ts` (read the `nudge:` rows into `settings.nudgeAcks`; read `spare_cost` into
`ReportRow.spareCost`), `routes.ts` (register), the settings list's filter, `apps/server/test/analytics-nudges.test.ts`
(new), the fragment.

**Routes** (all `canAnalytics`; the board and the write return the fresh board):
`GET /api/v1/analytics/action-center?asOf=YYYY-MM-DD` (default the plant's today) → the board;
`PUT /api/v1/analytics/action-center/nudges/:key` body `{status, owner?, due?, note?}` → ack / snooze / resolved;
`DELETE /api/v1/analytics/action-center/nudges/:key` → reopen. The key is URL-encoded and must be a **current**
nudge (else 404) whose status is **open** (else 409; a card that is acked, snoozed or resolved shows only Reopen);
an info (good-news) nudge refuses a write (409). `owner` ≤ 80, `note` ≤ 500, `due` a plant date or `''` (422
otherwise). `at` = the database's `now()`; `until` = now + `snoozeDays` **from the plant profile read in the same
transaction** (not a fixed 7). One audit line per write (`nudge.ack`, `nudge.snooze`, `nudge.resolve`,
`nudge.reopen`; entity `setting`; entity_id the row id; before/after). The generic `GET /settings` list must not
show `nudge:` (or `focus:`) rows: filter them in the settings read.

**Role.** Default: `canAnalytics` for read and write (the analytics audience; a supervisor acts on a nudge), and
the money tile stays behind the existing money gate. DATA-MAP's "maintenance head and admin (analytics role)" is
the settlement point (open question 7).

**Tests.** Seed the six key acks as `setting` rows and assert `GET /analytics/figures` returns
`extra.acks` equal to `input.json`'s six (the key-linked assertion; the tiny server plant cannot reproduce the
36 nudges — that is 44b's test). Seed a machine with 4 breakdowns in the last 30 days (relative to the plant's
today) for a live freq nudge, then: a supervisor acks with owner/due/note (the row and the audit exist); an
operator and the board login get 403; a snooze's `until` is `snoozeDays` after `at`, and changing the profile's
`snoozeDays` to 3 changes the next snooze; an ack seeded with an earlier `at` plus a newer breakdown reopens it; a
delete restores open and drops the key from `extra.acks`; two acks of one key keep one row; a stale/made-up key is
404; an info nudge and a non-open nudge are 409; a too-long note is 422; another tenant's key is 404; `GET /settings` has no
`nudge:` row.

**Red/green.** Red: `pnpm exec vitest run apps/server/test/analytics-nudges.test.ts` (404 on every route). Green:
the named file, `pnpm exec vitest run apps/server/test/analytics-engine.test.ts` (the loader's grown report row
and the profile), `pnpm exec vitest run packages/domain/test`, `pnpm precheck`.

## 44d — the Action Center screen (one PR)

**Files.** `apps/web/src/screens/analytics/ActionCenterPage.tsx` (new), `apps/web/src/screens/analytics/action-center.ts`
(new: the pure board → view mapping), `action-center.test.ts` (new), `apps/web/src/api.ts` (the board resource and
the three mutations), `Analytics.tsx` (the `/analytics/today/action-center` route, like the checklist's),
`groups.ts` (`ACTION_CENTER_PATH`), `Dashboard.tsx` (the platform's banner: "X high-priority and Y medium nudges
need attention — Open Action Center", hidden when empty or loading), `packages/shared/src/i18n/analytics-action-center.en.ts`
/ `.gu.ts` (new namespace; `analytics.en.ts` is at 247 of 250 lines) and the catalogue registration,
`apps/web/e2e/analytics-action-center.spec.ts` (new), `docs/spec/parity.yaml` (the `m4a.action-center` row:
status done, evidence the key and the journey), the fragment.

**The screen.** The platform's Action Center: four tiles (High, Medium, Low, Good news, counts of open by
severity), four tabs (Open default, Acknowledged, Snoozed, Resolved), the priority and type filters (all 16 types
from the board's `types`) and a search over title and machines; a card per nudge with type, priority, title,
machine chips (drill to `/analytics/machines/:id`), entry count, latest entry (DD-MM-YYYY), the platform's "Not in
production data" chip when `excluded`, the status line (owner, due, note, "Snoozed until DD-MM-YYYY") and the
buttons: Acknowledge (with owner from the plant's active people, due date, note), Snooze `snoozeDays` days,
Resolved, Reopen. Info nudges have no buttons. The "Machines needing attention" table is the board's 8 rows, with
machine drills. "Nothing needs attention with the current limits." when empty. No suggested-action prose (open
question 3); no money number and no `action-center.spares-spend` tile.

**Acceptance.** The mapping test reads the key and a board literal and pins the tiles, the tabs, every card's text,
the 8 risk rows and the 16 type options, and asserts the screen's view carries no money; the journey opens the
screen on the real stack (the board and the write routes stubbed with an in-test store, the established e2e seam
because the e2e seed has no breakdowns), filters by type, acks with owner/note, snoozes, reloads and sees the snooze
hold, then reopens it. The real persistence is 44c's server test.

**Red/green.** Red: `pnpm exec vitest run apps/web/src/screens/analytics/action-center.test.ts` and
`pnpm exec playwright test apps/web/e2e/analytics-action-center.spec.ts` (no screen, no route). Green: both, then
`pnpm exec vitest run apps/web/src/screens/analytics`, `pnpm exec playwright test apps/web/e2e/analytics-action-center.spec.ts`,
`pnpm precheck`.

## Integration and rails

- Merge order: 44a → 44b → 44c → 44d. 44c and 44d touch different trees and may run in parallel once 44b's board
  shape is on main; the schema in this plan is frozen, so 44d can start then.
- One writer per packet. Red first; never weaken a test. File ≤ 400 lines (the 44a/44b split), function ≤ 60; no
  new dependency; no code copied from the discovery file; whole-key equality (or the named subtrees above) with no
  tolerance and no re-rounding.
- Each packet appends one section to `changes/44-action-center.md`; the orchestrator keeps all sections. The 44d
  packet flips the parity row and adds the evidence lines.
- The figure's `action-center.spares-spend` money tile stays `not_computed`; the spares rule's rupees never enter
  the figure value (only the share in the title).

## Open questions (settlement point)

1. **CNC-only vs the whole plant.** Source and key pin the Action Center to the CNC master (PCM-01 would be a
   37th nudge otherwise). Product intent (Guide §15 says "machines") may be the whole plant. Port CNC-only for
   parity; a whole-plant rule is a new key and a DIFFERENCES row. Settle at the M4a gate / Bhavin N12; cost: one
   rule scope and a key regeneration.
2. **No approved artboard.** `docs/design/LOCK.md` has no Action Center artboard; 44d follows the platform's
   layout and the existing Today patterns. Settle with Nimish at the 44d PR; cost: one screen restyle.
3. **The platform's per-nudge prose** (`detail`, `action`, latest-entry sentence) is not in the key; 44 ships none.
   If it is wanted, the key must grow a field (regenerate) or a new copy source. Settle at 44d; cost: a new key
   field and a text pass.
4. **The spares-spend money tile.** The key has no spares nudge and main's value carries no rupees; the rule reads
   `spareCost` internally. Default: the nudge stays in the main figure (a share only) and the money tile stays
   `not_computed` until the spare-cost screen/number lands (46/47). Settle with those tickets; cost: one money gate.
5. **Team status on the seam.** `teamCodes` carries no active/inactive status, so every listed member is treated
   as active (the key has no inactive member). Settle when the team list's status reaches the engine (46/51 or a
   seam ticket); cost: one extra nudge for an inactive member.
6. **The setting key shape.** `nudge:<platform key>` (the full key), not the figures doc's
   `nudge:<rule>|<machine>`; the full key is required for `recur` (code), `long` (report), `amc`/`legal`
   (line + date) and matches the key's six acks. Corrected in the fragment; 0014's comment is read as
   `<subject>` = the rest. Settle in 44c's PR (docs only).
7. **The write role.** `canAnalytics` (supervisor included) is the default; DATA-MAP says "maintenance head and
   admin (analytics role)". Settle with the orchestrator/Nimish; cost: one permission row.
8. **Snooze precision.** The engine has a plant **date**, not an instant, so a snooze is held while `until`'s
   plant day is after `asOf` and opens on that day; the platform's exact-hour boundary is not reproducible. Settle
   in 44c's tests (pass an instant later if exactness is wanted); cost: a day-boundary difference on the last day.
9. **`GET /settings` leaks the per-item rows.** Default: filter `^(nudge|focus):` out of the settings list. Settle
   in 44c; cost: one query line.
