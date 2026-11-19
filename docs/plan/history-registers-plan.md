# Plan: Cosmos's historic breakdown registers (2022, 2024, 2025) — the goal post

Status: planning. Written 17 November 2026 on `docs/history-registers-plan` from my own read of all 14 workbooks.
Nothing here is built and no product code is touched. This supersedes `docs/plan/history-registers-scope.md` and
`docs/slices/history-registers.md` on draft PR #292, which then closes (§12).

Read first: `docs/DATA-MAP.md` §5 and §8, `docs/decisions/D21-cleaned-history-file-and-loader.md` (D17, D29, D16),
`docs/plan/MILESTONES.md` (37c, 39–45, 46–54, 56–58, 67), `docs/slices/38-dashboard.md` revision 4, and the loader
on `main` (`tickets.importTickets`, `imports/{batch,undo}.ts`, `packages/domain/src/analytics/{types,engine}.ts`).

> ## Consent and name handling

Nimish confirmed on **17 November 2026** that Cosmos's written consent (N14) is in place for these files — it is
recorded as a fact and is **not a gate**. One technical step remains before any tool that sends data out: the 14
workbooks arrived **uncoded** (2022 names a technician on 526 rows, 2024 on 7, 2025 on 9; no phone numbers found), so
ticket H2 codes the names on the operator's machine and keeps the key there. This document holds counts and
`Maint. Team` only.

## 1. Goal

Cosmos's paper-era breakdown registers — form CE-MTN-F-04, 2022, 2024 and 2025, 14 workbooks — become **closed
history tickets** through the D21 path, so the analytics read four years instead of ten months. Every row is counted
once: a power cut is one plant event, a repair that ran for days is one breakdown with its daily notes, a row nobody
can explain goes to a person at Cosmos, not into a guess. Bhavin's 2026 parity figures do not move by a digit, one
command loads and one command undoes.

**Proposed persisted goal objective** (for the orchestrator when the work is taken up):

> Load Cosmos's 2022, 2024 and 2025 CE-MTN-F-04 registers as closed history tickets through the D21 path — a
> profile-driven reader in code, names coded on the operator's machine, doubtful rows settled by a person at
> Cosmos, one import batch and one undo — so the analytics read four years while Bhavin's 2026 parity figures do
> not move; close with the gate report and Nimish's go.

**The gate condition — the goal post.** The work is done, and the gate report `docs/plan/gates/H.md` is written,
only when all of these are true:

1. Every loaded file arrived coded through H2; no coded copy and no key is in the repo. (Consent N14: confirmed in place, Nimish, 17 Nov 2026.)
2. The reader reads the 14 files in under a minute, with zero unexplained columns, in CI on synthetic fixtures.
3. Every trap in §4 (T1–T8, the fourteen profile rules behind them) has a fixture and a test; held rows are counted, listed and settled — none dropped silently.
4. Staging holds the load; Nimish has spot-checked three machines he knows; the production load ran under a time-limited `platform_access` grant after a snapshot; one undo removes that batch only.
5. With the old-era tickets loaded beside the answer key, **every ready M4a figure still equals its key**.
6. The reconciliation report against the workbooks' own summary sheets is filed for Bhavin, with every disagreement named — as a report, not a pass mark.
7. The gaps (2023, grinders 2022, February–March 2022) are labelled on every span that crosses them, and a machine with no entries is "no record", never a good machine.
8. Nimish's go.

**Where it sits in the plan order.** After **37c** (the 1,354-row 2026 log): same loader, same date-only answer,
same ref convention — H1 must not invent a second one. H1–H5 run in the M4a tail beside 38–45 on files that do not
overlap; H6–H7 (the load) run **after the M4a gate**, because Nimish's spot-check uses the analytics face; H8–H9 run
in M4b's first window beside 46–47 and must merge **before 48, 54 and 67** and before M6's 56 and 58. So the order is
**M4a → this work, closing before M4b's 48/54/67 → M4b → M6**, gated as one report, not a new tracker milestone.

## 2. Why, and when: what it unlocks

