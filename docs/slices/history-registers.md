# Slice plan: Cosmos's old breakdown registers (tickets H1 to H6)

For the builder who takes this on. Written 17 November 2026 from a measured read of all 14 workbooks. The product
case and the open decisions are in `docs/plan/history-registers-scope.md`; read that first, then this. Every count
here came from a throwaway reader run over the real files; treat the counts as expected values for your checks,
with a few percent of slack on the "kind" split.

## 0. Read before you start

- `docs/plan/history-registers-scope.md`: what the data is, the traps, the eight decisions.
- `docs/decisions/D21-cleaned-history-file-and-loader.md`: the path this work uses. You amend it; you do not replace it.
- `docs/decisions/D17-table-budget.md`: no new table. Old history is closed `ticket` rows.
- `docs/DATA-MAP.md` §5 and §8: names, consent, what may leave India.
- `apps/server/src/modules/tickets/import.ts` (`importTickets`, `ImportedTicketRow`, channel `backfill`),
  `apps/server/src/modules/imports/batch.ts` (`openBatch`), `.../undo.ts`, `scripts/pseudonymise-export.ts`.
- `packages/domain/src/analytics/types.ts`: `TicketRow.source` is already `'live' | 'history'`.
- `packages/db/migrations/0014_m4a_schema.sql`: `list_item.aliases` exists for old codes.

## 1. Goal

Cosmos's 2022, 2024 and 2025 breakdown registers become closed history tickets, each counted once, so that the
machine page, the long-range analytics and Fix Finder can see about four years instead of ten months. Bhavin's
parity figures do not move by a single digit. One command loads, one command undoes.

**Done, as a user sees it:** a head opens VC-20's page and sees its 2024 rotary failures as history; a 2024
power cut shows once as a plant event, not as 30 breakdowns; a spindle away 13 days shows as one breakdown with its
daily notes; every old figure drills to the rows behind it; the Dashboard still shows 1,279 breakdowns.

## 2. Blockers and order

| Ticket | Blocked by                                                                |
| ------ | ------------------------------------------------------------------------- |
| H1     | 37c merged (it builds the history loader for the 2026 log; you extend it) |
| H2     | none (tooling only; can run beside H1)                                    |
| H3     | H1                                                                        |
| H4     | H3                                                                        |
| H5     | H4, Nimish's decisions 1 to 7, consent N14 filed (decision 8)             |
| H6     | H5 on staging                                                             |

One writer per file. H1 and H3 touch `packages/shared/src/history-file.ts`; never at the same time. No migration is
expected. If H1's prototype proves one is needed, stop and ask for the migration lock (CLAUDE.md).

## 3. The source data (what you will read)

**Files.** 14 `.xlsx` workbooks, one per machine family per year: `HMC`, `TC & TMC - Star`, `VMC`, `VTL` for
2022, 2024 and 2025, and `GRD-Machine` for 2024 and 2025. They are **not in the repo and must never be committed**:
they hold technician first names. They live with Nimish. You work from pseudonymised copies (H2) and from synthetic
fixtures you write yourself.

**Sheets.** One sheet per machine, named by machine code. Skip every other sheet:

- Summaries: `MTTR MTBF`, `MTTR & MTBF`, `MTTR MTBF (2)`, `Q-MTTR & MTBF`, `Q-MTTR&MTBF`, `Q-MTTR&MTTBF`,
  `Q-MTTR-MTBF`, `1`, `Sheet1`.
- Legend `Code Abrivation`; empty `BD Analysis`, `Sheet2`, `Sheet3`.
- Hidden sheets. `TC-2` is a hidden 2022 template copied into all three TC workbooks; reading it adds 2022 rows
  to the 2024 and 2025 files.

**Layout.** Rows 1 to 3 (sometimes 1 to 4) are the company name, `BREAK-DOWN HISTORY OF <machine> (<year>)` and
the form number `CE-MTN-F-04` (three 2022 sheets say `MTN/F/01/02`). The header is on row 4 or 5. Data follows.
Detect the header as the first row holding both `SR` and `PROBLEM`; do not hard-code its row.

