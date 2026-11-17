# Scope: Cosmos's old breakdown registers (2022, 2024, 2025)

For Nimish. Draft, 17 November 2026. Nothing here is built. It answers DATA-MAP question 20 ("what exactly is
the fuller history") and proposes how to load it. Every count below was measured by a throwaway script run over
the 14 uploaded workbooks; the split into kinds of entry is a rough first pass and is marked "about".

## 1. What you sent

The plant's paper-era breakdown register, form **CE-MTN-F-04**, kept in Excel. One workbook per machine family
per year, one sheet per machine, one row per entry.

| Year | Workbooks                    | Machine sheets | Entries |
| ---- | ---------------------------- | -------------- | ------- |
| 2022 | HMC, TC/TMC/Star, VMC, VTL   | 52             | 1,104   |
| 2024 | the same four, plus grinders | 73             | 2,331   |
| 2025 | the same five                | 87             | 1,332   |
| All  | 14                           | 212            | 4,767   |

- **Missing:** all of 2023, the grinders for 2022, and February to March 2022 is almost empty (24 entries against
  about 100 in a normal month). I do not know whether these exist somewhere; Bhavin would.
- **No overlap with what we already hold.** The platform's Breakdown Log covers January to October 2026 (about
  1,350 rows). These registers stop in December 2025. So this adds depth; it does not risk counting twice.
- **It is the same form as the 2026 log.** The platform's log has the same columns. This is its ancestor.
- **Machines:** 88 machines have entries. 83 match today's machine list once the spelling is tidied (VC-06 and
  VC-6, Star and S-1, VL-4 and VTL-4). Five do not: VC-2, VC-3, VC-5, TC-2, CAM (125 entries).

## 2. The schema

Each machine sheet has a title, the form number, a header row, then entries:

| Column                   | What it holds                                          | Filled                         |
| ------------------------ | ------------------------------------------------------ | ------------------------------ |
| Sr no                    | Running number                                         | Unreliable (gaps, restarts)    |
| Date                     | Day of the entry. No time of day anywhere              | 99%                            |
| Month                    | Typed month name                                       | Disagrees with the date on 106 |
| Shift                    | 1st, 2nd, 3rd (also written 1, 2, 3)                   | 99%                            |
| Problem description      | Free text, English                                     | 97%                            |
| Observed by              | Always "Operator"                                      | No information                 |
| Corrective action        | Free text, English                                     | 96%                            |
| Done by                  | A technician's first name in 2022; "Maint. Team" after | Named on about 500 rows, 2022  |
| Total down time, minutes | Breakdown minutes                                      | 98% (83% in 2024)              |
| Total down time, hours   | The same, divided by 60 by a formula                   | Derived                        |
| Maint code               | A code from the legend sheet (Spindle, ATC, Axis, ...) | 89% (80% in 2024)              |
| Elect / Mech             | E, M or both                                           | 88%                            |
| PM (hours), from 2024    | Hours of planned work. Also used as a parking column   | 7 to 12%                       |
| UTI (hours), from 2024   | Hours lost to a power cut or the air compressor        | 53% in 2024, 10% in 2025       |

Some 2022 sheets carry seven more columns: root cause, spares replaced, RCA reference, critical spares, time
consumed, breakdown report time, handover time. **All seven are empty on every row.** So there is no root cause,
no spare list and no clock time in this history. Where a spare is named, it is inside the corrective-action text
(about 400 entries mention a replacement).

Each workbook also has monthly and quarterly MTTR/MTBF summary sheets and a code legend. The summaries are
hand-kept: some carry the wrong year in the title, some show division errors, and they agree with the rows
beneath them on only 77 to 94% of machine-months. They are a cross-check, not data.

## 3. What is really in there

These 4,767 rows are not 4,767 breakdowns. They are about six different things:

| Kind of entry (about)                                                                     | Rows  |
| ----------------------------------------------------------------------------------------- | ----- |
| A real breakdown                                                                          | 2,640 |
| A power cut or compressed-air loss                                                        | 1,500 |
| Preventive maintenance                                                                    | 347   |
| A long job parked in the PM column (vendor repair, shifting a machine, fitting a spindle) | 123   |
| An accident caused by operator error                                                      | 75    |
| A row with downtime but no words                                                          | 82    |