Ten months of 2026 is too short for the questions M4b and M6 ask. Measured on the registers (mine; the earlier
note's figures in brackets where they differ, §3):

| Area (ticket)                             | 2026 alone                        | With the registers                                                                                                   |
| ----------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Reliability curves, critical spares (67)  | 15 machines with 20+ breakdowns   | **38 machines with 20 or more merged breakdowns, 55 with 10 or more** (earlier note: 56 / 76 — not reproducible, §3) |
| Forecast and Forecast Lab (42)            | About 7 test months               | **24 more test months (2024–2025)**; 68 machines reach the 6-breakdown bar                                           |
| Repeat faults, worsening machine (42, 44) | Ten months of baseline            | A machine compared with its own 2024 and 2025                                                                        |
| MTBF, MTTR on real hours (48)             | One partial year                  | **Three years per machine; 1,965 merged breakdowns** from 2,603 daily rows                                           |
| Did an intervention work (54)             | Little "before"                   | Two years of before, plus a control group                                                                            |
| Machine pages (39)                        | Ten months                        | Three more years, drillable to the paper row                                                                         |
| Fix Finder, find past jobs (43, 57)       | About 1,350 problem-and-fix pairs | **About 2,550 more breakdown problem-and-fix pairs** (4,595 rows carry both across all kinds; earlier note: 2,650)   |
| AI code suggestion test (56, 58)          | Test set built by hand            | **3,983 rows where a person already wrote a code that resolves** to a 2026 code (earlier note: ~3,000)               |
| New-machine failures (OEM, deferred)      | 24 machines under 300 days        | 15 machine codes first appear in 2025, with 141 entries                                                              |
| New: lost to utilities                    | Not recorded                      | **866 machine-hours in 2024, 114 in 2025**, on 229 outage dates; 2022 counts outages but has no hours                |
| New: planned work split                   | Not separable                     | 341 PM rows and 122 planned rows kept out of breakdown hours                                                         |
| New: vendor dependence                    | Spare cost only                   | 88 entries naming CIPL, the OEM or an outside repair (18 in 2024, 70 in 2025)                                        |

**What it does not change.** Bhavin's answer key and every parity figure stay **2026-only**: the legacy profile
cuts at a "data from" date (2026-01-01 for Cosmos) held as a setting, not by the history flag — 37c's log is
history too, and must stay in the legacy figures. No parity row is regenerated; the answer key stays 2026; no screen
joins the parity set and no live ticket is touched. And it cannot do clocks: no response or repair time, no spare
cost, no root cause, no technician ranking. Any screen that needs them leaves this era out and says so.

## 3. Data inventory (verified, 17 Nov 2026)

| Year | Workbooks                    | Machine sheets (with a header / empty) | Entries as read | Machines with entries |
| ---- | ---------------------------- | -------------------------------------- | --------------- | --------------------- |
| 2022 | HMC, TC & TMC-Star, VMC, VTL | 52 / 3 (+2 empty 1×1)                  | 1,099           | 49                    |
| 2024 | the same four, plus GRD      | 73 / 4                                 | 2,331           | 69                    |
| 2025 | the same five                | 87 / 3                                 | 1,332           | 84                    |
| All  | 14 workbooks, 257 sheets     | **212 / 12**                           | **4,762**       | **88**                |

Of the 4,762 rows, 15 are the three identical hidden copies of the 2022 template (5 dateless rows each), so the
real supply is **4,747 entries**. The earlier note said 4,767: a 0.4% difference, inside the stated slack.

**Columns.** Date (no time of day anywhere), month (typed, a cross-check), shift, problem, observed by (always
"Operator"), corrective action, done by, down time in minutes, down time in hours (a formula), maintenance code,
elect/mech, PM hours (2024+), UTI hours (2024+). Filled: problem 4,671 rows, action 4,608, minutes 4,352, code
4,247, elect/mech 4,185, PM hours 353, UTI hours 1,393.

**What varies by year.** The seven extra columns (root cause, spares, RCA reference, critical spares, time
consumed, report time, handover) sit on most 2022 sheets — and on **one 2024 sheet and one 2025 sheet**, because
the template was copied forward. The PM and UTI hour columns start in 2024, except on the hidden template, which
carries both. The header is on row 4 or row 5 (never fixed: 2022 13/39, 2024 66/7, 2025 83/4). Two 2024 and two
2025 sheets head the month column `MACHINE` while holding a month. Three sheets still carry the old form number
`MTN/F/01/02`. Sheet labels vary (`STAR`, `STAR-01`, `Star-02`, `VL-4`, `VTL-04`, `TC-23 ` with a trailing space,
`TMC-4_CY52`, `TMC-5_H-TURN`, `DCMC-1`).

**Gaps.** All of 2023 is absent; the grinders have no 2022 workbook (0 rows against 6/7/7 machines in 2024/2025);
February and March 2022 hold 13 and 9 rows against about 100 in a normal month. The summary sheets (`MTTR MTBF`,
`Q-MTTR…`), the legends (`Code Abrivation`), the stray `1`, `Sheet1–3` and `BD Analysis` are not data.

**The five unmatched machines.** 88 machine codes, 83 match today's 192-machine list once the profile's spellings
apply. Five do not, with 125 entries: **VC-2** (32, all 2022), **VC-3** (7, all 2022), **VC-5** (61, 2022),
**CAM** (10, all 2025), **TC-2** (15 — but every one is the hidden template with no date, so TC-2 has **no real
history**; it is a sheet name, not a machine). `CAM-01` exists in the list: CAM is probably CAM-01, and that is a
question for Bhavin, not a spelling fix we make.

**Where my read differs from the recommendations note** (everything else verified within tolerance):

| Claim                                         | Mine                                                          | Effect                                                                                                      |
| --------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 88 machines, 5 unmatched, 125 rows            | Confirmed — but **TC-2's 15 rows are the template** (no date) | 4 real machines, 110 real rows; TC-2 goes to the tray                                                       |
| 76 machines with 10+ / 56 with 20+ breakdowns | **55 / 38** merged episodes (58 / 44 counting daily rows)     | The earlier numbers are not reproducible under any obvious rule; H9 re-measures, 67 uses the engine's count |
| "2024 and 2025 say Maint. Team"               | 2024: 7 rows with a person-shaped value; 2025: 9              | Code them too (H2); the exposure is 542 rows, still ~500                                                    |
| "about 20" swapped code/E-M rows              | 25 rows where the code and category disagree; 1 provable swap | Rule stays; the tray settles them, never the reader                                                         |
| 519 rows with no code; no `HM`                | **515** blank; `HM` never occurs; 14 spellings need Bhavin    | Alias list is bigger than N12 (§5 Q8)                                                                       |
| ~940 / ~170 machine-hours lost to utilities   | **866 / 114**                                                 | 2025 is 33% lower — re-measure in H9, do not quote the old figure                                           |
| ~3,000 AI test rows                           | **3,983** with a resolvable code                              | Better test set; no action                                                                                  |

## 4. The traps, and the rule for each

Every rule is data in the profile; each gets one synthetic fixture and one test named after it. "Held" means a
person at Cosmos settles it; nothing is guessed. The profile numbers its rules P1–P14; they sit under the eight trap
families below, which is what the fixtures are named after.

| #   | Trap (measured)                                                                                                                                                                                                                                                                                                                                                         | The rule                                                                                                                                                                                                                                                                                                                             | The proof (H4 test)                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | **Power cuts copied onto every machine's sheet.** 1,521 utility rows on 229 dates; 132 dates hit 2+ machines, 77 hit 5+, 21 hit 20+. 2024 alone: 1,283 rows, which would read as 2,156 breakdowns against 831 real ones. 2025: 152 rows.                                                                                                                                | A utility row is **never** a breakdown. Its hours are the UTI column × 60 (PM/UTI are hours; minutes are minutes). One outage = one date across machines: the "lost to utilities" figure sums per machine and counts the event once; the plant event is not a machine's MTBF.                                                        | One fixture date on 6 machines gives 1 outage, 6 machine-hour entries, 0 breakdowns; a 2022 fixture (no UTI column) gives 1 outage and no hours.               |
| T2  | **A repair over days is one row per day.** 2,603 dated breakdown rows merge to **1,965 episodes**; 294 runs cover 932 rows; the longest is 20 rows.                                                                                                                                                                                                                     | Same machine + same normalised problem + each row within 4 days of the last (a profile number) = one episode. The ticket starts on the first date, its downtime is the sum, each daily row is a dated history line. The daily rows stay available for the legacy per-row view.                                                       | Three synthetic rows 2 days apart become one ticket of 3 lines and the summed minutes; a 5-day gap makes two.                                                  |
| T3  | **The codes changed.** 515 rows have no code; 32 spellings; 14 match the 2026 list exactly, 3 obvious aliases (UTY→UTI, TR→TUR, T→TUR), **14 need Bhavin** (CP, E/M, FNC, M/E, M/M, M/S, MIX, MPG, MS, NIS, P/M, PAR, S, TL). 25 rows disagree between code and elect/mech; 1 is a provable swap.                                                                       | Resolve through the existing `list_item.aliases`, never a guess. Unmapped keeps the verbatim code and is reported. A blank code stays null. Disagreement between the two columns is held, not swapped. The alias table ships as a **proposal** for Bhavin (Q8), with who agreed and when.                                            | One fixture per case: exact, alias, unmapped, blank, disagreeing, swapped. A test fails if any alias names two items.                                          |
| T4  | **Dates and shifts.** 4,465 Excel dates, 270 typed as text (232 of them in 2022), 7 unreadable, 5 real rows with no date (plus 15 template rows), 8 with the wrong year (2002, 2023, 2021, 2020×2, 2021; 2026×2). The month disagrees on 106 rows and 132 month cells hold a date. 52 shifts are unreadable (39 in 2025), a dragged series 4…41 and 4TH…13TH; 15 blank. | Day-first text. A year that is not the file's year is **held, never corrected**. The month is a cross-check, flagged when it disagrees. A shift outside 1/2/3 is null + flag. A date-only row's ticket is the plant date at that shift's start, marked **estimated** — reuse 37c's answer, do not invent a second one.               | Fixtures for each text format, each bad value, and one date-only row that must produce an estimated instant and no clock figure.                               |
| T5  | **Three downtime columns that overlap.** Minutes on 4,352 rows (1,209 zero); the hours column is minutes/60 on 4,342. **166 rows carry breakdown minutes _and_ PM/UTI hours**; on 129 of them the minutes equal the PM hours × 60 exactly. 283 rows are a round shift (212 × 480, 60 × 600, 11 × 960).                                                                  | Minutes is the measure of record; PM/UTI hours are kept apart (×60). When a row carries both, count it once and flag `double_counted_hours`. A round-shift figure is kept but flagged `round_shift_downtime` ("all shift", not a measurement). Phases and UTI never add to breakdown minutes.                                        | A fixture with minutes + PM hours counts once; a 480-minute row is kept and flagged; a fixture with only PM hours makes a PM ticket with no breakdown minutes. |
| T6  | **People.** 2022 names a technician on 526 rows in 63 spellings; 2024 has 7 rows (5 spellings), 2025 has 9 (6). No phone number. 2,122 rows say `Maint. Team`, 422 say `Operator` in done-by, and observed-by is always `Operator`.                                                                                                                                     | Tokens only, from H2. A person is linked **only on an exact match** to an existing person; no person is created from old paper. `Maint. Team`, `Operator`, CIPL, OEM and `NA` are not people. No technician ranking on this era; the Guide says so.                                                                                  | A workbook with made-up names comes out with none and no phone; a token whose name matches no person links nothing and is reported.                            |
| T7  | **Junk.** 14 sheets are padded to 1,048,576 rows (about 300 KB of content in 38 MB). 12 empty machine sheets, 3 identical hidden template copies, 5 stray cells right of the header, 32 duplicate groups (37 extra rows), and 4 rows carrying 6 values in the 2022 "always empty" columns.                                                                              | Detect the header as the first row holding both `SR` and `PROBLEM`; stop after 200 consecutive empty rows; read hidden/summary/legend sheets only to census them, never as data. An exact duplicate is held `duplicate_row`. A stray is reported with sheet and row. Any value in the seven extra columns is reported, never loaded. | A 1,048,576-row sheet reads in under 2 s; the hidden copy adds no row; a duplicate is held; a stray cell is reported.                                          |
| T8  | **A machine with no entries is not a good machine** — 2023 is missing for everyone; the grinders have no 2022; a machine bought in 2025 has no earlier history.                                                                                                                                                                                                         | A span with a gap is labelled. A machine with no rows in a span is "no record" and is listed apart, never ranked as reliable. The profile's `gapDays` (3) decides when a span counts as gapped.                                                                                                                                      | A fixture machine with an empty month is "no record"; a span crossing 2023 says so.                                                                            |

## 5. Decisions and defaults

Each is a **switch** with the recommended default: an answer changes a setting, not the code. The home is one
`setting` row, `analytics.history` (jsonb, read beside `analytics.profile`); the numeric profile cannot hold booleans
and D17 allows a `setting` key. No migration.

| #   | Question                                      | Switch (default = recommendation)                                                                                                      | If the answer flips                                                                               |
| --- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | Is a power cut a breakdown?                   | `utilityIsBreakdown: false`; outages shown as "lost to utilities" and never in MTBF/MTTR                                               | One switch: utilities join the breakdown figures. No reload — the tickets already carry the kind. |
| 2   | A repair over days: one breakdown or per day? | `mergeEpisodes: true`, `episodeGapDays: 4`; daily rows stay as history; `perRowFigures: false` keeps the legacy per-row view available | `mergeEpisodes: false` reads each row as a breakdown (the legacy number every time).              |
| 3   | Long jobs in the PM column, and accidents     | `vendorIsBreakdown: true`, `accidentIsBreakdown: true`, `plannedIsBreakdown: false`                                                    | Each is one boolean; a flip re-runs the engine, not the load.                                     |
| 4   | VC-2, VC-3, VC-5, CAM, TC-2                   | `retiredMachines: true`, loaded as `machine.status = 'scrapped'` so plant totals and machine counts stay right; CAM held until Q4      | Off: the five are held and plant totals under-count.                                              |
| 5   | 2023, grinders 2022, February–March 2022      | `gapPolicy: 'show'`; nothing is filled in; a span that crosses a gap says so                                                           | There is no "hide" default; a plant may label a gap as "not kept" (a display string only).        |
| 6   | Technician names from 2022                    | `personPolicy: 'codes'`; link on exact match only; `rankTechnicians: false` for this era                                               | On would rewrite a product rule (DATA-MAP Q4) — stop and ask Nimish.                              |
| 7   | Rows with no words, bad dates, duplicates     | `doubtfulRows: 'hold'`; a person at Cosmos answers keep / fix / drop with a reason; the answer is recorded in the batch ledger         | There is no "guess" setting. Off = the load refuses.                                              |
| 8   | Name coding (consent is settled) | Not a switch: consent is confirmed in place (Nimish, 17 Nov 2026); H2 codes the names on the operator's machine before any AI pass | The gate records H2 done; no work waits on paperwork |

One more switch belongs to the parity rail rather than to these eight: `legacyFrom: '2026-01-01'`, the date the legacy
figures read from — a setting, not the history flag, because 37c's log is history and must count.

**The nine questions for Bhavin** (facts only he has). The ledger records each answer.

| #   | Question                                                                                                     | Owner  | Needed by        | Effect if unanswered                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------ | ------ | ---------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | Do you have the 2023 registers?                                                                              | Nimish | H6 (before load) | 2023 stays a labelled gap; no figure pretends it is a quiet year.                                      |
| 2   | Is there a 2022 file for the grinding machines?                                                              | Nimish | H6               | Grinders have no 2022; per-machine spans start in 2024 and say so.                                     |
| 3   | February and March 2022 have 13 and 9 rows. Is some data missing?                                            | Nimish | H6               | Two months are labelled "nearly empty"; trend figures leave them out.                                  |
| 4   | VC-2, VC-3, VC-5 scuttled? Is CAM the same as CAM-01? Is TC-2 a real machine (it has only template rows)?    | Nimish | H1/H6            | VC-2/3/5 load as scrapped; CAM and TC-2 stay held and out of plant totals.                             |
| 5   | 2024 has 1,283 power-cut rows and 2025 only 152. Did the team stop writing them?                             | Nimish | H9 (utilities)   | The 2025 drop is shown as recorded, with a note; the money case is not claimed.                        |
| 6   | From 2024 "Done by" says Maint. Team. Is the technician recorded anywhere else?                              | Nimish | H2/H6            | This era names nobody after 2022; no ranking, as decided.                                              |
| 7   | The 2024 PM column also holds vendor repairs and machine shifting. Was that on purpose?                      | Nimish | H4/H9            | The default reads vendor repair as breakdown, shifting as planned.                                     |
| 8   | Old codes to the 2026 list: confirm the proposed alias table (14 spellings have no obvious partner).         | Nimish | H4 (profile)     | Unmapped codes stay verbatim and are reported; the cause ranking counts them beside, never as "Other". |
| 9   | When does the production day start, and does a 3rd shift that crosses midnight belong to the day it started? | Nimish | H8               | History figures use the plant date as written and never compare shifts across midnight.                |

## 6. Architecture — the narrow D21 path

Not a general engine: one source, one profile, one loader, one undo. Call it an engine only after a second,
different source has gone through it.

```
coded .xlsx on the operator's machine (the key stays there, never in the repo)
  -> H2 code names -> H3 reader -> H4 profile rules -> H5 check + review tray
  -> H6 load: closed tickets via tickets.importTickets (channel backfill), one batch
  -> H7 production load + reconciliation; H8/H9 era-aware figures
```

- **The record shape** is the contract: `packages/shared/src/history-file.ts`, versioned, Zod. D21's `v1` row
  cannot say four things this data needs, so H1 writes `v2`: `entryKind` (breakdown, accident, utility, pm,
  planned), `dateOnly` + shift, `episodeId`, `outageId`, three downtime fields kept apart, `codeVerbatim` /
  `emVerbatim`, `source {fileSha256, sheet, row}`, and `flags` (reported, never silently fixed).
- **The profile** is `cosmos-register-ce-mtn-f-04`: header names, date formats, machine spellings with who agreed
  and when, code aliases, the kind rules, the four-day episode gap, the stop-after-200-empty-rows number. A second
  plant's register is a second profile file, not new code.
- **Coding names** extends the existing hand-run pseudonymiser (today JSON-only) to `.xlsx`: every value in `DONE
BY`, every name in the action text, every phone-shaped number becomes a token; every other cell is untouched. The
  key is refused if it resolves inside the repo and is deleted after the production load.
- **Storage** is the existing past-breakdown path: `tickets.importTickets(tx, tenantId, rows)` with channel
  `backfill`, closed, `closeKind: 'report'`, and its own ref series (`H22-0001`, `H24-0001`, `H25-0001`) so no live
  `BD-` number is consumed. **No new table, no new column, no migration expected.** Safety order (D21): names coded (H2) →
  coded copies → check on staging → Nimish's spot-check → snapshot → production under a grant → undo or snapshot.
- **Outages** are closed tickets per machine hit (work type `utility`, downtime = the UTI hours), and the shared
  date is the event: "outages per year" counts distinct outage dates, "hours lost" sums per machine, both drill to
  tickets. H1 proves this against the alternative (one general ticket per outage with the machine hours in a
  report) and records why the loser lost. This is a technical fork settled by running it, not a question for
  Nimish.
- **The ledger and the undo.** One `import_batch` per load (`source = 'history-registers'`), one `import_row` per
  source row (coded content only), the completion fingerprint, and `undoImport` — the path ticket 09 protects.
  **Prefactor, found by reading the code:** `imports/repo.ts` hard-codes `source = 'bhavin'` in insert/fail/finish,
  and `imports/undo.ts` accepts only the synthetic and real contracts. H1 parametrises the source and adds the
  history contract, with ticket 09's undo and replay tests passing unchanged.
- **Reading Excel** reuses the repo's own 96-line read-only reader (`tools/answer-key/xlsx.ts`) — no new dependency.
  Promote it out of `tools/` (test-only) and make it row-streaming so a 1,048,576-row sheet is not 1M arrays. If that
  misses the one-minute budget on VTL-2025, the escape is SheetJS CE 0.20.x, already approved in `THIRD_PARTY.md`
  under the import-only rule — H3 settles it by measuring.

**Explicitly out:** an upload screen; any other plant's files; CSV, PDF or scanned paper; AI reading the text (M6
suggests codes, spare and vendor from the words, confirmed by a person — this plan does not); editing live
tickets; a new table; a second undo path; a general import format (M5).

