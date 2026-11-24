# M4b-69 — legacy history 2022–2025

## Amendment, 24 Nov 2026 — all 20 workbooks in hand; three converter gaps (M3 G3.1, history lane)

This slice stays the history plan (ADR 0027 §1; draft #300 closes unmerged). It now runs as **M3 G3.1** in the
**history lane**, beside the screens lane (ADR 0026 §3), not after M4a. Everything below the line is unchanged
except where this amendment names a ruling.

- **Where the files are.** Nimish supplied every register: `/Users/nimishshah/argus-data/history/{2022,2023,2024,2025}/*.xlsx`
  on the operator's Mac (20 workbooks, 342 sheets). Pass that folder as `--data`; `findWorkbooks` walks the year
  folders. Never copied into git, a test, a log or a PR; fixtures stay invented.
- **Counts agree.** Nimish's read (24 Nov; rows with a problem or minutes, machine sheets only): 2022 1,092 ·
  2023 3,075 on 67 sheets · 2024 2,319 · 2025 1,324. The table below counts rows with a date (1,098 · 3,078 · 2,327
  · 1,329); the two bases differ by under 0.4 % a year. 2023 was never out of scope here (only #300 called it
  absent): 1,823 of its rows are utility (`UTI`), so real breakdowns are about 1,250. Rows by month 2023: 156 93 143
  101 134 253 262 499 422 446 288 197.
- **`Jul-23.xlsx` is not a register.** `UNIT-1..3` are a machine × day grid of July 2023 breakdown time, plus
  `Total MB`. `findWorkbooks` already skips it (no four-digit year in its name). It becomes a **cross-check** for
  July 2023 only, never a source: **#625** (`import:legacy --grid`).
- **Late-2022 rows in 2023 workbooks** (75, none repeating a 2022-workbook row) load under their own date: R1′ as
  written.
- **R1″ (new, amends R1′) — a row dated after its workbook's year is held, never loaded.** 3 rows in VTL-2023 read
  2024-11-03; 2 in VMC-2025 read 2026 (already `stray_year`; must never reach the 2026 answer-key era). A row
  already in the later year's workbook stays `duplicate`. Cost if wrong: a few real rows wait for Bhavin.
- **The review tray (new).** Every held row a person must look at is listed in `review-<year>.csv` beside the
  export files: year, machine, Excel row, reason — no cell content. Rows with a problem or minutes but a blank date
  (4 in 2024, today dropped as template rows) join it as `bad_date`. **#623** (seeded on `plan/t623`).
- **R13′ (amends R13) — two shifts (ADR 0026).** `1`/`1ST`/`1STG`/`1TS` → A (`1`); `2`/`2ND`/`2D` → B (`2`);
  everything else (`3RD`, `3ND`, `4TH`…, `1 & 2`, blank) is held to the tray with its verbatim value, never folded
  into A or B. **#624**.
- **Text dates** (`dd.mm.yyyy`: 236 in 2022, 3 in 2023, 36 in 2024, 4 in 2025) are R5 as built.
- **Order.** Load 2022 → 2023 → 2024 → 2025 (`tools/load-legacy.ts` already loads years ascending). Build: **623 →
  624 → 625** (all three share `tools/import-legacy.ts`, one at a time) beside ADR 0027's **621 → server setting +
  `load-legacy --data-from` → 69d**. Nothing loads on staging until 621 and the setting are merged and Nimish
  has uploaded the files (69d).

**#300's traps, mapped to what is built** (each has an invented fixture and a test today):

| Trap                        | Rule here                       | Test                                                                           |
| --------------------------- | ------------------------------- | ------------------------------------------------------------------------------ |
| T1 power cut on every sheet | R6′, R20: one plant event a day | `legacy-export.test.ts` "turns the utility rows…", `legacy-merge.test.ts`      |
| T2 repair over days         | not merged — see below          | —                                                                              |
| T3 codes changed            | R14′, S5                        | `legacy-export.test.ts` "keeps codes as written except the folded MEC and ELE" |
| T4 dates and shifts         | R5, R1′/R1″, R13′               | `legacy-sheets.test.ts` dates; #623, #624                                      |
| T5 overlapping columns      | R4, `utiOnBreakdown`            | `legacy-classify.test.ts` counts; `legacy-check.test.ts`                       |
| T6 people                   | R8–R10, pseudonyms              | `legacy-export.test.ts` "puts no name…", `legacy-people.test.ts`               |
| T7 junk                     | R2, repeats                     | `legacy-sheets.test.ts` "ignores 50,000 empty styled rows"                     |
| T8 no entries ≠ reliable    | S4 gap months                   | `legacy-load.test.ts` "prints the gap months as no records"                    |

T2 stays one ticket per daily row on purpose: Bhavin's summary sheets, G3.1's yardstick, count each row (R7), so
merging runs would put every multi-day machine-month off the check. Revisit only if Bhavin says a run is one
breakdown.

## Re-plan, 19 Nov 2026 (replaces the plan of #406 and its amendment)

The goals are ticket 69's six in `docs/plan/MILESTONES.md`. Nimish's rulings of 19 Nov are fixed here and not
reopened: **one plant event per utility failure** (not a ticket per machine), **a row loads under its own date
unless that year's workbook already holds it**, **codes are kept as the workbook legends define them** (amended 19 Nov by Bhavin's answer: `MEC` is now `M` and `ELE` is now `E`; every other code stays as written), and
**February and March 2022 show as a gap ("no records") until Bhavin answers N17**. Every open answer from Bhavin is
a switch with a stated default (§Switches), so no packet waits on him. Product goal (Nimish, 19 Nov): the whole
history loaded before the pilot, so tickets 90–96 are built and checked on real data.

