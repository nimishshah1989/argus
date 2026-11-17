# M4a-37c — the 2026 breakdown-log load (ticket 37 goal 1)

Ticket 37 goal 1: "The 1,354-row breakdown log is loaded as closed tickets through the past-breakdown path with source
references and legacy codes mapped through the alias column; each counts once beside the live tickets, and imported
history shows on the desk; the leaver erasure path from 07 replaces a leaver's name in these history tickets too."

The data is the pseudonymised 11 November extract in the repo: `fixtures/answer-key/input.json` carries 1,343 breakdown
rows + 7 `otherBD` rows (the live log, not the workbook). The 1,343 include **60 `bd_live_` rows that carry their real
`ticketRef`** (already live tickets) — so "each counts once beside the live tickets" means: the 60 are **skipped**
(identity matches the live ref), the remaining **1,283 are loaded**. The mechanism is the existing synthetic importer
(`argus.synthetic-bhavin/v1`); each loaded row becomes an `import_row` whose `source_ref` is the row's legacy id
(`bd_…`) and a closed `pastBreakdown` ticket (channel `backfill`). A plan review listed four hard contradictions the
first draft had with the schema; all four are settled below against the code.

**External dependency recorded (N12, open, Bhavin):** the history's codes not in settings are exactly NI=2, FS=1, PP=1,
UTI=1 plus 4 blanks. The real mapping (`MEC→M`, `NI/INT/FS/PP/UTI→MIS or inactive`) is NEEDS N12 / Q9. This packet ships
the mechanism with a **synthetic-only** alias config named as such; the `list_item.aliases` column (migration 0014) is
seeded when N12 lands, and no product code reads that column today — the loader resolves the export's own
`aliases.maintenanceCodes` (references.ts:194-199 → reconcile.ts:273). No invented mapping is presented as the plant's.

## Packet 37c-1 — the generator (one PR, one writer)

`apps/server/src/seed/breakdown-log-export.ts` exporting `breakdownLogExport(input: unknown): SyntheticExport`, fully
validated by parsing against the real schema in its test.

**The 60 live rows are excluded from the export**: their live tickets already exist (the row carries its real
`ticketRef`), so the history export is the other 1,283 rows and the load test asserts `imported = 1,283`; the 60 are
left to their live tickets by construction, not by a silent skip.

**Ticket shape (settled against schema.ts):**

- `legacyId` = row id; `ref` = **`BD-9<srNo padded to 5>`** (BD-90001…BD-91357) — a collision-free synthetic band: the
  plant's live refs are BD-0001…BD-0151, and `advanceRefCounters` will raise the live counter to BD-91358 when the import
  commits; that consequence is recorded in the PR and the fragment, not hidden. (A 60-row overlap at srNo/refs is moot:
  those rows are not tickets in this export.)
- `entryType: 'pastBreakdown'`, `kind: 'stopped'`, `status: 'closed'`, `machineCode`, `problem`;
  `reportedAt` = the close minus the row's downtime (below); `state.closedAt` = the close; **`state.closeKind: 'report'`**
  (schema enum report|no_report|done, and every row has a report).
- **Events** (schema: down at seq 0; a close event needs `by` and payload `{kind}`): `[{type:'down', at: reportedAt,
by: reportedByPerson ?? the report's first doneBy person}, {type:'close', at: closedAt, by: the report's first doneBy
person, payload:{kind:'report'}}]`; the report's `submittedAt` equals the close time exactly (reconcile requires it).
- **Report**: `date` = the row's date converted DD-MM-YYYY → YYYY-MM-DD; `shiftCode` per the shift rule below;
  `downtimeMin` = row.downMin; `responseMin` = row.respMin when present (17 rows), else 0; `repairMin` = downMin −
  responseMin; `breakdownCategory` = the row's electMech or **null when blank** (11 rows; the column has no blank);
  `maintCode` = the row's code or null when blank; `doneBy` and `supportedBy` = the row's names split on commas and
  trimmed (both, not `[]`); `observedBy` = a canonical `observed_by` value or null (the typo variants
  operator/Opeartor/Opeator and the ~70 person names are normalized to the list's own value, else null — no silent
  guess); `spareUsed` = the spare text when present; `rootCause`/`handoverName` null; `submittedBy` = the first doneBy
  person.