## 7. Data mapping

| Register concept                   | Our home                                                                                                                 | The rule                                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Machine (sheet name)               | `machine.id` (`machine.status = 'scrapped'` for the retired)                                                             | Profile spellings only; no match → held. `CAM`/`TC-2` held (Q4). The registers hold no machine moves (`machine_move` untouched). |
| Date + shift                       | `ticket.reported_at` = plant date at that shift's start (`shift` row), marked **estimated**; `breakdown_report.date`     | Date-only. No clock figure reads this era. Reuse 37c's instant rule.                                                             |
| Problem / corrective action        | `ticket.problem`, `breakdown_report.problem` / `corrective_action`; each daily row of an episode is a dated history line | Free text passes the plant's redactor before the engine sees it (already true of `load.ts`).                                     |
| Observed by ("Operator")           | `breakdown_report.observed_by` as text, or dropped                                                                       | No information; H1 keeps it in the import row only.                                                                              |
| Done by                            | `breakdown_report_person` role `done`, **only on an exact match** to an existing person; the token stays in `import_row` | No person is created from old paper. `Maint. Team`/`Operator` are not people.                                                    |
| Down time (minutes / hours)        | `breakdown_report.downtime_min` and the ticket's cached `downtime_min`; the hours column is checked, not stored          | Minutes is the measure. Round-shift and double-count flags reported.                                                             |
| PM hours                           | A closed ticket with work type `pm`, report minutes = PM hours × 60, `maint_code = 'PM'`                                 | Mirrors the 2026 platform (its PM hours are report minutes with code PM). Excluded from breakdown figures.                       |
| UTI hours                          | A closed ticket with work type `utility`, downtime = UTI hours × 60                                                      | Never a breakdown (switch 1). 2022 has none.                                                                                     |
| Vendor repair / shifting in PM col | Breakdown ticket (vendor) or planned ticket (shift/fit), work type tells them apart (switch 3)                           | One kind per row; the switch decides which figures read it.                                                                      |
| Maintenance code                   | `breakdown_report.maint_code` via `list_item.aliases`                                                                    | Unmapped verbatim + reported; blank null; alias list is Bhavin's (Q8).                                                           |
| Elect / mech                       | `breakdown_report.breakdown_category` (the list already holds E, M, E/M, PM)                                             | Disagreement held. Never merged into the code.                                                                                   |
| The seven 2022 extras              | Read, reported, **not loaded**                                                                                           | Expect empty; 4 rows carry 6 cells, which the tray explains.                                                                     |
| Channel and work type              | `ticket.raised_channel = 'backfill'`; `ticket.work_type` = breakdown / utility / pm / planned / accident (list items)    | Backfill means closed history with no clocks; the work type is what every switch reads.                                          |
| Source reference                   | `import_batch` (`source = 'history-registers'`) + `import_row` payload `{fileSha256, sheet, row, episodeId, outageId}`   | Every ticket drills to its cell; the payload holds tokens, never names.                                                          |