**Header variants** (normalise case, spaces and line breaks before matching):

| Field            | Header text seen                                                                                                                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| date             | `DATE` (one 2022 template says `18.03.202`, the hidden sheet)                                                                                                                                                              |
| month            | `MONTH`; on VC-28 and VC-30 (2024) the header says `MACHINE` but holds the month                                                                                                                                           |
| shift            | `SHIFT`                                                                                                                                                                                                                    |
| problem          | `PROBLEM DESCRIPTION`                                                                                                                                                                                                      |
| observed by      | `OBSERVED BY`                                                                                                                                                                                                              |
| action           | `CORRECTIVE ACTION`                                                                                                                                                                                                        |
| done by          | `DONE BY`                                                                                                                                                                                                                  |
| downtime minutes | `TOTAL DOWN TIME ( IN MIN. )` and spacing variants                                                                                                                                                                         |
| downtime hours   | `TOTAL DOWN TIME ( IN HR. )` (a formula; read the cached value)                                                                                                                                                            |
| code             | `MAINT CODE`                                                                                                                                                                                                               |
| elect/mech       | `ELECT/ MECH`, `ELECT / MECH`, `ELECT /MECH`                                                                                                                                                                               |
| PM hours         | `PM`, `PM/ MC ACCIDENT`                                                                                                                                                                                                    |
| utility hours    | `UTI`, `UTI/ACCIDENT`                                                                                                                                                                                                      |
| 2022 extras      | `ROOT CAUSE`, `SPARES REPLACED`, `RCA REF. NO.`, `CRITICAL SPARES IDENTIFIED`, `TIME CONSUMED`, `B/D REPORT TIME`, `HANDOVER TIME`: present on some sheets, **empty on every row**. Read them, expect empty, report if not |

**Padding.** Several sheets report 1,000,000+ rows (formatting dragged down). The 38 MB workbooks hold about
300 KB of content. Stop a sheet after 200 consecutive empty rows; a full read of all 14 files must finish in under
a minute.

**Expected yield:** 212 machine sheets, 10 of them empty, 4,767 entries (1,104 in 2022, 2,331 in 2024, 1,332
in 2025). Ignore entries with neither text nor downtime; there are thousands of numbered blank rows.

## 4. The record you produce (contract additions to D21)

D21's `historyFileV1` row lacks four things this data needs. H1 adds them (a `v: 2`, or optional fields on v1:
H1 decides with 37c's author and records why).

| Field                        | Type                                                                                                        | Why                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `entryKind`                  | `breakdown`, `accident`, `utility_outage`, `pm`, `planned_work`                                             | The registers mix five things; the engine must be able to leave each out                    |
| `dateOnly`                   | boolean, with `shift`                                                                                       | No time of day exists. Nothing may invent one silently                                      |
| `episodeId`                  | string or null                                                                                              | Rows of one repair spread over days become one ticket                                       |
| `outageId`                   | string or null                                                                                              | One power cut copied onto many sheets becomes one plant event                               |
| `downtime`                   | `{ breakdownMin, pmMin, utilityMin }`, each number or null                                                  | Three source columns that overlap; keep them apart                                          |
| `codeVerbatim`, `emVerbatim` | text                                                                                                        | What the sheet said, beside the resolved code                                               |
| `source`                     | `{ fileSha256, sheet, row }`                                                                                | Every ticket traces to its cell (D21 already has `sourceId` and `sourceRow`; add the sheet) |
| `flags`                      | list: `round_shift_downtime`, `month_disagrees`, `shift_unreadable`, `code_swapped`, `double_counted_hours` | Reported, never silently fixed                                                              |

## 5. Profile rules (the quirks, as data)

Put every rule below in one profile object, `cosmos-register-ce-mtn-f-04`, as data (lists, patterns, numbers),
not as branches in code. A second plant's register is then a new profile. Every spelling fix in it (machine
codes, code aliases) is an entry with both spellings, who agreed and the date, after the plugin's "approved
normalizations" list (`skills/data-consolidate/reference/mismatch-classes.md`; Apache-2.0, attribute per
`THIRD_PARTY.md`). A padded code (`VC-06`) maps only when its partner exists on the machine list. Each rule gets a synthetic fixture and
a test; the "seen" column is what the real files hold, for your sanity check.

