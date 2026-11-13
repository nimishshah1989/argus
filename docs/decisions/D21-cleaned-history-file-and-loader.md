# D21 — Cleaned history: one file contract, loaded by analytics

Date: 13 November 2026 · Status: proposed (architect); needs the architecture and schema reviews

## Context

BRIEF (13 Nov): a Claude session is used only to clean Cosmos's fuller history from Bhavin. A general import format for other plants waits for M5. D17 says old history lives as closed `ticket` rows, not in a `history_breakdown` table. ARCHITECTURE says the Breakdown Log is loaded by `analytics`, not by `imports`.

Two readings of "fuller history" exist. Both are handled:

- **More tickets in his app's export format.** Ticket 09's importer takes them unchanged. No session and no new code.
- **Anything else** (the Breakdown Log workbook, older registers). This record covers it.

## Decision

1. **`analytics` owns the contract, the check and the load.** The Claude session only produces a file. Code decides whether it is good.
2. **Contract:** `packages/shared/src/history-file.ts` exports `historyFileV1`, `peopleMapV1` and `historyQualityReportV1` (Zod). Each carries `v: 1`. A file with another `v` is refused.
3. **Rows land as closed tickets** through `tickets.importTickets(tx, rows)` on the past-breakdown path, with `raised_channel = 'backfill'` (no clocks). `analytics` writes no ticket table itself.
4. **One batch ledger and one undo.** `analytics` records the load through `imports`: `openBatch`, `recordRows`, `closeBatch`, `undoBatch`. The batch has `source = 'history'`. `import_batch.source` is free text today, so no migration.
5. **One transaction per load, all or nothing.** A second run of the same file (same SHA-256, kept in `import_batch.stats`) loads nothing and returns the first batch id.
6. **No schema change.** No new table and no new column.

## The file (`cleaned-history.v1.json`)