**What each figure reads.** `EngineData` already carries `source: 'live' | 'history'`, so the seam needs one
addition, not a rewrite: a per-profile "data from" date and the `analytics.history` switches.

| Figure                               | Years it reads                       | Filter                                                                           |
| ------------------------------------ | ------------------------------------ | -------------------------------------------------------------------------------- |
| The legacy parity figures (38–45)    | 2026 only                            | `legacyFrom = 2026-01-01`; legacy rules per row; old eras absent                 |
| MTBF / MTTR / availability (48)      | 2022–2026                            | production machines, breakdown episodes, one per episode, PM/utility/planned out |
| Reliability, critical spares (67)    | 2022–2025, then live                 | breakdowns only, censored per machine, minimum failures                          |
| Forecast and Forecast Lab (42)       | 2024–2025 backtest, 2026 live        | breakdowns only; the plant's 6-breakdown confidence bar                          |
| Repeat faults and trend (42, 44)     | all years                            | breakdown episodes; the "again/still/temporary/not ok" flag words                |
| Fix Finder (43, 57)                  | all years                            | problem + action, redacted, matched per machine and code                         |
| Machine page (39)                    | all years                            | one machine; every figure drills to the paper row                                |
| New: lost to utilities               | 2024–2025 (hours), 2022 (count only) | work type `utility`; the plant event counted once per date                       |
| New: planned split                   | all years                            | work type `pm` / `planned`, kept apart from breakdown                            |
| AI code-suggestion test set (56, 58) | 2022–2025                            | rows with problem text and a code that resolves to a 2026 code                   |