Seven traps a plain copy-in would fall into:

1. **Power cuts are copied onto every machine's sheet.** 1,205 of the 1,500 utility rows are the same outage
   written on five or more sheets; 21 outages were written on 20 or more. Loaded as breakdowns, 2024 would show
   about 2,300 "breakdowns" when it had about 830. The 2026 log records almost none (one row), so the years would
   not be comparable.
2. **A repair that ran for days is one row per day.** 289 such runs cover 904 rows. A spindle away for 20 days
   reads as 20 failures of 8 hours, not one failure of 160. Merged, 2,640 breakdown rows become about 2,025
   breakdowns. This changes MTBF and MTTR more than anything else here.
3. **The codes changed.** The registers use the old legend plus off-legend variants; 2026 uses a different list.
   519 rows have no code. In places the code and the Elect/Mech value sit in each other's column.
4. **Dates.** 275 are typed as text in two formats, 11 are unreadable or missing, 11 carry an impossible or
   wrong year, and some shifts read "4th" to "13th" from a dragged cell.
5. **Downtime is three columns that are not exclusive.** 166 rows carry the same hours twice. 283 rows are a
   round shift (480, 600 or 960 minutes): "all shift", not a measurement.
6. **People.** Only 2022 names who did the work, by first name, in 74 spellings. 2024 and 2025 name nobody.
7. **Junk.** A hidden 2022 template sheet is copied into three workbooks; 30 rows are exact duplicates. The
   38 MB workbooks are about 300 KB of content: formatting was dragged to the last row of the sheet.

## 4. What this buys, and what it cannot

**Gains.** History goes from ten months to about four years (with the 2023 hole):

- Repeat failures and chronic machines become visible; ten months is too short to see them.
- "Did breakdowns fall after the PM?" can be answered for 2024 and 2025.
- Hours lost to the grid, per year, as its own figure.
- About 2,600 more problem-and-fix pairs behind Fix Finder and the AI diagnosis (M6), per machine.

**Limits.** No response time, no acknowledge or restore clock, no spare cost, no root cause, and no technician
ranking: those fields are not in the registers. Any screen that needs them must leave this era out and say so.

## 5. My view, including where I disagree with the ask

**It is structured data, not unstructured.** A plain rule-based reader recognised all 212 sheets with no column
left unexplained. Only two cells per row are free text. So AI does not belong in the reading. Using it there
would add cost, send data abroad, and make the numbers unrepeatable, for no gain.

**Do not build a general "any data" engine now.** You deferred a general import format to M5 (BRIEF, 13 Nov), and
D21 already designs the narrow path: code names, then check, then load, then undo. That path is not built yet.
Build it. The reusable part is not a clever reader; it is three things:

1. One agreed shape every old record must reach (the contract).
2. A checker that refuses bad files and lists doubtful rows for a person, never guessing.
3. A small **profile** per source that holds its quirks as data: header names, date formats, machine spellings,
   code aliases, the rules for kinds. A second plant's register is then a new profile, not new code.

I would only call it an engine after a second, different source has gone through it. Until then the claim is
untested.

**The picture.** A sorting line with five stations:

- **Read:** open the workbook, find the header row, ignore the summaries and the empty million rows.
- **Recognise:** say what each row is (breakdown, outage, PM, accident, other planned work).
- **Tidy:** fix dates, machine codes and codes; join day-by-day rows into one breakdown; join one outage across
  machines.
- **Judge:** pass, or put on a review tray with the reason. I estimate about 250 rows (5%) need a person.
- **Load:** as closed tickets marked as old history, in one step that can be undone.

**Where AI does fit, later.** Reading the free text to suggest a code for the 519 blank rows, the part that
failed, the spare named, and whether a vendor came. Suggestions only, confirmed by a person in bulk, stored
beside the facts and never over them (D16). This rides on M6 and needs the plant's consent and a spending cap.

**One problem to tell you about.** D21 says names are swapped for codes on our own machine before a Claude
session sees the files. These came raw. The exposure is small: technician first names in "Done by" on about 500
rows of 2022. I found no phone numbers. Nothing with a name is in the repo or in this document; the working
copies sit in this session's temporary folder and go when it ends.

