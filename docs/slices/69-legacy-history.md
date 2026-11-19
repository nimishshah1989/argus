# M4b-69 — legacy history 2020–2025

Ticket 69 (M4b; the row and detail section are already in `docs/plan/MILESTONES.md` — this plan does not edit it).
Nimish confirmed the historic data is the whole legacy warehouse, not only the 2026 log. The files are in this
workspace at `.agents/data/legacy/` (extracted, real names, never committed): `y2022/` (HMC, TC & TMC, VMC, VTL),
`y2024/` and `y2025/` (the same five families plus GRD). **Only 2022, 2024 and 2025 exist here; no 2020, 2021 or
2023 file was found.** The 2026 log is ticket 37c (`docs/slices/37c-breakdown-load.md`) and is the precedent this
plan follows everywhere: the generator, the `argus.synthetic-bhavin/v1` contract, the one importer, the shift
placement, the alias config and the reconcile rule.

Nothing here changes the schema, the synthetic contract or any screen. The ticket is one converter that turns the
14 workbooks into redacted synthetic exports, and one verified load of those exports through the existing
`pnpm import:bhavin` path.

## What the sheets actually hold (measured, not assumed)

I read every sheet with the workspace python (`openpyxl`, read-only). Worst workbook: `VTL-2025.xlsx` reports a
dimension of 1,039,909 rows; the repo's own reader (`tools/answer-key/xlsx.ts`) reads only real `<row>` elements, so
the converter is unaffected.

| Fact                                              | 2022    | 2024      | 2025      | Total     |
| ------------------------------------------------- | ------- | --------- | --------- | --------- |
| workbooks                                         | 4       | 5         | 5         | 14        |
| machine sheets with rows                          | 50      | 72        | 86        | 208       |
| distinct plant machines                           | 44      | 66        | 80        | —         |
| rows with an SR.NO                                | 1,335   | 3,131     | 2,130     | 6,596     |
| rows with a usable DATE                           | 1,090   | 2,327     | 1,328     | 4,745     |
| **rows loaded as tickets**                        | **974** | **2,296** | **1,296** | **4,566** |
| PM rows inside the load                           | 46      | 183       | 171       | 400       |
| UTI / accident rows inside the load               | 61      | 1,261     | 149       | 1,471     |
| breakdown rows inside the load                    | 867     | 852       | 976       | 2,695     |
| rows dropped: no usable DATE (template rows)      | 245     | 804       | 802       | 1,851     |
| rows dropped: out of the workbook's year          | 8       | 5         | 7         | 20        |
| rows dropped: machine code not in the plant       | 108     | 26        | 25        | 159       |
| blank problem text (loaded with the 37c fallback) | 7       | 49        | 28        | 84        |
| blank TOTAL DOWN TIME (loaded as 0 minutes)       | 17      | 378       | 14        | 409       |

The load arithmetic, per year: `rows with a date − out-of-year − unknown machine = loaded`.
2022: 1,090 − 8 − 108 = **974**. 2024: 2,327 − 5 − 26 = **2,296**. 2025: 1,328 − 7 − 25 = **1,296**.
Total: 4,566 = 2,695 breakdown + 400 PM + 1,471 UTI. Per family:

| Year | HMC | TC & TMC | VMC   | VTL | GRD | Total |
| ---- | --- | -------- | ----- | --- | --- | ----- |
| 2022 | 40  | 345      | 491   | 98  | —   | 974   |
| 2024 | 59  | 803      | 1,187 | 207 | 40  | 2,296 |
| 2025 | 45  | 424      | 710   | 85  | 32  | 1,296 |