## 8. Tickets

Nine vertical tickets, backend lane, one PR each with one `changes/` fragment, sized to the hour-to-PR rule. H3
and H4 are the largest; H4 may split (rules 1–7, 8–14) without changing its promises. "H" is the history milestone;
its gate is §1.

**H1 — Contract, profile shape and the decision record.** Milestone: H (M4a tail). Blocked by: 37c.
Delivers: the v2 record shape, the profile skeleton, a D33 that amends D21, and the loader prefactor.
Write areas: `packages/shared/src/history-file.ts`, `apps/server/src/modules/imports/{repo,batch,undo,index}.ts`,
`docs/decisions/D33-history-register-reader.md`.

1. [API] Given a row with no `entryKind`, or `dateOnly` with no shift, the check refuses it with its row id and reason; a v1-shaped file is refused by version.
2. [API] Given 3 rows of one episode and 4 rows of one outage, the builder emits one episode and one outage with the right members and summed minutes (pure test).
3. [API] A register batch opens, finishes and undoes through the published `imports` functions, and ticket 09's undo and replay tests pass unchanged.

**H2 — Coded copies.** Milestone: H. Blocked by: none (tooling only; runs beside H1).
Delivers: `history:pseudonymise` reads `.xlsx`, writes coded copies and a key that never enters the repo.
Write areas: `scripts/pseudonymise-export.ts` (generalise), `scripts/history-pseudonymise.ts`, `tools/pii-sources.ts`.

