# 69 — legacy history 2022, 2024, 2025 loaded as closed tickets

- The whole legacy warehouse Nimish confirmed (2022, 2024 and 2025 workbooks — no 2020/2021/2023 file exists) is now
  convertible and loadable as closed history: **4,566 tickets**, 2022 974, 2024 2,296, 2025 1,296, through the same
  synthetic import path the 2026 log uses. Each keeps its source reference, its machine, its shift, its minutes and
  its report, so it shows on the desk date list, on the machine page's history and in the Breakdown Log's drills.
- The converter reads every per-machine sheet by its header (the headers carry newlines and one 2022 sheet has a
  stray date where the word DATE should be), folds the sheet's spelling of the machine code (`GRD-01`→`GRD-1`,
  `VL-4`→`VTL-4`, `CAM`→`CAM-01`, `TMC-4_CY52`→`TMC-4`), and validates it against the plant's active machines.
  **159 rows name a machine the plant no longer holds** (retired TC-2/VC-2/VC-3/VC-5, the Star sheets) and are
  counted, not guessed; so are 20 out-of-year rows (10 stale copies of the 2022 TC-2 sheet inside the 2024/2025
  workbooks) and 1,851 empty template rows.
- PM and utility rows are kept, exactly as the 2026 load kept its 64 PM rows: PM 400, UTI/accident 1,471, breakdown
  2,695. A blank minute cell is 0 minutes (409 rows), and a blank problem text gets the 2026 load's fallback (84
  rows). The plant's MTTR/MTBF summaries count a breakdown only when it has downtime; seven machine-months were
  recomputed from the loaded rows and match to the sheet's own decimal (VTL-1 Jan 2025: 3 breakdowns, 0.89 h MTTR,
  166.67 h MTBF, 0.99466 availability).
- Names never leave the converter's memory. A person is matched by name against the tenant's people and replaced by
  their `personCode`; an unmatched name gets a stable `LG-` code (the same in every year), and names inside problem
  and corrective-action text become `[person]`. The converter refuses to write a file that still names anyone. The
  `pii:scan` deny list is built from the 2026 discovery pack, so it is green whether or not this load is clean —
  recorded, which is why the converter's own check is the proof and the workbooks stay under the ignored
  `.agents/data/`.
- The old codes resolve through one synthetic map, labelled as such (the real map is N12/Q9, as in 37c): `UTI`/`UTY`
  → `NO DT`, the slash composites and the legacy-only codes → `MIS`, a blank stays null; the report prints the
  count per source code.
- Refs sit in a per-year band below the live counter — `BD-20001…`, `BD-40001…`, `BD-50001…` — so the live counter
  does not move (unlike 37c's jump). 2024 is written as two files because the importer caps a file at 2,000 tickets;
  refs are the year's, so the split never renumbers.
- A re-import of the same file adds nothing (`imported 0, skipped N`); regenerating after a people change is refused
  loudly (`changed_payload`) rather than duplicated, so the emitted file is the batch's evidence.
- Red evidence (verification packet): wiring `source_ref` to the ticket ref instead of the legacy id, or resolving
  every alias to a placeholder instead of the person code, turns the new load test red; both restored before commit.
- Not loaded, and reported: the retired machines and the Star sheets until Nimish says whether they are plant
  machines, and any 2020/2021/2023 workbook he may still have.