## 6. Decisions I need from you

Each has my recommendation. They are counting rules, so they are yours (and Bhavin's), not mine.

| #   | Question                                                 | Recommendation                                                                                                                |
| --- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | Is a power cut a breakdown?                              | No. One plant event, kept out of machine MTBF and MTTR, shown as its own "lost to utilities" figure                           |
| 2   | A repair spread over days: one breakdown or one per day? | One. Keep the daily rows as its history. Bhavin's per-row figure stays available under the legacy rules                       |
| 3   | Long jobs parked in the PM column, and accidents         | Vendor repair counts as breakdown downtime; an accident is a breakdown coded human error; shifting or fitting is planned work |
| 4   | VC-2, VC-3, VC-5, TC-2, CAM                              | Load as retired machines so plant totals are right. Bhavin confirms none was merely renamed                                   |
| 5   | 2023, grinders 2022, Feb to Mar 2022                     | Ask Bhavin for the files. Until then charts show the gap; nothing is filled in                                                |
| 6   | Technician names from 2022                               | Keep as codes; do not rank technicians on this era. Two of three years name nobody, so a ranking would mislead                |
| 7   | Rows with no words, bad dates, duplicates (about 250)    | A person at Cosmos decides each from a list; none is guessed and none is dropped silently                                     |
| 8   | Consent                                                  | Is Cosmos's written consent (N14) filed? It should cover these files, and I should know before any further run                |

## 7. Build scope

Six tickets, backend lane, after ticket 37's first goal lands because they share its loader. No new table (D17):
old entries become closed tickets on the existing past-breakdown path, each load recorded in the import ledger
with one undo. One decision record amends D21, because its file shape cannot yet say four things this data
needs: the kind of entry, "date only, no time", "these rows are one breakdown", and "these rows are one outage".

| #   | Ticket                       | Delivers                                                                                                     | Proof                                                                                              |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| H1  | Contract and decision record | The agreed record shape with the four additions; the list of reasons a row is refused, held or passed        | A file missing a required part is refused with the row and reason                                  |
| H2  | Code the names               | Workbooks in, coded copies out; the key stays on the operator's machine                                      | A workbook with made-up names comes out with none; phone-shaped numbers too                        |
| H3  | Register reader and profile  | CE-MTN-F-04 sheets become records; every quirk in section 3 is a rule in the profile                         | Made-up sheets for each trap give the expected records; a 1,000,000-row padded sheet reads quickly |
| H4  | Check and review tray        | A report of counts by reason, and a list of held rows a person can settle                                    | A held row loads only after a recorded answer                                                      |
| H5  | Load and undo                | Staging first, then production under time-limited support access after a backup                              | Loading twice adds nothing; undo removes that load only; live tickets are untouched                |
| H6  | Analytics knows the era      | Figures can include or leave out outages and planned work; clock-based figures leave this era out and say so | The workbook summaries are reproduced within a stated tolerance; drill-down reaches the old rows   |

Later, with M6: text suggestions for blank codes, parts and vendors.

**Out of scope:** an upload screen, other plants, other file types, PDFs or scans, any change to live tickets.

**Technical forks, settled or to settle by running something (not questions for you):**

- Reading Excel: the repo already reads registers with a hand-run script and has an approved spreadsheet
  library; my trial read all 14 files. The reader must stop at the end of real content.
- How one outage across 30 machines is stored without a new table is not proven. H1 settles it with a prototype.
- Whether date-only records need a marked "time unknown" on the ticket, so nothing invents a start time.

**Size.** Each ticket is sized to the plan's one-hour-to-PR rule; H3 is the largest and may split in two. The
calendar time is set by decisions 1 to 8 and by the review tray, not by the code.

## 8. What I am not sure of

- The split into kinds (section 3) comes from simple word rules. Expect the counts to move by a few percent.
- Whether the 2022 first names match today's people. I did not check, on purpose.
- Why 2024 has so many more outage rows than 2025 (1,282 against 152): a worse year for power, or a change in
  what the team wrote down. Bhavin would know, and it matters for decision 1.
- Whether 2023 was ever kept.