| #   | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                             | Seen in real files                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| P1  | **Machine code** from the sheet name, written as today's machine list writes it: drop leading zeros (`VC-06`→`VC-6`, `GRD-01`→`GRD-1`), `VL-4`→`VTL-4`, `Star` and `Star-01`→`S-1`, `Star-02`→`S-2`, `DCMC-1`→`DCMC-01`, strip suffixes (`TMC-4_CY52`→`TMC-4`, `TMC-5_H-TURN`→`TMC-5`) and trailing spaces (`TC-23 `). Match against the tenant's machines; no match → hold                                                                      | 88 machines; 83 match; VC-2, VC-3, VC-5, TC-2, CAM do not (125 rows)                                             |
| P2  | **Date**: Excel dates as they are. Text `dd.mm.yyyy`, `dd-mm-yyyy`, `dd/mm/yyyy` read day-first. Anything else (`80-01-2022`, `14.1120.22`, `02/07/225`) → hold. A year that is not the file's year → hold, never "corrected"                                                                                                                                                                                                                    | 4,481 Excel, 275 text, 11 unreadable or missing, 11 wrong year                                                   |
| P3  | **Month column** is a cross-check only. Disagreeing with the date → flag `month_disagrees`; the date wins                                                                                                                                                                                                                                                                                                                                        | 106 disagree; 131 hold a date instead of a month                                                                 |
| P4  | **Shift**: `1st`, `1`, `1ts` → 1; `2nd`, `2` → 2; `3rd`, `3nd`, `3` → 3. Anything else (`4th` to `13th`, `40`, `A`) is a dragged cell → null and flag                                                                                                                                                                                                                                                                                            | 99% readable; about 20 dragged                                                                                   |
| P5  | **Kind**, first match wins: (a) `utility_outage` when the UTI hours are above 0, or the code is `UTI`/`UTY`, or the text says power fail, GEB, air low or compressor and breakdown minutes are 0; (b) `accident` when the text says accident; (c) `pm` when the code is `PM` or the text says preventive or PM activity; (d) `planned_work` when PM hours are above 0, breakdown minutes are 0, and (c) did not match; (e) `breakdown` otherwise | about 1,500 utility, 75 accident, 347 PM, 123 planned, 2,640 breakdown                                           |
| P6  | **No words, has downtime** → hold                                                                                                                                                                                                                                                                                                                                                                                                                | 82                                                                                                               |
| P7  | **Downtime**: minutes from the minutes column; PM and UTI columns are hours, times 60. When breakdown minutes equal PM hours × 60 on a PM row, count once and flag `double_counted_hours`. A value of 480, 600 or 960 minutes gets `round_shift_downtime` (kept, flagged: it means "all shift", not a measurement)                                                                                                                               | 166 double-booked; 283 round-shift                                                                               |
| P8  | **Episodes** (decision 2): breakdown rows on the same machine with the same normalised problem text, each within 4 days of the last (the gap is a profile number), share an `episodeId`. The ticket starts on the first date, its downtime is the sum, and each row becomes a dated history line                                                                                                                                                 | 289 runs, 904 rows; 2,640 rows become about 2,025 breakdowns; longest run 20 rows                                |
| P9  | **Outages** (decision 1): utility rows on the same date on two or more machines share an `outageId`                                                                                                                                                                                                                                                                                                                                              | 224 dates; 76 hit 5+ machines; 21 hit 20+                                                                        |
| P10 | **Codes**: resolve through `list_item.aliases`. The registers use the old legend (E, M, AX, SP, RT, ATC, FS, MS, PC, LB, CP, HM, MIS, PP, T, PAR, CON, UTI, NI, PM) and variants (UTY, TR, E/M, M/E, M/S, M/M, MPG, MIX, TL, NIS, FNC, S, P/M). Unmapped → keep verbatim, report `unknown_code` (D21), never guess. Blank code → null                                                                                                            | 519 blank. **The alias table itself is Bhavin's call**; ship a proposed list for him to confirm, not a final one |
| P11 | **Swapped code and E/M**: when the code cell holds E, M or E/M and the E/M cell holds a legend code, swap and flag `code_swapped`                                                                                                                                                                                                                                                                                                                | about 20; count and report                                                                                       |
| P12 | **People**: `Maint. Team`, `Operator`, `CIPL`, OEM and vendor names, `NA` → no person. A name → the H2 token. `A/B`, `A & B`, `A, B` → several tokens. `Observed by` is always "Operator": drop the field                                                                                                                                                                                                                                        | names only in 2022 (74 spellings, about 500 rows); 2024–25 name nobody                                           |
| P13 | **Duplicates**: same machine, date, shift, problem and downtime as another row → hold as `duplicate_row` (D21 blocks until a person settles it)                                                                                                                                                                                                                                                                                                  | 30 extra rows in 25 groups                                                                                       |
| P14 | **Strays**: any value in a column right of the last known header → report with sheet and row                                                                                                                                                                                                                                                                                                                                                     | 5 cells, one of them real text about a spindle repair                                                            |