1. [API] Given a workbook with made-up names in done-by and inside the action text, and a phone-shaped number, the copy holds tokens and no name and no phone.
2. [API] Every non-name cell is unchanged (a byte-level comparison of the date, number and formula cells is empty), and `--map` inside the repo is refused.
3. [Process] One run on the real files codes 63 spellings in 2022, 5 in 2024 and 6 in 2025, and prints the count.

**H3 — The reader.** Milestone: H. Blocked by: H1.
Delivers: a streaming reader, header detection, sheet census, padding stop, stray report; `history:read` counts.
Write areas: the promoted reader (`apps/server/src/modules/analytics/register/reader.ts`), its tests,
`tools/answer-key/xlsx.ts` (callers updated).

1. [API] Given a synthetic workbook, the header is found on row 4 or 5, the 14 columns are recognised, the summary, legend and hidden sheets add no record, and a stray cell is reported.
2. [API] A sheet padded to 1,048,576 rows stops after 200 empty rows and reads in under 2 s; all 14 synthetic files read in under a minute.
3. [API] `history:read <dir> --profile … --out <file>` prints sheets read, rows in, records out, held and skipped, and the last three always add up to the rows in.

**H4 — The profile rules and the records.** Milestone: H. Blocked by: H3.
Delivers: the fourteen profile rules (P1–P14) as data, one fixture and test per trap T1–T8, the record builder.
Write areas: `packages/domain/src/history/*` (pure), the profile file, `packages/domain/test/history-*.test.ts`.