- **Shift rule (settled against the seeded shifts):** the DB has TWO windows — 08:00–18:30 and 18:29–05:00 (`1` and `2`);
  the fixture also has `1ST` (24 rows), `2ND` (12) and `3` (2). Normalize 1ST→1, 2ND→2; **`3` is folded into `2`** (the
  night window — the platform's third choice has no seeded row; Q8 open, recorded). Place the ticket **ending inside
  the named shift's window on the row's plant date**: close = the row's date at the shift's start + 2 h (always inside
  both windows), reportedAt = close − downMin. Long downtimes then start outside the shift but end inside it — the only
  placement `validateLocal` accepts (it checks the close's window and `report.date = productionDate(close)`). The rows'
  downtime stays exact through the import's report overrides (imports/figures.ts:103-118); `closed_at` is therefore
  approximate and that is recorded.
- **Plant zone:** the import is given the tenant zone (`importBhavin` receives it); all timestamps are built in it.
- `storedFigures` = the figures `computeTicketFigures` would produce for that state/report (downtimeMin = downMin,
  responseMin, repairMin, the rest 0/null), so reconcile raises no override issue.
- Deterministic: no clock, no random, stable ordering; canonical JSON identical on a re-run.

**Files:** the module, `apps/server/src/seed/breakdown-log-export.test.ts` (new: parses against the schema; 1,283
tickets; the 60 live ids excluded; unique refs in the BD-9 band; the 5 unknown codes resolve through the synthetic map
and 4 blanks stay null; 1ST/2ND/3 folded; close inside the shift window; long downtimes placed; deterministic),
`changes/37c-breakdown-load.md`.
**Red / green:** red `pnpm exec vitest run apps/server/src/seed/breakdown-log-export.test.ts` (module absent); green the
same + `pnpm run typecheck && pnpm run lint`. **Budget note:** this is one coherent contract (the export shape) and will
exceed 150 lines like the plan said; filed as one packet under D31's work-unit rationale, recorded in the PR.

## Packet 37c-2 — the load and the ticket's clauses (verification packet, one PR, one writer)

**Kind: verification** — after 37c-1 the load path exists, so this packet's red is a deliberate mutation of the load
(dropping the `source_ref` or the alias resolution) failing the new test, not a missing feature; that mutation proof is
the packet's red evidence.

`apps/server/test/history-load.test.ts` against the seeded Postgres harness:

- imports the generated export: `stats.imported = 1,283, status 'done'`, 1,283 closed backfill tickets with a report
  each and `import_row.source_ref` = the row's legacy id; the 60 `bd_live_` rows are not in the export;
- **a re-import adds nothing** (`imported 0, skipped 1,343`; ticket and breakdown_report counts unchanged);
- **codes through the alias config**: the NI/FS/PP/UTI rows carry the aliased code; a blank stays null; an unseeded,
  un-aliased code is an import issue a person sees, never a silent drop;
- **history on the desk**: `GET /api/v1/tickets?from=<day>&to=<day>` for a history day returns the imported ticket(s)
  closed, channel `backfill`, projected as tickets (NOT `/state`, which lists only open + recent no-report tickets);
- **erasure**: erase a person named in the history and the erased name leaves the history ticket replies — the 07 path
  already scrubs `breakdown_report.problem/observed_by/corrective_action`, `ticket.problem`, `ticket_event` text and
  `import_row` payload (0009 migration); the fixture rows that name a person in free text are `bd_muxluadbgu3q0`
  (Person 89 in problem and corrective action) and `bd_live_mw04p03ydkz7j` (Person 84; a live row, not imported). The
  test erases a person linked to a history ticket and asserts the name is gone from both the reply and the free text.
- **Files:** `apps/server/test/history-load.test.ts` (new), the fragment; imports code only if the test proves a gap.
- **Red / green:** the mutation red above, then the file green + `pnpm exec vitest run apps/server/test/import-*.test.ts`.

## Rails

Red first (or the named mutation for the verification packet); never delete/skip/weaken a test; one writer per packet;
file ≤ 400, function ≤ 60; no new dependency; no real mapping invented as production truth (N12 recorded); no
irreversible action (tests and staging only). R2 (server data) → one fresh reviewer running the covering suite. Commit
locally, no push; report red, green, deviations.

## Acceptance

The synthetic 2026 log loads the 1,283 non-live rows once through the past-breakdown path with their source references
(the 60 live rows skipped, nothing double-counted); the desk list shows a history day; the five unknown legacy codes
resolve through the alias config (the real map is N12); erasing a leaver removes their name from the imported history.