## 6. How it is stored (H1 proves this before H3 starts)

No new table, no new column, if the prototype allows it:

- **A breakdown episode, accident, PM or planned job** → one closed ticket through `importTickets`, channel
  `backfill`, kind `stopped`, the work type telling the kind apart (work types are `list_item` rows; add entries,
  not columns). Its breakdown report carries downtime, code and E/M. Each daily row of an episode → one history
  line on that ticket, in date order, with its problem and action text.
- **An outage** → two options; H1 builds both on a tiny fixture and keeps the one that passes the tests in §8:
  (a) one ticket per machine hit, work type utility, the shared `outageId` kept in the import row so the engine can
  count the event once; (b) one general ticket for the plant event and the per-machine hours in its report data.
  Pick by which one lets "hours lost to utilities per machine" and "outages per year" both drill to rows.
- **Time of day**: the ticket's instant is the plant date at its shift's start (the `shift` table), and it is
  marked as estimated. 37c meets the same problem (Bhavin's log is also date and shift only): **use 37c's answer**.
  A figure that needs clock time (response, acknowledge, restore) must leave estimated tickets out.
- **References**: old history must not use up live `BD-` numbers. H1 picks a prefix (for example `H24-0001`) and
  checks no screen assumes `BD-`/`WR-`.
- **Provenance**: one `import_batch` per load (`source = 'history-registers'`); one `import_row` per source row,
  coded content only, pointing at the ticket it became.

## 7. Engine rules (H6)

- **Parity never moves.** Bhavin's legacy profile is computed on his platform's data, which starts in 2026. Old
  register tickets end in December 2025. The legacy profile reads tickets from a "data from" date in its settings
  (2026-01-01 for Cosmos). A test loads old-era tickets beside the answer-key input and proves every ready figure
  still equals its key.
- **The standard profile reads all eras** and can include or leave out each kind: outages, PM, planned work.
- **Gaps are shown.** 2023 has no data, the grinders have no 2022, February to March 2022 is nearly empty. A figure
  over a span with a gap says so; it never reads the gap as zero breakdowns.
- **Missing is not reliable.** A machine with no entries in a span (the 2023 hole, a machine bought later, a
  retired one) is listed as "no record", never ranked as a good machine. Source: the manufacturing plugin's
  `skills/breakdown-diagnosis/reference/bad-actor-mode.md` ("An asset with no history is not a good actor").
- **Uncoded is not a cause.** The 519 rows with no code never appear as a bar called "Other" in a cause ranking;
  they are counted beside it.
- **Repeat-fault words.** "again", "still", "temporary", "not ok", "under observation", "work in progress" in the
  action text mark a fix that did not hold (about 134 breakdown entries on 39 machines; "not ok" is noisy). Store
  as a flag for ticket 42's repeat-fault figure. Source: `breakdown-diagnosis/reference/evidence-sources.md`.
- **First new figures**: hours lost to utilities per month and per machine; outages per year; MTBF and MTTR per
  machine per year with the episode rule; repeat episodes per machine over the full span. Each registered with a
  drill target (the engine already refuses a figure without one).

## 8. Tickets

Each is one PR with one `changes/` fragment, under the hour-to-PR timebox.

**H1 Contract and storage proof** — Blocked by: 37c

1. [API] Given a history file row missing `entryKind`, when it is checked, then it is refused with its row id and
   the reason. Given a row with `dateOnly: true` and no shift, then it is refused.
2. [API] Given a three-day episode of three rows, when loaded, then one closed ticket exists with the summed
   downtime and three dated history lines. Given one outage on four machines, then the chosen storage (§6) counts
   one event and four machine-hours entries, each drillable.
3. [Docs] A decision record (D3x) amending D21: the added fields, the chosen outage storage and why the other lost,
   the reference prefix.

**H2 Code the names in workbooks** — Blocked by: none

1. [Script] `history:pseudonymise` reads `.xlsx` (today it reads JSON): given a workbook with made-up names in
   `DONE BY` and inside action text, and a made-up phone number, then the copy holds tokens and no name or phone,
   and the map file sits outside the repo. Reuse `scripts/pseudonymise-export.ts`'s matching (honorifics included).
2. [Script] The copy keeps every date, number and formula's cached value unchanged (a byte-level diff of the
   non-name cells is empty).

