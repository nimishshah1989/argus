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

**First, what it must not change.** Bhavin's screens (tickets 38 to 45) are being matched digit for digit against
his platform, which holds only 2026. Those figures keep reading 2026 only. The old years feed the long-range views,
M4b's reliability work and M6's AI tests, where ten months is too short to say anything.

**Where it pays, screen by screen.** Counts are from the trial read; treat them as approximate.

| Analytics (ticket)                                      | With 2026 alone                                                                               | With the registers added                                                                                                                                              |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reliability curves, critical spares (67)                | 42 machines have 10 or more breakdowns; 15 have 20 or more                                    | 76 and 56. Per-machine failure curves need that many failures, so this ticket goes from "mostly not enough history" to usable on most machines. Biggest single gain   |
| Forecast and Forecast Lab (42)                          | The lab tests each method on about 7 months; 72 machines reach the 6-breakdown confidence bar | 24 more test months (2024 to 2025) and 95 machines. Choosing a forecasting method stops resting on 7 data points. Runs in our profile; Bhavin's lab still matches his |
| Trend test, repeat faults, "worsening machine" (42, 44) | Ten months of baseline                                                                        | A machine compared with its own 2024 and 2025. A repeat fault is visible across years (HMC-2's Z-axis, VC-27's tool declamp)                                          |
| MTBF, MTTR, availability on real hours (48)             | One partial year                                                                              | Three years per machine, year on year, with one breakdown counted once however many days it ran                                                                       |
| Did an intervention work (54)                           | Little "before" to compare against                                                            | Two years of before. A PM change in 2026 is judged against 2024 and 2025 and a control group                                                                          |
| Machine pages (39)                                      | Ten months                                                                                    | Three more years of history, drillable to the paper row                                                                                                               |
| Fix Finder, find past jobs (43, 57)                     | About 1,350 problem-and-fix pairs                                                             | About 2,650 more, per machine and per kind of fault                                                                                                                   |
| AI code suggestion and its test (56, 58)                | The test set must be built by hand                                                            | About 3,000 old rows where a person already wrote a code beside the words: a ready test to measure the AI before it is switched on (after the old codes are mapped)   |
| New-machine failures (OEM analytics, deferred)          | 24 machines under 300 days                                                                    | 16 machines new in 2025 with about 130 entries in their first year: evidence for warranty claims, once Bhavin agrees the rule                                         |
| A new figure: lost to utilities                         | Not recorded in 2026                                                                          | About 940 machine-hours in 2024 on 148 outage days, about 170 in 2025 on 41. A money case for power backup, if the drop is real and not a change in what was written  |
| A new figure: vendor dependence                         | Spare cost only                                                                               | About 110 entries and 630 hours mention CIPL, the OEM or "sent for repair": how long the plant waits on outsiders, for AMC decisions (51)                             |

**Limits.** No response time, no acknowledge or restore clock, no spare cost, no root cause, and no technician
ranking: those fields are not in the registers. Any screen that needs them must leave this era out and say so.

**Claude's manufacturing plugin.** Of its 17 skills, two matter here, and Argus already adopted the core of both
(`docs/plan/CLAUDE-ADOPTION.md`, ADR 0007, `THIRD_PARTY.md`; Apache-2.0, so the logic may be copied with
attribution). The rest need sensor, ERP, production-count, inspection or CAD data that Argus does not have:
quoting, sourcing, OEE reports, 8D and CAPA, the overnight production pulse.

- `breakdown-diagnosis` is the model for M6's diagnosis and the technician-facing ranking. New to us, for this data:
  its rule that words like "again", "still", "temporary fix" are the strongest sign of a repeat fault. In the
  registers, about 134 breakdown entries on 39 machines carry such a word ("not ok", "work in progress", "under
  observation"). A cheap first repeat-fault signal for ticket 42, before any AI. Also its rule "an asset with no
  history is not a good actor, it is unreported": machines missing from a year (the 2023 hole, new or retired
  machines) must be listed apart, never ranked as reliable.
- `data-consolidate` is the model for the loader's checks; five of its rules are already adopted. New to us: the
  approved-normalisations list (each spelling fix recorded with who agreed and when), which becomes the register
  profile, and its rule to count how many rows share a key, which is exactly the outage and multi-day trap.
- Running the skills as-is on Cosmos's data is not advised: they send data to Claude, publish outside India and
  price in dollars. Their methods go into our code; the skills themselves stay out.

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