1. [Engine] One fixture per trap T1–T8 (§4) and one test per named rule behind it: each gives the expected record, flag or hold.
2. [Engine] Machine normalisation: 96 labels → 88 codes, 83 matched, 5 held; `DCMC-1`→`DCMC-01`, `VL-4`→`VTL-4`, `TC-23 ` (trailing space) matched; the two empty `TC-24`/`TC-25` sheets add no record.
3. [Engine] Episodes and outages join as T1/T2; a duplicate is held, never dropped; the record count plus held plus skipped equals the row count.

**H5 — The check and the review tray.** Milestone: H. Blocked by: H4.
Delivers: a check that blocks, holds and reports with counts and dates only; a tray a person at Cosmos fills in.
Write areas: `apps/server/src/modules/analytics/register/check.ts`, the tray export, the answers file.

1. [API] A file with a blocking class loads nothing; the report holds row ids, counts and dates, no names and no ticket text.
2. [Process] Held rows export as a sheet (keep / fix to value / drop with a reason); the answers file is applied on the next check; an unanswered held row still refuses the load.
3. [API] Each answer is recorded in the batch ledger (who, when, what), and a dropped row is counted in the ledger.

**H6 — Load and undo on staging.** Milestone: H. Blocked by: H5, decisions 1–7, H2 done.
Delivers: the load, the ref series, idempotency, independent undo, and Nimish's staging spot-check.
Write areas: `apps/server/src/modules/analytics/register/load.ts`, `scripts/history-load.ts`, staging run notes.

1. [API] Given the same file twice, the second load adds nothing and returns the first batch id; a register batch and a 37c batch undo independently.
2. [API] Live tickets, counters and figures are unchanged after a load and after an undo (before/after counts).
3. [API] Old history uses `H22/H24/H25-` refs, never a live `BD-`; every loaded ticket drills to its source row.
4. [Process] Staging first; Nimish spot-checks three machines he knows and the gate records them.

**H7 — Production load and reconciliation.** Milestone: H (after the M4a gate). Blocked by: H6.
Delivers: the backed-up, granted production load; the reconciliation report; the undo drill.
Write areas: `scripts/history-load.ts`, `scripts/history-reconcile.ts`, `docs/plan/gates/H.md`.

1. [Process] A full snapshot's reference is recorded before the load; the load runs under a 24-hour `platform_access` grant approved by Cosmos's admin; every audit line carries the grant.
2. [Engine] The reconciliation report compares counts and hours per workbook and machine-month with the workbooks' own summary sheets; every disagreement is listed for Bhavin. It is a report, not a pass mark.
3. [API] The undo drill removes that batch only, and the snapshot is the stated fallback.

**H8 — Era-aware analytics, parity unchanged.** Milestone: M4b (first window, beside 46–47). Blocked by: H6 on
staging.
Delivers: the "data from" cut, the switch reads, gap labelling, no-record-not-reliable.
Write areas: `packages/domain/src/analytics/{types,computers,engine}.ts`,
`packages/shared/src/analytics.ts`, `apps/server/src/modules/analytics/{load,profile}.ts`.

1. [Engine] With old-era tickets loaded beside the answer-key input, every ready M4a figure still equals its key.
2. [Engine] Each kind (utility, PM, planned, accident) can be included or left out; a span with a gap is labelled and never read as zero.
3. [Engine] A machine with no rows in a span is "no record", never ranked as good.

**H9 — The first history figures.** Milestone: M4b. Blocked by: H8.
Delivers: lost to utilities, the planned split, MTBF/MTTR per machine-year, repeat episodes, vendor wait; each
registered with a drill target.
Write areas: `packages/domain/src/analytics/computers.ts`, `registry.ts`, the machine page and the utilities screen
(frontend lane), `docs/spec/parity.yaml` (no-parity line: these are additions, not platform figures).

1. [Engine] Hours lost to utilities per machine and per month (2024: 866 h; 2025: 114 h) and outages per year (229 dates), each with a drill target; 2022 shows the count and no hours.
2. [Engine] MTBF/MTTR per machine per year with the episode rule, beside the legacy figures and never replacing them.
3. [Engine] Repeat episodes (the flag words) and the planned split, each hand-computed in a fixture.
4. [Browser] The machine page and the utilities screen show them, each drilling to its rows.

## 9. Analytics capabilities unlocked, and how each is proven

| Capability (ticket)                         | What it becomes                                                                 | Proof                                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Reliability curves and critical spares (67) | 38 machines at 20+ merged breakdowns (55 at 10+); a fit per machine or category | Reference values computed independently; a fixture machine with too few failures says so |
| Forecast, Forecast Lab (42)                 | 24 more backtest months; 68 machines above the 6-breakdown bar                  | The Lab reproduces the answer key on 2024–2025 hand-computed months                      |
| Repeat faults, worsening machine (42, 44)   | A machine against its own 2024 and 2025; the flag words as a free first signal  | A fixture with an "again" episode is flagged; a clean one is not                         |
| MTBF, MTTR, availability on real hours (48) | Three years per machine; a 20-day repair counted once                           | Hand-computed fixture: 1 episode, summed minutes, one failure                            |
| Interventions (54)                          | Two years of before, plus the control group                                     | A fixture intervention with a known before/after                                         |
| Machine pages (39)                          | Three more years, each figure drillable to the paper row                        | A machine page test opens the 2024 row behind a figure                                   |
| Fix Finder, find past jobs (43, 57)         | About 2,550 breakdown pairs (4,595 rows carry both across kinds)                | Retrieval on a hand-labelled sample; no template notes cited                             |
| AI test set (56, 58)                        | 3,983 rows with a person-written resolvable code                                | CI scores the fake provider against it; the count is a test constant                     |
| New: lost to utilities                      | 866 h (2024) and 114 h (2025) per machine, 229 outage dates                     | Hand totals from a synthetic outage fixture; the 2025 drop is labelled                   |
| New: planned work split                     | PM and planned hours kept out of breakdown hours (341 + 122 tickets)            | A fixture where a PM row and a breakdown row do not mix                                  |
| New: vendor dependence                      | 88 entries (18 in 2024, 70 in 2025)                                             | The flag is a word rule; a hand-labelled sample of 20 rows                               |