**H3 Register reader and profile** — Blocked by: H1

1. [Unit] One synthetic workbook per rule P1 to P14 gives the expected records and flags.
2. [Unit] A synthetic sheet padded to 1,048,576 rows reads in under 2 seconds; hidden and summary sheets add no rows.
3. [Script] `history:read <dir> --profile cosmos-register-ce-mtn-f-04 --out <file>` writes the history file and a
   count line per workbook: rows read, records out, held, skipped. Read, out, held and skipped always add up.

**H4 Check and review tray** — Blocked by: H3

1. [API] `history:check` extends D21's report with the new holds (P1, P2, P6, P13 and unmapped machines). The
   report holds row ids, counts and dates only.
2. [Script] Held rows export as a short sheet a person at Cosmos fills in (keep, fix to value, drop with reason);
   the answers file is applied on the next check, and a dropped row is counted and kept in the import ledger.
   Given a held row with no answer, the load refuses.

**H5 Load and undo** — Blocked by: H4, decisions 1 to 7, consent filed

1. [API] Given the same file twice, the second load adds nothing and returns the first batch. Given a 2026-log
   batch and a register batch, undoing either leaves the other's tickets.
2. [API] Live tickets, their counters and their figures are unchanged after a load (a before/after count test).
3. [Ops] Staging first; Nimish spot-checks three machines he knows; then production under a time-limited support
   grant after a backup, as D21's safety order.

**H6 Analytics knows the era** — Blocked by: H5 on staging

1. [Engine] The parity test in §7 passes with old-era tickets loaded.
2. [Engine] The four first figures in §7 compute, each with its drill; a span with a gap is labelled.
3. [Engine] Reconciliation: per workbook, machine-month counts and hours from the loaded tickets are compared with
   the workbook's own summary sheets. Expected agreement is 77 to 94% of machine-months (measured); every
   disagreement is listed for Bhavin. This is a report, not a pass mark: the summaries are hand-kept and wrong in
   places.

## 9. Stop and ask (do not decide these yourself)

- The answers to the eight decisions in the scope note §6. Build each as a profile switch with the recommended
  default, so an answer is a setting change, not a rewrite.
- The code alias list (P10): Bhavin confirms it.
- Any migration, any new table, anything that changes a parity figure.
- Running anything against production.

## 10. Out of scope

An upload screen; other plants; CSV, PDF or scanned paper; AI reading of the text (that is M6: code suggestion for
the 519 blank codes, spare and vendor extraction, all as confirmed suggestions under D16); any edit of live tickets.