| Field                | Meaning                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v`, `kind`          | `1`, `'cleaned-history'`                                                                                                                                                                                                                                                                                                                       |
| `tenantSlug`         | Must equal the `--tenant` argument                                                                                                                                                                                                                                                                                                             |
| `timeZone`           | IANA name; must equal the tenant's                                                                                                                                                                                                                                                                                                             |
| `coverage`           | `{ from, to }` dates the sources claim to cover                                                                                                                                                                                                                                                                                                |
| `sources[]`          | `{ id, label, sha256 }` for each pseudonymised input file                                                                                                                                                                                                                                                                                      |
| `rows[]`             | `rowId` (unique in the file), `sourceId`, `sourceRow`, `machineCode`, `machineCodeVerbatim`, `startedAt`, `endedAt` (or null), `downtimeMin` (or null), `noDowntime`, `shift` (or null), `problem`, `action`, `rootCause`, `spare`, `category`, `code` (each text or null), `reportedBy` (token or null), `doneBy[]`, `supportedBy[]` (tokens) |
| People               | Tokens such as `P014` only. A real name or phone anywhere in the file fails the check                                                                                                                                                                                                                                                          |
| Times                | ISO 8601 with an offset. An empty value is null, never zero                                                                                                                                                                                                                                                                                    |
| Limits               | The size and row limits of `IMPORT_LIMITS`                                                                                                                                                                                                                                                                                                     |
| `people-map.v1.json` | `{ v: 1, tokens: { P014: name } }`. Written by `history:pseudonymise`. It stays on the operator's machine, is never committed, never given to the session, and is deleted after the production load                                                                                                                                            |

## The data-quality report (`historyQualityReportV1`)

`{ v, fileSha256, tenantSlug, generatedAt, coverage: { from, to, rows }, classes: { [class]: { count, rowIds } }, blocking }`. `rowIds` holds at most 20 examples. The report holds ids, counts and dates only: no names, no phones, no ticket text.

| Class                     | Meaning                                                                 | Effect           |
| ------------------------- | ----------------------------------------------------------------------- | ---------------- |
| `residual_personal_data`  | A name, username or phone from `identity.redactionTerms` is in the file | Blocks           |
| `unknown_machine`         | `machineCode` is not a machine of this plant                            | Blocks           |
| `duplicate_row`           | Same machine, start and end as another row in the file                  | Blocks           |
| `bad_interval`            | Ends before it starts, or lies in the future                            | Blocks           |
| `missing_required`        | No machine, no start, or no problem text                                | Blocks           |
| `possible_match`          | Might be the same breakdown as an existing ticket, not certain          | Blocks           |
| `machine_normalised`      | `machineCode` differs from `machineCodeVerbatim`                        | Needs `--accept` |
| `duration_mismatch`       | `downtimeMin` disagrees with its own times                              | Needs `--accept` |
| `outside_window`          | The row is outside `coverage`                                           | Needs `--accept` |
| `matches_existing_ticket` | Machine, date, shift and downtime agree with an existing ticket         | Skipped, counted |
| `unknown_code`            | `category` or `code` is not in the plant's lists; kept as written       | Reported         |
| `unknown_person`          | A token is missing from the map, or its name matches no person; no link | Reported         |

A blocked file loads nothing. `--accept` covers only the classes it names.

## Commands and functions

| Name                                                                                                               | What it does                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `history:pseudonymise <in-dir> --tenant <slug> --people-columns <list> --out <dir> --map <file>`                   | Copies `.xlsx`, `.csv` and `.json` files. Replaces every value in the named people columns, every term from `identity.redactionTerms` and every phone-shaped number with a token. Other file types are withheld and listed |
| `history:check <file> --tenant <slug>`                                                                             | Prints the report. Writes nothing. Exit code 1 when `blocking`                                                                                                                                                             |
| `history:load <file> --tenant <slug> --people-map <file> [--accept <classes>] [--production-confirm --grant <id>]` | Checks, then loads in one transaction. Prints `{ batchId, loaded, skipped }`                                                                                                                                               |
| `history:undo <batchId> --tenant <slug> [--production-confirm --grant <id>]`                                       | Removes that batch's tickets through `imports.undoBatch`                                                                                                                                                                   |
| `analytics.checkHistory(tx, file) → HistoryQualityReportV1`                                                        | Read-only                                                                                                                                                                                                                  |
| `analytics.loadHistory(tx, file, { peopleMap, accept, grantId? }) → { batchId, loaded, skipped, report }`          | The only writer. Links a person only when the mapped name matches an existing person exactly. Tokens inside free text become `[person]`                                                                                    |
| `imports.openBatch(tx, { source, fileSha256 }) → { batchId, alreadyLoaded }`                                       | New published function                                                                                                                                                                                                     |
| `imports.recordRows(tx, batchId, rows)`, `imports.closeBatch(tx, batchId, stats)`                                  | New published functions. A stored row holds the cleaned row with tokens, not names                                                                                                                                         |
| `imports.undoBatch(tx, batchId) → { deleted }`                                                                     | The function behind `import:undo` after ticket 09, published. It reads the batch's own source instead of assuming Bhavin's                                                                                                 |
| `imports.assertProductionAccess`, `imports.assertAppApiRole`                                                       | The existing CLI guards, published so the second CLI reuses them                                                                                                                                                           |
| `identity.redactionTerms(tx)`, `identity.activeGrant(tx, grantId)`                                                 | New reads (D22 for the first). `activeGrant` returns the grant only when it belongs to this tenant and has not expired                                                                                                     |

`analytics` may now call `identity` and `imports`. Neither calls `analytics`, so there is no cycle.

## Safety order for the Cosmos run

1. Cosmos's written consent is filed (N14). The session is Anthropic processing, so the same consent covers it.
2. `history:pseudonymise` runs on the operator's machine. The session sees only its output folder.
3. The session maps the files onto the contract and runs `history:check` against staging. It holds no production credential.
4. A person runs `history:load` on staging. Nimish spot-checks the history there.
5. A full database snapshot is taken. The same file is loaded on production under a `platform_access` grant approved by Cosmos's admin, valid 24 hours. The role is `app_api`, which cannot bypass row-level security. Every audit line carries the grant.
6. Roll back with `history:undo <batchId>`, or restore the snapshot.

## Regression risk

`imports.undoBatch` and the published guards touch ticket 09's files. Ticket 09's undo and replay tests run unchanged and must pass. New tests: given one Bhavin batch and one history batch for a tenant, when either is undone, then the other's tickets remain; given a history batch id of another tenant, when undo runs, then nothing is deleted.

## Rejected

- **A general import pack with `validatePack` and `commitPack` for machines, people and lists:** deferred to M5 by Nimish.
- **Loading history through `imports` alone:** the Breakdown Log, its count-once rule and its figures belong to `analytics`.
- **A second batch table or a `source_ref` column on `ticket`:** a second undo path beside the one ticket 07 protects, and a column on the busiest table.
- **Letting the session write to the database:** code is the gate.
- **Restoring every name at load:** only exact matches to existing people are linked, so no person record is made from old paper.