The workbooks stay outside git: the converter takes their folder at run time and refuses an output path inside the
repo. Locally they sit in this container's scratchpad (`bd22/`, `bd23/`, `bd24/`, `bd25/`); on staging they come
from the private backup bucket (69d). No row, name or file name with a name goes into the repo, a test, a log or a PR.

### What the 19 workbooks hold (measured 19 Nov, counts only)

A throwaway reader (Python `openpyxl`, read-only) on all four years; the converter's own counts are the truth and
its real-file smoke asserts the `rows with a date` line against this table (a second, independent reader).

| Fact (machine sheets only)                                                                                                                                                                      | 2022     | 2023      | 2024       | 2025      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------- | ---------- | --------- |
| workbooks / machine sheets                                                                                                                                                                      | 4/50     | 5/68      | 5/73       | 5/86      |
| rows with a date                                                                                                                                                                                | 1,098    | 3,078     | 2,327      | 1,329     |
| of those, dated in the workbook's own year                                                                                                                                                      | 1,091    | 2,994     | 2,322      | 1,322     |
| dated in another workbook year (2022–2025)                                                                                                                                                      | 2        | 83        | 5          | 5         |
| of those, already in that year's workbook                                                                                                                                                       | 0        | 5         | 5          | 5         |
| dated in a year with no workbook (2002, 2020–21, 2026)                                                                                                                                          | 5        | 1         | 0          | 2         |
| utility rows (code `UTI`/`UTY`)                                                                                                                                                                 | 85       | 1,821     | 980        | 130       |
| utility rows not coded `UTI`/`UTY` that carry hours only in the UTI column (the converter's own count of every utility row with hours and no minutes, coded or not, is 0 / 1,779 / 1,246 / 136) | 0        | 93        | 277        | 19        |
| days with a utility row (event-days)                                                                                                                                                            | 38       | 183       | 139        | 40        |
| most utility rows on one day                                                                                                                                                                    | 13       | 51        | 48         | 19        |
| utility machine-hours (UTI column; 2022 has none)                                                                                                                                               | 41¹      | 1,573     | 746        | 110       |
| breakdowns with downtime (not PM, not utility)                                                                                                                                                  | 941      | 942       | 861        | 996       |
| their downtime hours                                                                                                                                                                            | 2,443    | 1,743     | 1,516      | 2,011     |
| PM rows / blank code / blank minutes                                                                                                                                                            | 53/35/19 | 65/345/38 | 27/452/379 | 156/27/15 |
| exact repeat rows inside one year (same sheet, day, shift, minutes, text)                                                                                                                       | 5        | 10        | 15         | 7         |

¹ 2022 has no UTI column; its 85 utility rows carry minutes in the downtime column (41 h).

- **Shift spellings:** 2022 `1ST`, `2ND`, `3RD`, `3ND`, `2D`, `1STG`, `A`, blank; 2023 `1ST`, `2ND`, `3RD`; 2024
  `1ST`, `2ND`, `1`, `2`, `1TS`, `3RD`, `4TH`–`8TH`; 2025 `1`, `2`, `1ST`, `2ND`, `3`, `3RD`, `1 & 2`, `4`–`7`.
- **2022's hole:** dated rows by month run 151, 14, 8, 88 for January to April (all kinds; breakdowns 139, 8, 0, 76).
- **Codes outside the plant's 19, by legend** (N12): `TR`, `T`, `FS`, `MS`, `NI`, `PP`, `CP`, `PAR`, `PC`, `HM`,
  `UTI`/`UTY`, plus slash composites (`E/M`, `M/E`, `M/M`, `M/S`, `P/M`) and singletons (`MPG`, `MAG`, `TL`, `FNC`,
  `MIX`, `NIS`, `S`, `A`, `B`).
- **Huge styled sheets:** 1,049,113 row elements in the 2022 set, 2,094,792 in 2023 and 4,178,046 in 2024, almost
  all empty styled cells; one 2023 sheet is 134 MB of XML. `VTL-2024.xlsx` is 38 MB zipped.
- **Every year fits one import file.** With utility rows folded into events, each year is about 1,050–1,200
  tickets plus 38–183 events, under the importer's 2,000-ticket file cap (`IMPORT_LIMITS.tickets`). So: **one file,
  one import batch and one undo per workbook year**; #406's four-file split (old R16) is gone.

## Rulings (frozen; each with its cost if wrong)

Kept from #406: R2, R3, R4, R5, R7–R13, R15, R17–R19, some amended (marked). Superseded: R1 by R1′, R6 by R6′,
R14 by R14′, R16 by R16′.

**R1′ — a row's date decides its year; the workbook decides only its batch.** A row dated in another workbook year
(2022–2025) loads under its own date unless that year's workbook holds the same row (same folded machine, date,
shift, minutes and flattened problem text): then it is `duplicate` and not loaded. A row dated in a year with no
workbook (2002, 2020, 2021; and 2026, whose history is 37c's log) is `stray_year`, not loaded, and listed for
Bhavin. The ticket rides in its workbook's file and batch, so a year's batch never depends on another year's file.
Cost if wrong: about 75 late-2022 rows sit in the 2023 batch; undoing 2023 removes them too (stated in the report).

**R2 — machine sheets are found by their header, not their name.** Rows 1–10 hold a header with `SR.NO` and
`PROBLEM` after flattening every non-alphanumeric character (`SR.\nNO.`, `TOTAL \nDOWN TIME\n`); summary sheets are
excluded by name (`MTTR`, `MTBF`, `Analysis`, `Abrivation`, `Sheet1..3`). The report prints every sheet read with
its row count. Cost if wrong: a sheet with a lower header contributes nothing, visibly.

**R3 — machine codes are sheet names, folded by one spelling table, validated against the plant.** Fold: leading
zeros (`GRD-01`→`GRD-1`), `VL-4`→`VTL-4`, `CAM`→`CAM-01`, `TMC-4_CY52`→`TMC-4`, `TMC-5_H-TURN`→`TMC-5`. An unknown
code is excluded and counted per code, never remapped by guess (switches S1 and S2: the numbered Star sheets map to `S-1`/`S-2`, a bare `Star` sheet and the
retired machines are excluded). Cost if wrong: excluded rows load on a later run, with nothing added twice (R18).

**R4 — columns by flattened header text.** `DATE` is the `SR.NO` column + 1 (some 2022 headers hold a stray date);
`SHIFT`, `PROBLEM DESCRIPTION`, `OBSERVED BY`, `CORRECTIVE ACTION`, `DONE BY`, `TOTAL DOWN TIME (In Min.)`, `MAINT
CODE`, `ELECT/MECH`, PM hours, `UTI` hours. Never a source: `Month`, `TOTAL DOWN TIME (In Hr.)`, 2022's `Time
consumed`, and the spare/RCA/report-time columns (filled on at most 3 dated rows a year). Cost if wrong: misplaced
rows or changed figures.

**R5 — dates three ways.** An Excel serial (`44562` → `2022-01-01`, epoch 1899-12-30; the repo reader returns
numbers), text `DD.MM.YYYY` / `DD-MM-YYYY` / `DD/MM/YYYY`, or blank (a template row, not counted as read). Anything
else is `bad_date` and counted. Cost if wrong: serials read as 1970 break every placement.

**R6′ — what a row becomes.** A **utility row** is one whose code (or `ELECT/MECH`) is `UTI`/`UTY`, or whose UTI
column holds hours while its downtime minutes are blank or 0. Utility rows of one plant date become **one plant
event** (R20) and add 0 to every breakdown figure. A row with breakdown minutes and also UTI hours is a breakdown,
counted as `uti_hours_on_breakdown`. **PM rows are code `PM` only** (a PM-hours cell does not make a PM row; the row keeps its own code) and load as past
breakdowns with `maintCode: 'PM'`, as 37c did. A blank minute cell is 0; a blank problem gets 37c's fallback text. Exact repeat rows
inside a year load (they are separate workbook rows) and are listed as `possible_repeat`. Cost if wrong: a
utility-hours row with a blank code counted as an event instead of a breakdown moves at most 277 rows (2024).

**R7 — the summary sheets count a breakdown only when it has downtime** (non-PM rows with minutes > 0; "Total Down
Time" is their minutes; 500 h a month available). This is 69c's reconciliation rule, not a load filter.

**R8 — every person is a code before the export exists.** The converter reads the tenant's active people
(`identity.activePeople`) and replaces a name with that person's `personCode` on an exact normalised match, else a
stable `LG-` + 8 hex of `sha256(normalised name)` (the same in every year); role spellings drop, team spellings fold
to `Maint. Team`, a typo mints its own code and is listed as `possible_duplicate_person`. Cost if wrong: a
placeholder person to merge later. The code is a reversible pseudonym (see Pseudonyms, 69b).

**R9 — an alias target may be a person code** (`^P-[0-9a-f]{8}$` resolves against `personCode` in
`imports/references.ts`). Cost if wrong: matched history loses its person link.

**Pseudonyms (69b).** A person field in an output file is an unsalted hash pseudonym (`LG-` + 8 hex of
`sha256(normalised name)`), so it can be reversed by guessing names. The converter's output files, like the workbooks
and any free text taken from them, stay outside git and in the private store (D21), as the 37c precedent.

**R10 — the redaction proof is the converter's.** Names in problem and corrective-action text become `[person]`,
phone-shaped runs `[phone]`; the converter refuses to write when the canonical JSON still holds a workbook name
token or a tenant `identity.redactionTerms` entry. `pii:scan` cannot see a pre-2026 name, so it is not the proof.
Cost if wrong: a name in a column never parsed could reach a file through a later change (limit stated).

**R11 (amended) — refs in a band per workbook year, serials over every dated row.** `BD-<d><nnnn>` with `d` the
workbook year's last digit (2022 `BD-2…`, 2023 `BD-3…`, 2024 `BD-4…`, 2025 `BD-5…`) and `nnnn` the row's serial in
(sheet order, Excel row) over **all** dated rows, excluded ones included, so flipping a switch never renumbers a
loaded row. All bands sit below the BD counter that 37c raised to `BD-91287`, so the BD counter does not move.
Plant events take `WR-<d>0001…` in event-date order; **the live WR counter rises to about `WR-50040`** (the
importer raises counters with `GREATEST`), the same consequence 37c accepted for BD. Cost if wrong: new work
requests number from about 50040 instead of continuing low; nothing breaks.

**R12 — `legacyId`** is `lg-<year>-<family>-<machine>-<excelRow>` for a ticket and `lg-<year>-uti-<date>` for a
plant event; it is the import's `source_ref`. Cost if wrong: an identity clash loads nothing, loudly.

**R13 — placement is 37c's.** Close = the row's date at its shift's start + 120 min (plant zone), `reportedAt =
close − downMin`, closed by report, figures as `computeTicketFigures` would store them. Shifts: `1`, `1ST`, `1STG`,
`1TS` → 1; `2`, `2ND`, `2D` → 2; `3`, `3RD`, `3ND` → 2 (37c's fold); anything else (blank, `A`, `4`–`8`, `4TH`–`8TH`,
`1 & 2`) → 1 and counted as `stray_shift`. Cost if wrong: only per-shift splits move.

**R14′ — codes are kept as the legends define them.** Every code loads as written (blank stays `null`) except the two Bhavin answered on 19 Nov, `MEC` → `M` and `ELE` → `E` (S5 default); codes outside
the plant's active 19 resolve against **switched-off** `maint_code` entries (ticket 47's rule: off for new tickets,
still shown on old reports). 69c's runner adds a missing legend code as a switched-off entry (audited, idempotent)
before a load. Nothing is folded into `MIS`. Cost if wrong: a later fold (switch S5) is one undo and one reload of
the affected years.

**R15 — `breakdownCategory`** is `E` or `M` when `ELECT/MECH` is exactly one of those, else `null`.

**R16′ — one file per workbook year**, each ≤ 2,000 tickets (asserted by the converter before writing).

**R17 (amended) — the converter is read-only and the load is the existing synthetic path.** `pnpm import:legacy`
reads people, machines and codes and writes JSON; `pnpm import:bhavin <file> --tenant <slug>` loads it (one
`import_batch`, one `import_row` per ticket or event). No second loader and no second undo (D21).

**R18 — idempotency is the importer's.** The same file again is `imported 0, skipped N`; a changed row is refused
as `changed_payload`. A switch that adds rows produces a file whose old rows are byte-identical (R11), so the
re-import adds only the new rows, in a new batch.

**R19 — tenant, backup, rollback.** One tenant per run; a full dump (`tools/backup-dump`) before any staging or
production load; rollback is `pnpm import:undo <batchId>` per year (tickets, reports, events, import rows together)
or the dump. Production is a separate step under `--production-confirm` and Nimish's go.

**R20 — the plant event's home: a closed general ticket with one history line per machine (no new table).** One
plant event per plant date with a utility row: `kind: 'general'`, no machine, `workType: 'Utility failure'`,
`location: 'Plant'`, channel `backfill`, closed `done`, the most common redacted problem text of its rows; its
reported and closed times span the day's longest line. Each utility row is one `ticket_event` of type
`utility_loss`, payload `{ machineId, minutes, code }` (minutes = UTI hours × 60, else the row's downtime minutes).
Why this fits: D17 names "a `ticket_event` type" as an allowed home; `ticket_event.type` has no CHECK
(`0001_schema_v1.sql`), `ticket.kind` already allows `general` with no machine, and `backfill` is an allowed channel,
so **no migration and no D17 amendment**. A general ticket has no breakdown report and the engine counts breakdowns
from reports (`reportsForEngine`) and kind `stopped`, so the event adds 0 to every breakdown figure. The import
undo already removes a batch's tickets with their history. Ticket 91 sums `utility_loss` minutes by month. Rejected:
a new `plant_event` table (a 41st table, a migration, a second undo path); one ticket per machine (Nimish's ruling);
`setting` rows (not undoable with the batch). Cost if wrong: a later table would be one migration plus a copy of
about 400 events.

## Switches (each open answer from Bhavin; the default loads now)

Every switch is a converter flag printed at the top of its report. Turning one later is a re-run of the converter
and an import of the same year's file: unchanged rows skip, new rows load (R11, R18).

| #   | Question (owner)                                                                                | Default                                                                                                                        | If Bhavin answers otherwise                                                                                            |
| --- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| S1  | N16 (answered 19 Nov): `Star-01`/`Star 1` are `S-1`, `Star-02`/`Star 2` are `S-2`; bare `Star`? | `--star` default maps the numbered ones to `S-1`/`S-2`; a bare `Star` sheet stays excluded, its own line in the report         | `--star off` excludes all; `--star Star=S-1` maps the bare one when Bhavin names it; re-run, re-import                 |
| S2  | N16: keep retired `TC-2`, `VC-2`, `VC-3`, `VC-5`?                                               | `--retired drop`: excluded, counted per code (confirmed 19 Nov)                                                                | `--retired keep`: the admin adds the four as `retired` machines; a past breakdown may name any status (69a); re-import |
| S3  | N16: which machines are "not counted in production data"?                                       | Nothing in the load: all history loads; `TC-5`, `TC-3`, `VC-6` are the machines left out of production data (confirmed 19 Nov) | Ticket 77a's setting, applied at figure time; no reload                                                                |
| S4  | N17: are Feb–Mar 2022 missing records?                                                          | `--gap 2022-02,2022-03`: those rows held out as `gap_month` (22); both months show "no records"                                | `--gap none` if the plant was quiet: the 22 rows load in a new 2022 batch; missing files, if sent, are a new workbook  |
| S5  | N12 (answered 19 Nov): `MEC` is `M`, `ELE` is `E`                                               | `--fold MEC=M,ELE=E`: those two codes folded at load, every other code kept as written (R14')                                  | `--fold none` keeps every code as written; undo and re-import the affected years (`changed_payload` otherwise)         |

## Frozen interface (69a and 69b build against it in parallel)

The export stays `argus.synthetic-bhavin/v1` (additive). A plant event is a ticket with `entryType:
'pastUtility'`, `kind: 'general'`, a `WR-` ref, `status: 'closed'`, `machineCode: null`, `location: 'Plant'`,
`workType: 'Utility failure'`, `reports: []`, `crew: []`, `segments: []`, and events `[raise, utility_loss × n,
close {kind:'done'}]`; `utility_loss` is `{ type, at, by: null, payload: { machineCode, minutes, code } }` with
`minutes` an integer ≥ 0 and `code` nullable. The importer resolves `machineCode` through the export's machine
aliases and stores `machineId`. A past breakdown's `maintCode` may resolve to a switched-off entry; its machine may
have any status; an alias target may be a `P-xxxxxxxx` person code (R9).

## Packets (four PRs)

| Packet | What                                                                          | Lane / blocked by                          | Size (changed lines)               |
| ------ | ----------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------- |
| 69a    | Importer accepts plant events and old codes; harness runs on a local Postgres | backend; none                              | ~150 src + ~250 test               |
| 69b    | The converter and its report                                                  | backend; none (parallel with 69a)          | ~650 src + ~450 test (`Large PR:`) |
| 69c    | Local load of all four years, engine over every year, summary-sheet check     | backend; 69a, 69b                          | ~300 src + ~300 test               |
| 69d    | Staging load job (described below, built later)                               | frontend lane (infra); 79, Nimish's upload | ~120                               |

**Order.** 69a ∥ 69b now (disjoint files; they take both backend slots, so 75 and 77a wait for one to merge). 69c
after both; its local database is the first evidence run for ticket 79 and its summary-sheet check is 79's
"legacy workbooks" reference (79 imports it, no second copy). 77a needs nothing from 69 (S3) and runs in the next
free slot. 79 after 75 and 76. 69d after 79 and after Nimish puts the files in the bucket. 90–96 start on 69c's
local database and are checked again on staging after 69d.

### 69a — importer accepts plant events and old codes

**Files.** `apps/server/src/modules/imports/schema.ts` (split first: it is at 387 lines; move the ticket schema to
`ticket-schema.ts`), `event-schema.ts` (`utility_loss`), `state-events.ts` (the line changes no state),
`insert.ts` (`pastUtility` → channel `backfill`; machine code → id in the payload), `references.ts` (R9; switched-off
codes and any-status machines for past rows), `apps/server/src/modules/plant/index.ts` (publish a by-code lookup
that includes inactive machines and codes), `apps/server/test/harness.ts` (`TEST_PG_URL`: when set, a fresh
database per `startTestDb` on that server instead of a Testcontainer, dropped on `stop`),
`apps/server/test/import-utility-event.test.ts` (new), `docs/DATA-MAP.md` (Tickets: one line for R20),
`changes/69a-plant-events.md`.

**Acceptance.**

- Given an invented export with one plant event naming 3 machines (90, 45, 0 minutes), when imported, then 1
  closed general ticket with channel `backfill`, no machine and 3 `utility_loss` lines summing 135 minutes exist,
  and the plant's breakdown count, downtime and MTTR equal the same import without the event.
- Given the same file again, then `imported 0, skipped 2`; given `pnpm import:undo` on the batch, then the event
  ticket and its 3 lines are gone.
- Given a past breakdown coded `TR` where `TR` is a switched-off entry, then it loads with `TR`; given a code with
  no entry at all, then the import reports it and loads nothing (unchanged rule).
- Given a past breakdown on a `retired` machine, then it loads; given an ordinary (live) ticket on it, then it is
  refused as today. Given an alias target `P-` + a seeded person's 8 hex, then the report links that person.

**Red → green.** Red: `TEST_PG_URL=… pnpm exec vitest run apps/server/test/import-utility-event.test.ts` (unknown
`entryType`). Green: the same, plus `apps/server/test/import-*.test.ts` and `history-load.test.ts`,
`pnpm run typecheck && pnpm run lint`. Local Postgres here: `/usr/lib/postgresql/16/bin/initdb -D <scratch>/pg`,
`pg_ctl -D <scratch>/pg -o '-p 5433' start`; CI keeps Testcontainers.

### 69b — the converter

**Files.** `apps/server/src/seed/legacy-sheets.ts` (grid → rows: header, columns, dates, shifts, machine fold, row
class; ~230), `legacy-classify.ts` (R1′ cross-year duplicates, utility rows, gap months, switches; ~150),
`legacy-export.ts` (rows → tickets, plant events, refs, `legacyId`, people codes, redaction, report; ~280), their
three tests (invented grids, hand-worked numbers), `tools/import-legacy.ts` (CLI: `--tenant`, `--data`, `--out`,
the five switches; reads all years together; refuses `--out` inside the repo; prints the report; ~140),
`tools/import-legacy.test.ts` (real smoke behind `LEGACY_DATA_DIR`, skipped in CI), `tools/answer-key/xlsx.ts` (only
if the smoke shows it: inflate one sheet at a time instead of every entry up front), `package.json`
(`import:legacy`), `changes/69b-legacy-converter.md`.

**The report, per workbook year** (counts and machine codes only): rows read · moved to own year (in) and (out) ·
duplicate · stray year · bad date · unknown machine (per code) · gap month · utility rows → events · tickets
loaded · stray shift · blank code · blank minutes · possible repeat · codes by count. Each row gets one class, in
the order bad date, stray year, duplicate, gap month, unknown machine, utility, ticket; a moved row is a loaded
ticket of its workbook's batch, counted again as `moved`. The identity it prints and asserts (goal 1):
`read = loaded tickets + utility rows + duplicate + stray year + unknown machine + gap month` (bad dates apart).

**Invented fixture traps** (one small grid per trap, names are sentinels like `ZZ-Alpha`): a power cut written on 4
machines on one day plus a second day with 2 (→ 2 events, 6 lines, 0 tickets); a 2-day repair (2,880 minutes, placed
to end inside its shift); a text date `03.11.2022` beside serials; a 2023 sheet holding one row already in the 2022
grid and one that is not (→ 1 duplicate, 1 moved); a `2020` row (stray); a blank code and a blank minute; shifts
`1`, `2`, `1ST`, `2ND`, `3ND`, `7TH`, blank; two rows dated February 2022 (S4 on); a header at row 4 with
`SR.\nNO.`; a sheet of 5 real rows followed by 50,000 empty styled rows; a 3-row `Star-01` sheet with S1 off (excluded) and on (the 19 Nov default: loads as `S-1`)
(the second run keeps every earlier ref).

**Acceptance.**

- Given the fixture, when converted, then the report's numbers equal the hand-worked ones (read 31, loaded tickets
  18 of which 1 moved, utility rows 6 → 2 events, duplicate 1, stray year 1, unknown machine 3, gap month 2) and the
  identity holds; the file parses with `parseSyntheticExport`.
- Given the same input twice, then the canonical JSON is byte-identical; given S1 turned on (the default; the fixture's first run uses `--star off`), then every ref and
  `legacyId` of the first run is unchanged and only the `Star-01` rows are added.
- Given sentinel names in DONE BY, OBSERVED BY, problem and corrective action, then none is in the output, and a
  file that would hold one is refused.
- Given the real workbooks (`LEGACY_DATA_DIR`), then rows read per year equal 1,098 / 3,078 / 2,327 / 1,329, every
  file has ≤ 2,000 tickets and the identity holds for every year.

**Red → green.** Red: `pnpm exec vitest run apps/server/src/seed/legacy-*.test.ts` (modules absent). Green: the
same + `pnpm run typecheck && pnpm run lint` + `LEGACY_DATA_DIR=<scratch> pnpm exec vitest run
tools/import-legacy.test.ts`. One coherent contract over 400 lines: `Large PR:` under D31's work-unit rationale.

### 69c — local load, every year through the engine, the summary sheets

**Files.** `tools/load-legacy.ts` (for each year in order: add missing legend codes as switched-off entries through
the plant module's published function, convert, `import:bhavin`, print the batch id and the report; ~120),
`tools/legacy-check.ts` (reads each workbook's MTTR/MTBF sheets, recomputes count, hours, MTTR, MTBF and
availability per machine-month from the loaded database, prints equal or the named pair; counts and codes only;
~150), `tools/legacy-check.test.ts` (pure, invented sheet), `apps/server/test/legacy-load.test.ts` (the 69b
fixture through the converter and the importer into the harness), `docs/plan/ledger.md` (the evidence line),
`changes/69c-legacy-load.md`.

**Acceptance.**

- Given the fixture loaded, then tickets, events and `source_ref`s equal 69b's report; a second load adds 0; the
  desk lists a fixture day; the machine history drill lists its rows; no stored text holds a sentinel (goal 6).
- Given the engine run with an explicit period for each of 2022, 2023, 2024 and 2025 on the fixture, then the
  breakdown counts equal the hand values and 0 change when the events are removed; February and March 2022 print
  "no records".
- Local evidence (pasted counts in the PR, not CI): a Postgres 16 in the scratchpad, `pnpm migrate`, `pnpm
seed:cosmos`, `pnpm exec tsx tools/load-legacy.ts --data <scratch> --tenant cosmos`: four batches `done`, each
  report's identity holds; the engine runs once per year; `legacy-check` prints 100 % of summary machine-months as
  equal or named (goal 5) — the seven #406 measured (VTL-1 Jan 2025: 3 / 0.89 h / 166.67 h / 0.99466) among the
  equal ones.

**Red → green.** Red: the named mutation (wire `source_ref` to the ticket ref, or drop the `utility_loss` lines)
turns `legacy-load.test.ts` red; restored before commit. Green: `TEST_PG_URL=… pnpm exec vitest run
apps/server/test/legacy-load.test.ts apps/server/test/import-*.test.ts tools/legacy-check.test.ts`.

### 69d — the staging load job (described; built after 79)

A `workflow_dispatch` workflow `.github/workflows/legacy-load.yml` beside `backup.yml`, environment `staging` with a
required reviewer, inputs `tenant` and `years`. Like `backup.yml` it assumes the AWS role by OIDC in `ap-south-1`
and runs everything **on the staging host through SSM**, so the workbooks go bucket → host and never through the
GitHub runner (which runs outside India). On the host: a fresh dump (`tools/backup-dump`), then `aws s3 cp` of
`legacy/<year>/` from the private backup bucket into a temp folder, `tools/load-legacy.ts` with the switch values
recorded in the job's log, `legacy-check` and `validate:full` (79), and `rm -rf` of the temp folder whatever the
outcome. The log carries batch ids, counts and machine codes only; no artefact is uploaded. Nimish uploads the 19
files to `legacy/2022/` … `legacy/2025/` once. Undo is `pnpm import:undo <batchId>` per year over the same SSM path.

## Rails

Red first (or the named mutation for 69c); never delete, skip or weaken a test; one writer per packet; source files
≤ 400 lines, functions ≤ 60; no new dependency (the xlsx reader, schemas and importer exist); no real name, row or
workbook in git, tests, fixtures, logs or PRs; no line in code that joins two utility names with `|`
(`tools/no-utility-guess.test.ts`). Imports touch data but alter none: `ponytail-review` per PR, plus a fresh
reviewer running the covering suite for 69a and 69c.

## What only Bhavin or Nimish can still give

Nothing blocks a packet. Bhavin's answers flip switches S1, S2, S4, S5 (N16, N17, N12) and S3 is ticket 77's
setting. Nimish: the 19 files in the backup bucket before 69d.