## 10. Execution plan and order

| Phase | Tickets     | Can run together                                              | Must be true first                                                                                     |
| ----- | ----------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 0     | —           | —                                                             | H2 ready on the operator's machine; decisions 1–7 answered; **no file moved before this**              |
| 1     | H1, H2, H3  | H2 beside H1; H3 after H1 (shared `packages/shared`)          | 37c merged; H2 is the first pass on the files                                                          |
| 2     | H4, H5      | H4 then H5 (H5 reads H1's contract); one writer per file area | Phase 1 green in CI                                                                                    |
| 3     | H6, then H7 | No — the load is serial, staging then production              | Decisions 1–7; the tray's answers in; the M4a gate passed for H7                                       |
| 4     | H8, then H9 | H8 beside 46–47; H9 after H8 (computers file)                 | H6 on staging; the parity test red-then-green                                                          |

**Effort and lanes.** Nine tickets at the one-hour-to-PR rule, plus review and two load runs: about **12–15 builder
days** and **4–6 calendar weeks**, most of the calendar spent on the decisions and Bhavin's answers. The backend
lane owns H1–H9 except H9's two web additions (frontend lane, frozen interfaces). H2 uses one builder on `scripts/`;
H1/H3 share `packages/shared` and never run together; H4/H5 are disjoint; H8/H9 both touch `computers.ts` and run in
order. No migration, so no lock — unless H1 proves one is needed, then stop and ask.

**Stop conditions** (do not push through any of these):

1. Any parity figure moves, or the parity test needs its expected value changed.
2. A person's name or phone reaches a coded file, a commit, a fixture or a log.
3. A new table or migration turns out to be needed (stop, ask, do not improvise).
4. More than about 5% of rows (roughly 240) are held with no answer when the load is due.
5. The production load is asked for without a snapshot or outside a grant.
6. The workbook summaries disagree in a way that suggests the reader is wrong, not the summaries.
7. A product decision changes after the load: undo and reload; never edit the tickets.

## 11. Risks

| Risk                                      | Why it bites                                                                                     | Mitigation                                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| **Name handling (D21)**                   | The files arrived uncoded; 542 rows name someone; a further AI pass before coding compounds it | H2 codes the names on the operator's machine before any AI pass; no coded copy, key or name in the repo |
| Unrepeatable numbers if AI reads the text | A model's reading changes between runs; the figures stop being auditable                         | The reader is code and profile only; AI comes in M6 as suggestions beside the facts                                         |
| Data quality                              | 5% doubtful rows, 515 blank codes, 8 wrong years, 283 round-shift figures                        | Holds and flags, a person at Cosmos, and a reconciliation report — never a silent fix                                       |
| Bhavin's parity drifts                    | The old years are in the same tables; one careless filter and the 2026 keys move                 | `legacyFrom` as a setting, a parity test with old-era tickets present, and a gate that reads it                             |
| The five unmatched machines               | Plant totals and per-machine curves go wrong silently                                            | Retired machines loaded as scrapped; CAM and TC-2 held until Q4; a census test on 88/83/5                                   |
| Missing 2023 and grinder 2022             | A gap read as zero makes every machine look reliable                                             | The gap rule (T8) and the Guide's sentence; no figure without a gap label                                                   |
| One-year vs multi-year comparability      | 2026 has clocks and a different code list; the registers have none                               | The era switch, the legacy cut, and "this era has no clock" on every clock figure                                           |
| Scope creep into a general importer       | M5's format is deferred; a second source would tempt a rewrite                                   | The profile is the extension point; an engine only after a second source goes through                                       |

## 12. Keep/absorb policy for the old docs

This document **supersedes** `docs/plan/history-registers-scope.md` and `docs/slices/history-registers.md` on draft
PR #292; when it is accepted, #292 closes and its branch is not merged.

**Kept (corrected where my read differed, §3):** the inventory and its counts; the seven traps and their rules; the
eight decisions and defaults; the nine Bhavin questions; the D21 path (code → check → load → undo, staging first,
production under a grant after a backup); the five stations; the "profile, not code" extension point; "never guess, a
person settles"; "no new table"; the non-goals; the plugin rules (repeat-fault words, no-record-not-reliable,
normalisations recorded with who agreed and when). **Changed:** the reader is code, not a Claude session (D33 amends
D21's step 3); nine tickets instead of six; the decisions are `setting` switches; the outage storage is proved by H1
and defaulted to per-machine tickets with the date as the event; the loader prefactor (the hard-coded `bhavin`
source, the undo contract allowlist) is named; overstated figures are re-measured and flagged.

**Left to the plan of record:** the tracker rows in `MILESTONES.md` (H1–H9 are added when the work is taken up, not
now); `DATA-MAP.md` still lists `history_breakdown` as "planned, M4a" — D17 removed it and this plan confirms closed
tickets, so that row is corrected with H1's D33; N14 is recorded as in place (Nimish, 17 Nov 2026) in `NEEDS.md`.