**What is unreconciled, named.** 159 rows name a machine the plant no longer holds: retired `TC-2` (5), `VC-2`
(31), `VC-3` (7), `VC-5` (60) and the `Star` sheet (5) in 2022; `Star-01` (23 + 11) and `Star-02` (3 + 14) in
2024/2025. The 20 out-of-year rows are 10 stale copies of the 2022 `TC-2` sheet sitting inside the 2024 and 2025
workbooks, plus 10 strays dated 2002 (1), 2020 (2), 2021 (2), 2023 (2), 2026 (2) — none of those years exists as a
workbook. Two date cells are unreadable (a literal `DATE` and `3012.2022` in `VC-5` 2022) and are counted as no
date. `TC-24`/`TC-25` (2022) and the VMC `1` sheets are empty; `VC-15` and `VTL-04` (2025) are sparsely
filled but real (their header rows carry newlines, `SR.\nNO.` — the reader must flatten before matching).

## Rulings (frozen; each with its cost if wrong)

### Source set and rows

**R1 — the source set is the 14 workbooks, and a row's year is the workbook's year, not the sheet title and not the
row's date.** `TC-2`'s title says “2022” in all three workbooks and its five rows are 2022 rows in all three; the
2024 and 2025 copies are stale. A row whose date year differs from its workbook's year is `out_of_year` and is not
loaded. Cost if wrong: the two 2023-dated rows would be missed; adding the 2023 workbook later loads them with no
duplicate risk (R11's identity is per source row).

**R2 — machine sheets are discovered by their header, not by their name.** A machine sheet is a sheet whose rows
1–10 contain a header row with `SR.NO` and `PROBLEM` after flattening every non-alphanumeric character (the raw
header cells are `SR.\nNO.`, `OBSERVED \nBY`, `TOTAL \nDOWN TIME\n`, `TOTAL DOWN TIME ( In Min. )`). Summary sheets
are excluded by name (`MTTR`, `MTBF`, `Analysis`, `Abrivation`, `Sheet1..3`); the machine code is the trimmed sheet
name after R3. Cost if wrong: a sheet whose header sits below row 10 or is worded differently silently contributes
nothing — the converter's report prints every sheet it read with its row count, so the gap is visible.

**R3 — machine codes are the sheet names, folded by one spelling table, and validated against the plant's active
machines.** Fold: leading zeros (`GRD-01`→`GRD-1`, `VTL-01`→`VTL-1`), `VL-4`→`VTL-4`, `CAM`→`CAM-01`,
`TMC-4_CY52`→`TMC-4`, `TMC-5_H-TURN`→`TMC-5`. Validation uses the same list the importer resolves
(`plant.machinesForEngine`, status `active`); an unknown code is **excluded and counted per code**, never remapped
by guess. `Star`/`Star-01`/`Star-02` are not mapped to `S-1`/`S-2`: that is a plant question, not a spelling.
Cost if wrong: the 159 rows above stay out until the retired machines exist (as active rows the importer can
resolve) or Nimish confirms the Star mapping; a re-run then loads them and adds nothing twice.

**R4 — the columns mapped, by flattened header text.** `DATE` (located as the `SR.NO` column + 1, because several
2022 sheets have a stray date instead of the word `DATE` in that header cell), `SHIFT`, `PROBLEM DESCRIPTION`,
`OBSERVED BY`, `CORRECTIVE ACTION`, `DONE BY`, `TOTAL DOWN TIME (In Min.)`, `MAINT CODE`, `ELECT/MECH`, PM hours,
UTI hours. **Not the source of anything:** the `Month` column (it holds dates and wrong months — `2025-01-22` is
labelled `Jun`), the `TOTAL DOWN TIME (In Hr.)` column (derived), the 2022-only `Time consumed (In Min.)` (a
different measure, blank in most rows), and the spare/RCA/report-time columns the synthetic contract has no field
for. Cost if wrong: using `Month` misplaces rows; using `Time consumed` or the hours column changes figures.

**R5 — dates are parsed three ways and classified once.** Excel stores dates as serial numbers and the repo reader
returns numbers (it ignores styles), so `44562` must become `2022-01-01` (epoch 1899-12-30); text is accepted as
`DD.MM.YYYY` / `DD-MM-YYYY` / `DD/MM/YYYY`; a blank DATE is a template row (1,851). An unreadable cell is `bad_date`
(2). Cost if wrong: serial numbers read as 1970 break the year check and every placement.

**R6 — PM, UTI and blank minutes are loaded, not skipped.** PM rows (maint code `PM`, or a numeric PM-hours cell)
load as past-breakdown tickets with `maintCode: 'PM'`, exactly as 37c loaded the 2026 log's 64 PM rows; UTI/accident
rows (`UTI`, `UTY`, `ACCIDENT` columns) load with their code. A blank `TOTAL DOWN TIME (In Min.)` is **0**, not a
skip: 378 of the 2024 rows, 14 of the 2025 rows and 17 of the 2022 rows record a utility event with hours only in the UTI/PM column, and
the plant's own summary counts them as zero-downtime events. A blank problem loads with the 37c fallback text
(`Breakdown recorded without a problem description`), 84 rows. Cost if wrong: excluding PM removes 400 rows from
the Breakdown Log (and the plant's PM hours with them); treating blank minutes as skips loses 409 recorded events (and 84 blank problem texts).

**R7 — the summary sheets count a breakdown only when it has downtime.** Verified on seven machine-months across
three families: the MTTR/MTBF summary's “Total No Break-Downs” is the count of non-PM rows with **minutes > 0**, and
“Total Down Time” is their minutes. This is the rule the verification in 69b uses; it is not the load filter (R6).
Cost if wrong: the reconciliation check would demand a different count and report false mismatches.

### Identity — no real name ever leaves memory

**R8 — every person is a token before the export exists.** The converter runs server-side, reads the tenant's
active people (`identity.activePeople`, case/space/punctuation-normalised name), and replaces each name with: the
person's `personCode` (`P-` + the first 8 hex of the person id, `identity.personCode`) when the name matches one
active person exactly, else a stable `LG-` + 8 hex of `sha256(normalised name)` so the same unknown person carries
the same code in 2022, 2024 and 2025. The 37 distinct DONE BY tokens are 14 role/team spellings (`operator`,
`maint. team`, `maint.team`, `main team`, …) and 23 individual names, eight of them variant spellings of a name
(dropped, transposed or repeated letters, a nickname); a role is dropped (as the importer's own `personName` does), a team spelling folds to `Maint. Team`,
and a typo mints its own code rather than a guess — the report lists it as a `possible_duplicate_person`. Raw names
exist only in the converter's memory. Cost if wrong: an unmatched name becomes a placeholder person and can be
renamed or merged later; a typo mints a second placeholder (23 people instead of 16); nothing leaks.

**R9 — the importer learns one thing: an alias target may be a person code.** `imports/references.ts`
`loadPeople` resolves a target matching `^P-[0-9a-f]{8}$` against the active people's `personCode`, and keeps its
existing “Unknown or inactive person alias” error when no one matches. Without this, a matched person would become
a placeholder named `P-…`. Cost if wrong: about ten lines and one test; matched history loses its person link.

**R10 — the redaction proof is the converter's, and `pii:scan` cannot be it.** The converter replaces every name
occurrence in `problem` and `corrective action` with `[person]` (longest name first, word boundaries, the same
`[person]` convention D21 fixes) and every phone-shaped run with `[phone]`, then refuses to write when the canonical
JSON still contains any workbook name token or any of the tenant's `identity.redactionTerms`. The proof is a unit
test on a synthetic grid whose names are sentinels. **The `pii:scan` consequence, recorded:** its deny list is built
at run time from the 2026 discovery pack (`tools/pii-sources.ts`), so it cannot see a 2020–2025 name and will stay
green whether or not the legacy export is clean; the legacy workbooks stay out of git (`.agents/data/` ignored), and
the import stores codes only, so `import_row.payload` carries no name. Cost if wrong: a name in a workbook column we
never parse (e.g. `SPARES REPLACED`) could reach a file through a future change — the converter's check only covers
the columns it reads, and this limit is stated rather than hidden.

### References, placement, figures

**R11 — refs sit below the live counter, in a distinct band per year.** `BD-<d><nnnn>` with `d` the year's last
digit and `nnnn` a 4-digit serial in (sheet order, then Excel row): 2022 `BD-20001…BD-20974`, 2024
`BD-40001…BD-42296`, 2025 `BD-50001…BD-51296`. Five digits, disjoint from the live `BD-0001…BD-0151` and the 2026
`BD-90001…BD-91357`; every band is below the counter's current `BD-91287`, and `raiseRefCounter` is `GREATEST`, so
**the live counter does not move** (unlike 37c's jump to `BD-91287`). Cost if wrong: a mis-set band either collides
with a live ref (import refuses by ref) or jumps the live counter by ~150k; the first is loud, the second is the
37c consequence again.

**R12 — `legacyId` is `lg-<year>-<family>-<machine>-<excelRow>`** (e.g. `lg-2022-vmc-vc-13-37`); it is the
converter's stable identity, the export's `legacyId` and the import's `source_ref`. Serial and `legacyId` are
assigned over a whole year before any file split, so splitting 2024 in two does not renumber. Cost if wrong: a
duplicate `legacyId` makes the importer report `in_file_identity_conflict` and load nothing; a changed id makes a
re-run `changed_payload` instead of a skip.

**R13 — ticket placement is 37c's, unchanged.** `close = the row's date at the shift's start + 120 min` in the
plant zone (`+05:30`), `reportedAt = close − downMin`, `state.closedAt = close`, `closeKind: 'report'`,
`report.date = the row's date`, `report.shiftCode = the mapped shift`, `submittedAt = close`; events `down` then
`close` with payload `{kind:'report'}`; `storedFigures` = the figures `computeTicketFigures` would produce
(`downtimeMin = downMin`, `responseMin 0`, `repairMin = downMin`), so reconcile raises no override. Long downtimes
start outside a window and end inside it — the only placement `validateLocal` accepts. Cost if wrong: the import
rejects every row (`report_date_mismatch` / out-of-window) or the figures drift.

**R14 — the maintenance code is mapped by one synthetic table, labelled as such.** Codes already in the plant's 19
stay verbatim (`E`, `M`, `ATC`, `SP`, `RT`, `PM`, `AX`, `LB`, `CON`, `MIS`, …); `UTI`/`UTY` → **`NO DT`** (the plant's
own no-downtime code — the only mapping that is exact rather than invented); the slash composites (`E/M`, `M/E`,
`M/M`, `M/S`, `P/M`) and the legacy-only codes (`NI` 210, `FS` 63, `PP` 8, `MS` 86, `TR` 112, `T` 23, `TL`, `CP`,
`FNC`, `MIX`, `PAR`, `NIS`, `MPG`, `S`) → **`MIS`**; a blank stays `null`. This is the same synthetic-map stance
37c took for N12/Q9, and the report prints the count per source code. Cost if wrong: the code grouping on A2/A3
changes for the 1,859 history rows whose code is not in the plant's list; correcting it needs an `import:undo` of the affected batch and a reload,
because a re-import of changed rows is refused by design (`changed_payload`).

**R15 — `breakdownCategory` is `E` or `M` when the `ELECT/MECH` cell is one of those (case-insensitive), else
`null`** — the composites (`E/M`, `M/E`, `PM`, `ATC`, …) are not guessed. 3,757 rows carry a single letter.
Cost if wrong: one column on A4/A5 for the legacy rows.

### The load

**R16 — four files, because the contract caps a file at 2,000 tickets.** `IMPORT_LIMITS.tickets = 2_000`
(`modules/imports/schema.ts:348`), and 2024 is 2,296 rows. The converter writes `legacy-2022.json` (974),
`legacy-2024-vmc.json` (1,187), `legacy-2024-other.json` (1,109: TC & TMC 803 + VTL 207 + HMC 59 + GRD 40) and
`legacy-2025.json` (1,296); refs and `legacyId`s are the year's, so a re-split never renumbers. One year as one
file would be refused at parse time. Cost if wrong: four batches and four undos instead of one; the arithmetic is
printed by the converter so a wrong split is caught before the load.

**R17 — the loading mechanism is the existing synthetic path, unchanged.** `pnpm import:bhavin <file> --tenant
<slug>`, which parses `argus.synthetic-bhavin/v1`, loads through the past-breakdown path, records one `import_batch`
and one `import_row` per ticket with `source_ref = legacyId`, and raises the ref counter with `GREATEST`. The
converter is a separate, **read-only** CLI (`pnpm import:legacy`) that opens the tenant with `withTenant`, reads
people and machines, and writes JSON; it never writes to the database. Cost if wrong: a second loader would need a
second undo path and a second contract (D21 rejected exactly that).

**R18 — idempotency is the importer's, and it is exact for the same file.** A second run of the same JSON is
`imported 0, skipped N` with unchanged ticket and report counts, because identity is `legacyId` + the hash of the
row and its alias config (`imports/identity.ts` `existingIdentity`). The alias config is part of that hash, so a
**regenerated** file after a people change is refused as `changed_payload` rather than silently re-created; the
emitted file is the batch's evidence and is reused for a re-run. Cost if wrong: an operator who regenerates after
adding a person sees a loud failure and must undo the batch — no duplicate tickets, no data loss.

**R19 — tenant, backup, rollback, and where this ticket stops.** One tenant: the slug passed to both commands
(staging: the Cosmos tenant). No schema change and no irreversible step in this ticket. Before any production load:
a full database dump (`tools/backup-dump`) recorded in the deploy log; rollback is `pnpm import:undo <batchId>` per
batch (tickets, reports, events, import rows and provenance go together) or the dump. Staging is loaded and checked
first; production is a separate operator step under the existing `--production-confirm` guard and Nimish's go.
Cost if wrong: an undo removes exactly the batch's rows; the dump covers anything else.

## Verification (69b's acceptance)

1. **Counts.** Each batch reports `imported` equal to the table above and `status: 'done'`; the four files sum to
   4,566 closed `backfill` tickets, 2022 974, 2024 2,296 (split 1,187 + 1,109), 2025 1,296; every ticket has one
   report and one `import_row.source_ref`.
2. **The summary sheets, recomputed from the loaded rows.** For each machine-month on a monthly summary sheet,
   count non-PM tickets with `downMin > 0` and sum their minutes, then compare with the sheet's own
   “Total No Break-Downs”, “Total Down Time”, “MTTR”, “MTBF” and “Machine Availability” (available time is the
   sheet's own 500 h/month). Seven machine-months agree exactly and are asserted: HMC-2 Jan 2025 (2 / 0.58 h),
   HMC-2 Feb 2025 (1 / 0.5 h), VTL-1 Jan 2025 (3 / 2.67 h → MTTR 0.89 h, MTBF 166.67 h, availability 0.99466),
   VTL-3 Jan 2025 (2 / 5.5 h), VTL-4 Feb 2025 (1 / 7 h), VTL-5 Feb 2025 (1 / 2.5 h), GRD-05 Feb 2025 (2 / 3.67 h).
   Every machine-month that disagrees is printed with both numbers (HMC-2 Jan 2022 is one: the sheet says 4
   breakdowns and 12.6 h, the detail holds 3 rows and 755 min = 12.58 h — the workbook's own gap, not ours).
3. **The desk and the machine page.** `GET /api/v1/tickets?from=<legacy day>&to=<legacy day>` returns the imported
   tickets closed, channel `backfill`; the machine page's history drill for a 2022 machine returns its rows; the
   Breakdown Log window for 2022 lists them.
4. **Analytics.** The answer-key tests are untouched: the 2026 keys are computed from
   `fixtures/answer-key/input.json`, not from the database, so every existing whole-key assertion stays green. On
   staging, the plant's own figures gain the older years: after the load and the next `POST /api/v1/analytics/run`
   (or the nightly run), any window that spans 2022/2024/2025 includes them — the Dashboard's recent window does
   not, the Breakdown Log and register drills do, and the 2026 log's own figures do not change because its tickets and
   refs are untouched. `kpi_snapshot` is not rewritten by the load; the run is a deliberate step.
5. **Redaction.** On the generated files: no workbook name token, no tenant redaction term, no phone shape. In the
   database: no ticket, report or `import_row.payload` free text contains a sentinel name from the test fixture.
6. **Tests.** Converter unit tests on synthetic sheet grids (no xlsx) with sentinel names; one real-sheet smoke
   behind `LEGACY_DATA_DIR` that CI skips; the load test against the seeded Postgres harness; the imports and
   erasure suites stay green.

## Packet 69a — the converter (one PR, one writer; two ordered commits)

**Files.** `apps/server/src/seed/legacy-sheets.ts` (grid → `LegacyRow[]`: header detection, column map, serial and
text dates, shift map, machine fold, class per row; ~220 lines), `apps/server/src/seed/legacy-export.ts` (rows +
people + machines → `{ export, report }`: refs, `legacyId`, ticket/report/figures, maint-code map, tokenisation,
free-text redaction, deterministic order, the per-class/report counts; ~280 lines),
`apps/server/src/seed/legacy-sheets.test.ts`, `apps/server/src/seed/legacy-export.test.ts`,
`apps/server/src/modules/imports/references.ts` (R9, ~10 lines) + one case in `apps/server/test/import-identity.test.ts`,
`tools/import-legacy.ts` (CLI: `--tenant`, `--data`, `--out`, `--year`; reads with `tools/answer-key/xlsx.ts`,
refuses an `--out` inside the repo, prints the report; ~150 lines), `tools/import-legacy.test.ts` (the env-gated real
smoke), `package.json` (`import:legacy`), `.gitignore` (`.agents/data/`), `changes/69-legacy-history.md`.

**Acceptance (Given/When/Then).**

- Given the 14 workbooks, when the converter runs, then it writes exactly four files of 974 / 1,187 / 1,109 / 1,296
  tickets, each ≤ 2,000 and each parsing against `parseSyntheticExport`.
- Given a workbook name, when the export is written, then no name from the DONE BY / OBSERVED BY / problem /
  corrective-action columns appears in it (sentinels in the test; the real smoke checks the file in memory).
- Given the same workbooks twice, when the converter runs twice, then the canonical JSON is byte-identical.
- Given a machine the plant does not hold, when its sheet is read, then its rows are counted under its code and
  absent from the export.
- Given the 2024 year, when the split is written, then the two files' refs are drawn from the same `BD-4` series
  with no gap and no duplicate.
- Given a workbook with `SR.\nNO.` / `TOTAL \nDOWN TIME\n` headers and a stray date in the DATE header cell, when
  it is read, then its rows are read (the 2025 VTL-04/VC-15 case).

**Red / green.** Red: `pnpm exec vitest run apps/server/src/seed/legacy-sheets.test.ts
apps/server/src/seed/legacy-export.test.ts` (modules absent). Green: the same plus
`pnpm run typecheck && pnpm run lint`, and the real smoke
`LEGACY_DATA_DIR="/Users/nimishshah/All AI/argus/.agents/data/legacy" pnpm exec vitest run tools/import-legacy.test.ts`.
**Budget note:** the converter is one coherent contract (sheet reading + export shape + identity); it exceeds the
150-line packet rule like 37c's generator, filed under D31's work-unit rationale and recorded in the PR.

## Packet 69b — the load and the verification (one PR, one writer)

**Kind:** verification plus the load proof. After 69a the path exists, so the red is a deliberate mutation — wiring
`source_ref` to the ticket ref instead of the `legacyId`, or resolving every alias to a placeholder instead of the
`personCode` — that turns the new load test red; the mutation is the packet's red evidence, restored before commit.

**Files.** `apps/server/test/legacy-load.test.ts` (new): seeds the Cosmos harness, adds the fixture's legacy people,
builds a small legacy grid through the converter (2 machines, ~10 rows covering PM, UTI, blank minutes, blank
problem, a bad shift, an unknown machine, a bad date, a sentinel name), imports it, and asserts the counts, the
`source_ref` set, the one report per ticket, the desk day, the machine drill, the person link and the no-name rule;
re-imports the same file and asserts `imported 0, skipped N` with unchanged counts. `changes/69-legacy-history.md`
(the same fragment, appended). The real smoke's count assertions live in 69a's tool test; 69b adds the seven
summary-machine-month reconciliations to it (the numbers above are already measured).

**Acceptance (Given/When/Then).**

- Given the four generated files, when each is imported once into the Cosmos tenant, then the counts are
  974 / 1,187 / 1,109 / 1,296, `status: 'done'`, and every ticket is a closed `pastBreakdown` with `backfill` and
  one `import_row.source_ref = legacyId`.
- Given a loaded file, when it is imported again, then nothing is added and the ticket, report and import-row
  counts do not change.
- Given a 2022 day, when the desk asks `from`/`to`, then the imported tickets are listed; given a 2022 machine,
  when the machine history is read, then its rows are there.
- Given a sentinel name in the fixture, when the load commits, then no ticket, report or import-row text contains
  it, and the person's history link resolves to the seeded person (a `personCode` alias).
- Given the seven machine-months, when their MTTR/MTBF is recomputed from the loaded rows, then it equals the
  summary's cell (VTL-1 Jan 2025: 0.89 / 166.67 / 0.99466).
- Given the 2026 answer-key tests, when they run after this packet, then they are unchanged and green.

**Red / green.** Red: the mutation above fails `legacy-load.test.ts` on the `source_ref`/person assertion. Green:
`pnpm exec vitest run apps/server/test/legacy-load.test.ts apps/server/test/import-*.test.ts` plus the covering
suite (`pnpm exec vitest run apps/server/test`), `pnpm precheck`, and the env-gated real smoke.

## Rails

Red first, or the named mutation for 69b; never delete, skip or weaken a test; one writer per packet; files ≤ 400
lines (the size guard counts the trailing newline, so ≤ 399 `wc -l`); functions ≤ 60 lines; **no new dependency**
(the xlsx reader and the schemas already exist); no customer data in git, tests, fixtures or logs — the only fixture
is a small synthetic grid with sentinel names, and the real workbooks stay under the ignored `.agents/data/`; the
converter refuses an output path inside the repo. R2 (server data) → a fresh reviewer runs the covering suite. Commit
locally, no push; report red, green, deviations, and the two recorded source-quality findings (the summary sheets'
gaps, the workbook dimension lie).

**Dependencies and edges.** 69a blocks 69b; neither blocks another ticket. No schema ticket, no milestone gate.
`docs/plan/MILESTONES.md` is not edited by this plan.

## What Nimish must still provide

1. **2020, 2021 and 2023 workbooks, if they exist** — none is in this workspace, and the only 2020/2021/2023 dates
   are 6 stray rows inside the 2022/2025 workbooks (excluded by R1).
2. **The `Star`/`Star-01`/`Star-02` mapping** — are they `S-1`/`S-2`, or machines the plant no longer holds?
3. **The retired machines `TC-2`, `VC-2`, `VC-3`, `VC-5`** — add them to the plant (as rows the importer can
   resolve) so their 103 rows load, or confirm they stay out.
4. Nothing else: the identity match, the four files, the bands and the code map are settled by this plan.
