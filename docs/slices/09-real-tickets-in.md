# 09 — Real tickets in

Issue: [#87](https://github.com/nimishshah1989/argus/issues/87) · Blocked by: 07, 08 (merged) · Branch `claude/t09-real-tickets`.
One PR, body contains `Closes #87`. No table, no migration, no new npm dependency.

## 1. Goal

Uptimo holds Cosmos's 275 real tickets with Bhavin's exact numbers. Import and undo go through `tickets`.

## 2. What was measured first (prototype, 211 closed tickets, `worker.js` read line by line)

The domain's `figures()` and Bhavin's `worker.js` do **not** agree by rule. They agree only on waiting minutes (to ±1).

| Figure                          | `worker.js`                                                   | Domain `figures()`                    |
| ------------------------------- | ------------------------------------------------------------- | ------------------------------------- |
| Every elapsed minute            | `Math.round`                                                  | floor                                 |
| Repair                          | wall clock, first start to close (or to `running`)            | union of work segments                |
| Downtime, `support` / `general` | support 0; general = hands-on minutes                         | null                                  |
| `down_acc`                      | only completed stopped stretches (grows at `running`)         | includes the open stretch up to close |
| Hands-on                        | the lead's `segment` events only; crew segments are not added | union of all segments                 |

So recomputing with the domain cannot give "Bhavin's exact numbers". It is a product question, not an importer bug.

## 3. Decisions

1. **Store his numbers as recorded.** The nine figures on each imported ticket are the nine values in his export.
   Rejected: recompute with the domain (shifts figures on about 60% of closed tickets by rule, not by data).
2. **Prove them, do not trust them.** `real-oracle.ts` ports the `worker.js` arithmetic and recomputes each figure from the
   ticket's own events. A figure is _equal_ when oracle = stored. Otherwise the ticket has an `edit` event that changed
   that quantity (`/api/edit` writes minutes and times directly): the difference is _explained by the edit_ and listed with
   it. Anything else is _unexplained_. The import reports the three counts; the real file must give zero unexplained.
3. **His event names are kept.** `segment` events become `work_segment` rows (start = end − his minutes, end = the next
   pause, transfer, close, cancel or leave); `lead` and `task` stay events (`lead`, `task`). Free-text edit lines
   (`started @A > @B`, `work 6 > 46 min`) become typed `edit` changes.
4. **One door for writes.** `tickets.importTickets(tx, tenantId, rows)` is the only code that inserts imported tickets,
   events, crew, segments and reports; `imports` no longer lists ticket columns. `tickets.removeImported(tx, input)` is the only
   caller of the router-only `import_undo` definer function (D24, `p_tenant_id` and `p_operator`). `import_undo` moves to
   `tickets` in the manifest. The undo checks (status, completion fingerprint) stay in `imports`.
5. **The manifest exception ends.** `imports` no longer imports `accountability`. The SLA step after an import is passed in by
   the caller (`afterImport`); the CLI, which starts jobs, moves to `apps/server/src/seed/import-cli.ts` (the unit that may
   reach every module's index). `EXCEPTIONS` becomes empty.
6. **One ledger, two contracts.** The batch ledger, replay (same identity hash is skipped) and undo are shared by
   `argus.synthetic-bhavin/v1` and the new `argus.bhavin-export/v1` (D21 reuses them; the existing import and undo tests
   run unchanged).
7. **CI uses a pseudonymised copy.** `scripts/pseudonymise-export.ts` writes
   `apps/server/test/fixtures/bhavin-export.pseudonymised.json`: every person name and phone number in every field
   (including free text) becomes `Person NN` / `+9199999NNNNN`. Real files load only on staging.

## 4. Frozen interfaces

```ts
// modules/imports/bhavin-export.ts
export const REAL_SOURCE = 'argus.bhavin-export/v1';
export function looksLikeBhavinExport(input: unknown): boolean;
export function adaptBhavinExport(input: unknown): { tickets: unknown[] }; // strict ticket shape, one per real ticket
// modules/imports/real-oracle.ts
export interface FigureCheck {
  ref: string;
  figure: string;
  stored: number | null;
  oracle: number | null;
  verdict: 'equal' | 'edit' | 'unexplained';
  edit?: string;
}
export function checkTicketFigures(ticket: RealTicket): FigureCheck[];
// modules/tickets/index.ts
export function importTickets(
  tx: PoolClient,
  tenantId: string,
  rows: ImportedTicketRow[],
): Promise<string[]>;
export function removeImported(
  tx: PoolClient,
  input: { tenantId: string; batchId: string; operator: string },
): Promise<number>;
// modules/imports/bhavin.ts
export function importBhavin(
  pool,
  tenantId,
  input,
  options: { timeZone?: string; afterImport?: (client, tenantId) => Promise<void> },
): Promise<{ batchId: string; stats: ImportStats }>;
```

## 5. Tests (behaviour a caller can observe; each fails before the change)

1. `reads Bhavin's own field names` — the pseudonymised export imports 275 tickets, none errored; refs, kinds and statuses match.
2. `every figure equals his stored number, or an edit explains it` — stored figures on the imported tickets equal the export;
   the report has zero unexplained; every edit-explained figure names its edit.
3. `a figure that no edit explains is reported` — a planted wrong stored number is `unexplained` and the batch is `failed`.
4. `segment, lead and task events survive` — segments become work segments, `lead` and `task` events are kept in order.
5. `a re-run is identical` — second import of the same file changes nothing and returns the same counts.
6. `undo leaves no row` — after `removeImported` through the CLI path no ticket, event, crew, segment or report remains; the
   undone batch cannot run twice; another customer's batch is refused.
7. `the importer no longer reaches accountability` — `pnpm boundaries` is green with an empty `EXCEPTIONS`.
8. `pseudonymisation leaves no name or phone` — no known person name or digit run of 8+ in the committed copy.

## 6. As built, and the result on the real file

Deviations from the plan above, each on purpose:

- **A separate, lean real path.** The synthetic path demands that state, crew and segment times agree to the millisecond with the
  events. His events are stamped by the server when written, while his state holds the time the user picked, so the real export
  cannot pass those checks. The real path (`real-import.ts`, `real-rows.ts`, `real-events.ts`) reuses the batch ledger,
  fingerprint and undo, and skips the strict reducer. The synthetic path and its tests are unchanged apart from the manifest move.
- **Edit lines stay as notes** (`edit` events carry `{note}`), not typed changes. The oracle parses them; nothing else needs them typed.
- **The detection** of his export (`looksLikeBhavinExport`) is his shape: a non-empty `tickets` list whose rows have `downAt` and
  `events`. The synthetic contract and every other `source` still go to the synthetic parser, which refuses them.
- **Fifteen zero-minute stretches and one `correction` stretch** are not turned into work segments (nothing to hold; the correction
  only moved hands-on minutes, which are stored as recorded).
- **People** that match no active person become pending people (`ensurePendingPerson`), as for the synthetic path. His short names
  ("Asha K") will not match the 26 real full names on staging; an admin merges them.
- **Where `import_undo` lives:** `tickets` (manifest), reached only through `removeImported`.
- **The CLI** is `apps/server/src/seed/import-cli.ts` (`tools/import-bhavin.ts` imports it).

Result on the 13 November export (275 tickets, 1,153 events), run on the CI database seeded with the Cosmos plant:

| Figure checks (9 per ticket, closed-only ones skipped for open tickets) | 2,283 |
| ----------------------------------------------------------------------- | ----: |
| Equal: the oracle reproduces the stored number from the events          | 2,254 |
| Explained by an edit (all on one ticket, WR-0031)                       |     4 |
| Explained by the 6 Nov support-downtime rule change (23 tickets)        |    23 |
| Explained by half-minute timing (BD-0116, BD-0144 handover wait)        |     2 |
| **Unexplained**                                                         | **0** |

Imported: 275 tickets, 889 events, 250 work segments, 12 crew, 115 reports, 31 pending people; reference counters BD 170, WR 107.

## 7. Out of scope and follow-ups

- Changing the domain's rules to Bhavin's (a product decision; see the PR).
- `figures.drift` must skip tickets whose `raised_channel` is `import` or `backfill` (ticket 14), or it will flag every difference in §2.
- The staging load itself (ticket 14).

## 8. Questions for Nimish

1. Bhavin's repair, downtime for general and support tickets and rounding differ from what Uptimo's rules compute. Which wins for
   _new_ tickets: his, or ours? (Imported history keeps his numbers either way.)
