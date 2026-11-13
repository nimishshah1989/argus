# 06 — Stop destroying history

Issue: [#84](https://github.com/nimishshah1989/argus/issues/84) · Milestone M0 · Blocked by: 03 (merged) ·
Branch `claude/t06-stop-destroying-history`. One PR, body contains `Closes #84`.

Labels the PR needs: `size:large` (the slice is large by **deletion** — about 1,500 removed lines of tag code and
tag tests against about 300 added; reason goes in the PR body) and `no-parity` (tags were never a parity row;
`docs/spec/parity.yaml` has no tag id, and no parity behaviour changes — checked).

**No schema change.** No migration, no new table, no new column, no index. `work_segment.end_reason`,
`list_item.active` and `login.disabled_at` all exist in `0001_schema_v1.sql` (lines 322, 171, 62). `ticket_tag`
stays in the database and keeps its rows; ticket 07 drops it. Nothing in this slice needs the architecture or
schema maker-checker.

## 1. Goal

Working a real ticket no longer destroys anything: pause, resume, transfer, leave and close keep every work
stretch row and stamp why it ended; a list entry or a login is switched off instead of deleted and still reads
back on old tickets; tags are gone from the code; and CI refuses a migration that drops, rewrites or revokes
anything without an approver and a backup reference.

## 2. Decisions (technical; made here so the coder never guesses)

1. **Segment persistence moves to its own file.** `apps/server/src/modules/tickets/repo/ticket.ts` is 375 lines
   against a 400-line budget, so `loadSegments` + `persistSegments` move to a new
   `apps/server/src/modules/tickets/repo/segments.ts` and `ticket.ts` re-exports them
   (`export { … } from './segments.js';`, the pattern it already uses for `./events.js`) and also imports
   `endReasonFor` and `persistSegments` locally for `persistResult`. Call sites keep using
   `sql.loadSegments` / `sql.persistSegments`. `repo/` is inside the module's repo folder, so
   `pnpm boundaries` is satisfied.
2. **`persistSegments` inserts and updates; it never deletes.** Algorithm, in one transaction:

   ```
   rows = SELECT id, person_id, role, started_at, ended_at FROM work_segment
          WHERE tenant_id = $1 AND ticket_id = $2 ORDER BY started_at, id
   if rows.length > input.segments.length → throw Error('work_segment rows would be lost')
   for i < rows.length:                            // the stretches that already exist
     guard rows[i].person_id/role === input.segments[i].personId/role and
       new Date(rows[i].started_at).getTime() === input.segments[i].startedAt.getTime()  (never Date ===)
       else throw Error('work_segment rows would be lost')
     if rows[i].ended_at === null && input.segments[i].endedAt:
       if input.endReason === null → throw Error('work_segment closed without an end reason')
       UPDATE work_segment SET ended_at = $1, end_reason = $2, updated_at = now() WHERE id = $3
   for i >= rows.length:                           // the stretches this command opened
     INSERT INTO work_segment (tenant_id, ticket_id, person_id, role, started_at, ended_at, end_reason)
   ```

   - `ended_at` and `end_reason` are stamped **once**, when the stretch closes. A later command never rewrites
     a closed stretch: that is the "do not rewrite history" half of the rule.
   - The positional match is sound because every domain command either maps the segment list in place or
     appends to it, and nothing removes or reorders it (checked: `start`, `resume`, `restore`, `join` append;
     `pause`, `transfer`, `close`, `cancel` use `closeSegments`, `leave` maps; `correct`, `update`,
     `late-report`, `machine-running`, `machine-stopped`, `upgrade-kind` pass through). `ORDER BY started_at, id`
     is added to **both** `loadSegments` and the new SELECT so the two queries agree inside one transaction.
   - The two guards turn any future reordering or shortening into a failed command (rollback) instead of lost
     rows. They are reachable only by calling the repo directly, which test 4 does.

3. **The end reason comes from the command, not from the domain.** `packages/domain` is **not** changed:
   `WorkSegment` gains no `endReason` field. `endReasonFor(action)` maps `CommandAction` →
   `work_segment.end_reason`: `pause → 'pause'`, `transfer → 'transfer'`, `leave → 'leave'`,
   `close → 'close'`, `cancel → 'cancel'`; every other action returns `null`. Those five are exactly the
   values the column's CHECK allows and exactly the actions whose transitions close a stretch, so the domain
   stays pure and the slice stays small (LEAN rung 1). `/api/v1/tickets` (raise) passes `endReason: null`; a
   self-started raise only inserts.
4. **The list route switches an entry off.** `DELETE /api/v1/lists/:list/:id` keeps its method and path (no
   client changes, no new route) and `removeListItem` becomes `deactivateListItem`:
   `UPDATE list_item SET active = false, updated_at = now() WHERE id = $1`. Scoping stays "by id" exactly as
   today (RLS confines it to the tenant); the `:list` param stays unused, as today.
   - **Old tickets still read back.** `loadPlantRows` selects every `list_item` row with its `active` flag and
     `/api/v1/config` returns inactive entries too; `TicketDetail.tsx:113-114` builds `reasonLabels` from all
     of `config.lists.wait_reason`, while pickers (`ActionForm.tsx:32`, `reportFields.tsx:136`,
     `ReportForm.tsx:116`) filter `active !== false`. So switching off removes the entry from pickers and keeps
     its label on history, with no code change. Test 5 proves it.
   - The old hard delete also cascaded `list_item → ticket_tag` (`0005_ticket_tag.sql:19-20`), destroying tag
     history; switching off ends that too.
5. **No code path deletes a login or a person, today or after this slice** (verified:
   `grep -rn "DELETE FROM" apps/server/src` returns `tenant` (seed), `push_subscription`, `list_item`,
   `work_segment`, `ticket_tag`, and `ticket`/`breakdown_report` inside import undo). So goal 1's login half is
   **not a code change**: it is a fact to prove and to keep. No login route is added. Test 8 proves a
   switched-off login (`disabled_at`) is refused at sign-in while its row, its person and its work stretches
   stay and still render on an old ticket; test 11 is the static guard that keeps the rule.
   - `deleteTenantBySlug` (`modules/identity/repo.ts:143`, used only by the Cosmos seed) and
     `deleteImportedTickets` (`modules/tickets/repo/imported.ts`) stay untouched: both are ticket 07's
     definer-function territory (ARCHITECTURE §9 items 21 and 33).
6. **Historical tag events keep rendering.** `tag_add` / `tag_remove` stay in `EventType`
   (`packages/domain/src/types.ts`), in `Timeline.tsx`'s `LABEL_KEYS` and as the two `timeline.tag*` keys in
   `apps/web/src/i18n/en.ts`, with a comment that nothing writes them any more. Reason: `ticket_event` rows are
   history that ticket 07 makes un-deletable and un-editable, so a tag event lives forever; dropping its label
   would print the raw string `tag_add` on a real timeline. Everything that _writes_ or _offers_ tags goes.
   This is the only tag string that survives, and `ticket_event.type` has no CHECK constraint, so nothing else
   is involved. Test 9 proves a legacy event still comes back from the API.
7. **`ticket_tag` keeps its owner in the manifest.** `OWNERS.tickets` still lists `ticket_tag`
   (`apps/server/src/modules/manifest.ts:34`) because the table still exists until ticket 07, and ownership is
   what would stop a stray new query from naming it outside `tickets/repo/`. `tools/check-boundaries.ts` never
   requires an owned table to be referenced (checked), so nothing fails, and
   `tools/boundaries.test.ts`'s 29-table list and `packages/db/test/isolation.test.ts`'s
   `DATED_TABLES` both stay exactly as they are.
8. **Dead plant reads go with the tags.** `listItemsOf`, `listItemOf` and `listItemsByIds`
   (`modules/plant/repo/reads.ts`) have exactly one caller, `tickets/repo/tags.ts` (checked), so they are
   deleted with it, along with their three lines in `modules/plant/index.ts`. `listItem`, `activeListItems` and
   the rest stay.
9. **The migration guard becomes three small pure functions** in `tools/check-migrations.ts`, so a test can
   plant a file (§4). Rules, matched **anywhere** in the file after comments are blanked out (the current
   regex is anchored at line start, which is ARCHITECTURE §9 item 22's bug — `ALTER TABLE x DROP COLUMN y`
   passes today):

   | Rule           | Pattern (case-insensitive)                                                    | Covers                                                           |
   | -------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------- |
   | `DROP`         | `/\bdrop\b/`                                                                  | `DROP TABLE`, `DROP COLUMN`, `DROP CONSTRAINT`, `DROP POLICY`, … |
   | `UPDATE`       | `/\bupdate\s+(?:only\s+)?[\w."$]+\s+(?:(?:as\s+)?[\w$]+\s+)?set\b/`           | a data `UPDATE … SET`, including inside `DO $$ … $$`             |
   | `TRUNCATE`     | `/\btruncate\b/`                                                              | kept from today                                                  |
   | `DELETE FROM`  | `/\bdelete\s+from\b/`                                                         | kept from today                                                  |
   | `SET NOT NULL` | `/\bset\s+not\s+null\b/`                                                      |                                                                  |
   | `ALTER TYPE`   | `/\balter\s+(?:type\b\|(?:column\s+)?"?[\w$]+"?\s+(?:set\s+data\s+)?type\b)/` | `ALTER COLUMN x TYPE`, `SET DATA TYPE`, `ALTER TYPE`             |
   | `REVOKE`       | `/\brevoke\b/`                                                                |                                                                  |

   The `UPDATE` pattern deliberately requires a following `SET`, so `GRANT SELECT, INSERT, UPDATE …`,
   `REVOKE UPDATE …`, `ON UPDATE CASCADE`, `BEFORE INSERT OR UPDATE OF …` and an `updated_at` column are not
   false positives (all four forms exist in the merged files). No pattern can span a `;`, because none of them
   match a semicolon.

10. **Approval lives in the file header.** A file with any finding passes only if its **leading comment block**
    (the blank and `--` lines before the first SQL line) contains both `-- approved-by: <text>` and
    `-- backup: <text>` with non-empty text. Markers below the SQL do not count. This replaces the old
    `-- destructive-approved` marker (`packages/db/README.md:44` is updated; no other document names it —
    checked).
11. **The seven merged files are named, dated exceptions** in the tool, with their merge dates from git:
    `0001_schema_v1.sql` (2026-11-10), `0002_app_api_role.sql` (2026-11-10),
    `0003_command_idempotency_binding.sql` (2026-11-10), `0004_cancel_time.sql` (2026-11-11),
    `0005_ticket_tag.sql` (2026-11-11), `0006_severity_matrix.sql` (2026-11-12),
    `0007_sla_policy_timer.sql` (2026-11-12) — each with the reason `predates the rule`. Test 17 asserts the
    list is **exactly** those seven, so an eighth file cannot be waived (ARCHITECTURE §9 item 22).
12. **One PR.** The three goals are one vertical slice: they are the same rule (stop losing history) at the
    three places the architecture names, and goals 1 and 3 together are the prefactor ticket 07 builds on.
    Nothing here is usable on its own half.

## 3. Files

### Changed

| File                                               | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/server/src/modules/tickets/repo/segments.ts` | **New.** `SegmentEndReason`, `endReasonFor`, `loadSegments` (moved, `ORDER BY started_at, id`) and the rewritten `persistSegments` (decisions 1–3). Under 90 lines.                                                                                                                                                                                                                                                                                       |
| `apps/server/src/modules/tickets/repo/ticket.ts`   | Delete `loadSegments` and the old `persistSegments`; add `export { endReasonFor, loadSegments, persistSegments, type SegmentEndReason } from './segments.js';` and a local `import { endReasonFor, persistSegments } from './segments.js';`. `persistResult` passes `{ segments: result.segments, endReason: endReasonFor(tx.action) }`.                                                                                                                  |
| `apps/server/src/modules/tickets/routes.ts`        | The raise call becomes `sql.persistSegments(client, tx.tenantId, raised.ticket.id, { segments: raised.segments, endReason: null })` (line 267; written as `{ ...raised, endReason: null }` to keep `executeRaise` within the 60-line budget). Delete nothing else.                                                                                                                                                                                        |
| `apps/server/src/modules/tickets/index.ts`         | Delete the `registerTags` import and its call inside `register`. Published exports unchanged.                                                                                                                                                                                                                                                                                                                                                             |
| `apps/server/src/modules/plant/repo/config.ts`     | `removeListItem` → `deactivateListItem` with the `UPDATE … SET active = false, updated_at = now()` (decision 4).                                                                                                                                                                                                                                                                                                                                          |
| `apps/server/src/modules/plant/repo/reads.ts`      | Delete `listItemsOf`, `listItemOf`, `listItemsByIds` (decision 8).                                                                                                                                                                                                                                                                                                                                                                                        |
| `apps/server/src/modules/plant/index.ts`           | Delete those three names from the export list.                                                                                                                                                                                                                                                                                                                                                                                                            |
| `apps/server/src/modules/plant/routes.ts`          | `deleteListItem` imports and calls `deactivateListItem`; its name and the route registration do not change.                                                                                                                                                                                                                                                                                                                                               |
| `packages/shared/src/index.ts`                     | Delete `export * from './tags.js';` and `export * from './tag-schema.js';`.                                                                                                                                                                                                                                                                                                                                                                               |
| `packages/domain/src/types.ts`                     | Keep `tag_add` / `tag_remove`; add one comment line: history only, never written (decision 6).                                                                                                                                                                                                                                                                                                                                                            |
| `apps/web/src/screens/TicketDetail.tsx`            | Delete the `TagsPanel` import (line 26) and the `<TagsPanel … />` element (line 147).                                                                                                                                                                                                                                                                                                                                                                     |
| `apps/web/src/api.ts`                              | Delete the `TagDefinition`/`TagList` import (line 3), the type re-export (line 183) and `getTagCatalogue`, `getTicketTags`, `addTicketTag`, `removeTicketTag` (lines 185–206).                                                                                                                                                                                                                                                                            |
| `apps/web/src/i18n/en.ts`                          | Delete the seven `tags.*` keys (lines 370–376). Keep `timeline.tagAdd` / `timeline.tagRemove`. `gu.ts` derives its keys from `en`, so it is not touched; nothing else in the catalogues changes (ticket 05 owns them).                                                                                                                                                                                                                                    |
| `apps/web/e2e/fixtures.ts`                         | `machineFor(suite: 'floor' \| 'desk', …)`: drop the `'tags'` arm (index becomes `suite === 'floor' ? 0 : 2`) and fix the comment on line 46. `raiseTicketViaApi(token, machineId: string, problem)`: drop the `machineId === null` general-request branch and the `workType: 'Tag test'` literal — the tag spec was its only caller (checked). `MACHINES` is unchanged: `settings-severity.spec.ts` uses entries 4–5 and `board`/`sla` index by position. |
| `tools/check-migrations.ts`                        | Rewritten as `guardedStatements`, `hasApproval`, `scanMigrations`, `EXCEPTIONS` + `main` (decisions 9–11). `main` is guarded by `if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();` (as in `check-boundaries.ts`), prints `migrations: N files, M findings` and exits 1 on any finding. Comments blank `--` to end of line only (strings not parsed), replaced by spaces so line numbers hold. Under 110 lines.                  |
| `packages/db/README.md`                            | The migration-rules bullet names `-- approved-by:` and `-- backup:` instead of `-- destructive-approved`, and says the seven merged files are dated exceptions.                                                                                                                                                                                                                                                                                           |
| `apps/server/test/tickets-commands.test.ts`        | Seed gains machines `VC-17`..`VC-20` (UUIDs `…1c`..`…1f`) and a second wait reason `vendor`; new `describe('history is kept')` at the end of the file with tests 1–5 (6–7 dropped, not asked).                                                                                                                                                                                                                                                            |
| `apps/server/test/tickets.test.ts`                 | Seed gains machines `VC-5` (`MACHINE_DISABLED`) and `VC-6` (`MACHINE_LEGACY`); tests 8–10, appended as a new describe at the end of the file. Tests 8–10 are regression guards that pass today.                                                                                                                                                                                                                                                           |
| `apps/server/test/guard.test.ts`                   | Delete `'GET /api/v1/tags'` from the expected route list (line 61); add test 13.                                                                                                                                                                                                                                                                                                                                                                          |
| `apps/server/test/history-guard.test.ts`           | **New**, no database: tests 11–12.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `tools/migrations.test.ts`                         | **New**: tests 14–17.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `changes/84-stop-destroying-history.md`            | **New**, one fragment (§7).                                                                                                                                                                                                                                                                                                                                                                                                                               |

### Deleted

| File                                           | Why                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/server/src/modules/tickets/tags.ts`      | The four tag routes (goal 2).                                                                                                                                                                                                                                                                                             |
| `apps/server/src/modules/tickets/repo/tags.ts` | The only code that writes `ticket_tag` (goal 2).                                                                                                                                                                                                                                                                          |
| `packages/shared/src/tags.ts`                  | `TAG_CATEGORIES`, `TagDefinition`, `TicketTag`, `TagList`, `isTagCategory` — no other importer (checked).                                                                                                                                                                                                                 |
| `packages/shared/src/tag-schema.ts`            | `tagApplySchema`, `ticketIdSchema` — used only by the deleted routes (checked).                                                                                                                                                                                                                                           |
| `apps/web/src/components/tags/TagPill.tsx`     | The tag screen (goal 2).                                                                                                                                                                                                                                                                                                  |
| `apps/web/src/components/tags/TagSelector.tsx` | The tag screen.                                                                                                                                                                                                                                                                                                           |
| `apps/web/src/components/tags/TagsPanel.tsx`   | The tag screen.                                                                                                                                                                                                                                                                                                           |
| `apps/web/src/components/tags/logic.ts`        | Tag grouping.                                                                                                                                                                                                                                                                                                             |
| `apps/web/src/components/tags/logic.test.ts`   | **Test removed with its feature**: it unit-tests `groupByCategory` in the deleted `logic.ts`. Nothing else it asserts survives.                                                                                                                                                                                           |
| `apps/server/test/tags.test.ts`                | **Test removed with its feature**: all 527 lines exercise `/api/v1/tags*` and `/api/v1/tickets/:id/tags*`, which no longer exist. Its idempotency, permission and tenancy assertions are duplicated for the remaining commands in `idempotency.test.ts`, `tickets.test.ts` and `rls.test.ts`, so no coverage is weakened. |
| `apps/web/e2e/tags.spec.ts`                    | **Test removed with its feature**: the tag panel journey (including its axe run) is gone from the product. The remaining axe coverage of `TicketDetail` is `apps/web/e2e/desk.spec.ts` plus the gallery spec.                                                                                                             |

### Deliberately **not** touched (checked, each for a reason)

- `packages/db/migrations/*` — no migration in this slice; the seven files are immutable.
- `packages/db/test/isolation.test.ts` — `DATED_TABLES` must not change, and its `ticket_tag` case (lines
  269–285) exercises the still-existing table with raw SQL, needing no tag code. ARCHITECTURE §9 item 21
  replaces that case in **ticket 07**, when login/person deletes become RESTRICT; it stays true today.
- `packages/db/test/seed.sql`, `packages/db/test/migration-runner.test.ts`,
  `packages/db/test/severity-migration.test.ts`, `packages/db/test/sla-migration*.test.ts` — they name the
  table or the file `0005_ticket_tag.sql` at the database level, not through code.
- `apps/server/test/import-undo.test.ts` — case `T21` writes `ticket_tag` with raw admin SQL and asserts the
  ticket cascade; the table and the cascade both still exist, and the test needs no tag code, so it stays
  unchanged.
- `tools/boundaries.test.ts` (29-table list) and `apps/server/src/modules/manifest.ts` `OWNERS` — decision 7.
- `apps/web/src/components/actions.ts`, `apps/web/src/i18n/gu.ts` and the rest of the catalogues (ticket 05
  runs in parallel), `tools/pii-*`, `tools/check-pii.ts`.
- `apps/web/src/api-types.ts` line 75 (`tag: string | null`), `packages/shared/src/config.ts` line 50 and
  `modules/plant/service.ts` line 40 — that is `list_item.tag`, a free-text attribute on a list entry, **not** a
  ticket tag.
- `apps/web/src/ui/icon.ts` and `apps/web/src/ui/status/ticket.ts` — inspected: their only "tag" match is the
  `OctagonX` icon name. Nothing to do.
- `apps/server/src/modules/tickets/repo/imported.ts`, `modules/imports/*` — `end_reason` is already written
  there; import undo is ticket 07.

## 4. Interfaces

```ts
// apps/server/src/modules/tickets/repo/segments.ts (new)
import type { PoolClient } from 'pg';
import type { WorkSegment } from '@uptimo/domain';
import type { CommandAction } from '../mapper.js';

export type SegmentEndReason = 'pause' | 'transfer' | 'leave' | 'close' | 'cancel';

/** Why a command closes an open stretch; null for the commands that close none. */
export function endReasonFor(action: CommandAction): SegmentEndReason | null;

/** Ordered by (started_at, id) so persistSegments can line its rows up with the domain list. */
export function loadSegments(client: PoolClient, ticketId: string): Promise<WorkSegment[]>;

export interface SegmentWrite {
  segments: WorkSegment[];
  endReason: SegmentEndReason | null;
}

/** Inserts new stretches and stamps ended_at/end_reason by id. Never deletes (decision 2). */
export function persistSegments(
  client: PoolClient,
  tenantId: string,
  ticketId: string,
  input: SegmentWrite,
): Promise<void>;
```

```ts
// apps/server/src/modules/plant/repo/config.ts
/** Switches a list entry off; the row, its labels and every history reference stay. */
export function deactivateListItem(tx: Db, id: string): Promise<void>;
// removeListItem is gone. Route DELETE /api/v1/lists/:list/:id is unchanged: 200 {ok: true},
// 403 'forbidden' for a non-admin, 401 without a session.
```

```ts
// tools/check-migrations.ts
export type RuleName =
  'DROP' | 'UPDATE' | 'TRUNCATE' | 'DELETE FROM' | 'SET NOT NULL' | 'ALTER TYPE' | 'REVOKE';

export interface Finding {
  rule: RuleName;
  line: number;
}

export interface MigrationException {
  file: string;
  merged: string;
  reason: string;
}
/** The seven files merged before this rule; no later file may be added (ARCHITECTURE §9 item 22). */
export const EXCEPTIONS: readonly MigrationException[];

/** Every guarded statement in one file's SQL, comments blanked out, line numbers 1-based. */
export function guardedStatements(sql: string): Finding[];

/** True when the leading comment block carries both `-- approved-by:` and `-- backup:` with text. */
export function hasApproval(sql: string): boolean;

/** One message per unapproved finding, skipping EXCEPTIONS by file name. No SQL text in a message:
 *  `migrations: <file>:<line>: <rule> needs '-- approved-by:' and '-- backup:' in the file header` */
export function scanMigrations(dir?: string): string[];
```

**Removed interfaces** (goal 2): routes `GET /api/v1/tags`, `GET /api/v1/tags/:category`,
`GET /api/v1/tickets/:id/tags`, `POST /api/v1/tickets/:id/tags`, `DELETE /api/v1/tickets/:id/tags/:tagId`;
server `registerTags`, `listCatalogue`, `ticketExists`, `findDefinition`, `loadTicketTags`, `addAssignment`,
`removeAssignment`, `appendTagEvent`; shared `TAG_CATEGORIES`, `TagCategory`, `TagDefinition`, `TicketTag`,
`TagList`, `isTagCategory`, `tagApplySchema`, `TagApplyBody`, `ticketIdSchema`; web `getTagCatalogue`,
`getTicketTags`, `addTicketTag`, `removeTicketTag`, `TagsPanel`, `TagSelector`, `TagPill`, `TagList`,
`groupByCategory`, `TagGroup`; plant `listItemsOf`, `listItemOf`, `listItemsByIds`. No reply part of any
surviving route changes.

## 5. Data (existing columns only — no schema change)

| Field                      | Type                                               | Where                  | This slice                                                                                   |
| -------------------------- | -------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------- |
| `work_segment.id`          | uuid                                               | `packages/db` 0001:315 | **read** (to update by id); never deleted                                                    |
| `work_segment.tenant_id`   | uuid                                               | 0001:316               | read in the WHERE, written on insert                                                         |
| `work_segment.ticket_id`   | uuid                                               | 0001:317               | read in the WHERE, written on insert                                                         |
| `work_segment.person_id`   | uuid                                               | 0001:318               | read (guard), written on insert                                                              |
| `work_segment.role`        | text `lead\|primary\|support`                      | 0001:319               | read (guard), written on insert                                                              |
| `work_segment.started_at`  | timestamptz                                        | 0001:320               | read (guard), written on insert; never updated                                               |
| `work_segment.ended_at`    | timestamptz, nullable                              | 0001:321               | **written once**, by id, when the stretch closes                                             |
| `work_segment.end_reason`  | text CHECK `pause\|transfer\|leave\|close\|cancel` | 0001:322               | **written once**, with `ended_at` (new behaviour: nothing wrote it before)                   |
| `work_segment.updated_at`  | timestamptz                                        | 0001:324               | `now()` on that update                                                                       |
| `list_item.active`         | boolean NOT NULL DEFAULT true                      | 0001:171               | **written false** instead of deleting the row                                                |
| `list_item.updated_at`     | timestamptz                                        | 0001:176               | `now()` on that update                                                                       |
| `list_item.label/_gu/_hi`  | text                                               | 0001:167-169           | read by `/config` for inactive rows too (how old tickets keep their labels)                  |
| `list_item.tag`            | text                                               | 0001:174               | untouched (a list attribute, not a ticket tag)                                               |
| `login.disabled_at`        | timestamptz, nullable                              | 0001:62                | read by sign-in (`identity/routes.ts:58`); written by no code, as today                      |
| `person.active`, `.name`   | boolean, text                                      | 0001:37, 43            | read only (names on old tickets)                                                             |
| `ticket_event.type`        | text, no CHECK                                     | 0001:287               | read; legacy `tag_add`/`tag_remove` rows still project (decision 6)                          |
| `ticket_tag` (all columns) | —                                                  | 0005                   | **neither read nor written by any code** after this slice; table and rows stay for ticket 07 |

## 6. Test cases

Every test is Given / When / Then. Tests **1, 2, 3, 4, 5, 11, 12, 14, 15, 17 fail before the change** — they are the
reproduction of the four faults ARCHITECTURE §9 items 21 and 22 name.

### Goal 1 — work stretches · `apps/server/test/tickets-commands.test.ts`

New `describe('history is kept')` in the existing file (one container, existing `post`/`get`/`login` helpers,
`ASHA`/`BINA`/admin tokens, wait reason `spare`). Seed additions: machines `VC-17` `MACHINE_SEGMENTS`,
`VC-18` `MACHINE_REVOKED`, `VC-19` `MACHINE_WAITING`, `VC-20` `MACHINE_GUARD`.

1. **`keeps every work_segment id through pause and resume`**
   - **Given** a ticket raised on `VC-17` and started by Asha, whose single `work_segment` row id and
     `started_at` are read with `db.admin`.
   - **When** it is paused with reason `spare` and then resumed by Asha.
   - **Then** that first row still exists with the same `id` and `started_at`, has `ended_at` non-null and
     `end_reason = 'pause'`; there are exactly **two** rows for the ticket; the second is Asha's, `role = 'lead'`,
     `ended_at` null, `end_reason` null; and `figures.perPerson` in the resume reply has exactly one key, Asha.
2. **`stamps the end reason of transfer, leave and close in place`**
   - **Given** the same ticket (its id is held in a file-level variable that test 1 sets, the way
     `cancelledTicketId` already works in this file), now working, with Bina joined as `support` and every row
     id collected.
   - **When** Bina leaves, then Asha transfers, then Asha starts again and closes with `kind: 'report'`.
   - **Then** no id from the collected set is missing; Bina's stretch has `end_reason = 'leave'`; the stretch
     open at the transfer has `end_reason = 'transfer'`; the stretch open at the close has `end_reason = 'close'`;
     every row has a non-null `ended_at`; and the count of rows only ever grew during the test.
3. **`runs the lifecycle with DELETE on work_segment revoked`**
   - **Given** `REVOKE DELETE ON work_segment FROM app_user` (as `db.admin`, restored with
     `GRANT DELETE …` in a `finally`), which is the grant ticket 07 makes permanent.
   - **When** a ticket on `VC-18` is raised, started, joined by Bina, left by Bina, paused, resumed, transferred, picked up, cancelled, restored and closed.
   - **Then** every command answers 200/201 and the ticket's stretches are all present with their end reasons.
4. **`refuses to persist fewer stretches than the ticket has`** (repo level, importing
   `persistSegments`/`loadSegments` from `../src/modules/tickets/repo/segments.js`, like `plant-repo.test.ts`
   imports a repo)
   - **Given** the multi-stretch ticket from tests 1–2.
   - **When** `persistSegments` is called inside `withTenant(db.app, …)` with only the first stretch.
   - **Then** it rejects with `/work_segment rows would be lost/` and every row is still there.
   - **And given** its own ticket on `VC-20` (`MACHINE_GUARD`), raised and started (one open stretch),
   - **when** `persistSegments` is called with that stretch marked `endedAt` but `endReason: null`,
   - **then** it rejects with `/without an end reason/` and that row is still open.

### Goal 1 — list entries · same file

5. **`switches a list entry off instead of deleting it, and old tickets still resolve its label`**
   - **Given** a ticket on `VC-19` paused with reason `spare`, and the `list_item` id of `spare`.
   - **When** the admin calls `DELETE /api/v1/lists/wait_reason/<id>`.
   - **Then** the answer is 200 `{ok: true}`; the row still exists with `active = false` and its label
     unchanged; `GET /api/v1/config` still returns the entry in `lists.wait_reason` with `active: false`; and
     `GET /api/v1/tickets/<id>` still reports `waitReason: 'spare'`.
     Tests 6 and 7 of the first draft (non-admin and unauthenticated switch-off) are dropped: not asked.

### Goal 1 — logins · `apps/server/test/tickets.test.ts`

Seed addition: machine `VC-5` `MACHINE_DISABLED`.

8. **`keeps a switched-off login and its work on old tickets`**
   - **Given** a ticket on `VC-5` raised and started by Bina (so she has a `work_segment` row and a `start`
     event), with `UPDATE login SET disabled_at = now() WHERE id = LOGIN_BINA` as `db.admin`
     (reset to `NULL` in a `finally`; no route does this and none is added — decision 5).
   - **When** Bina tries to sign in, and Asha reads `GET /api/v1/tickets/<id>` and `GET /api/v1/config`.
   - **Then** the sign-in answers 401 `unauthenticated`; the `login` row and Bina's `person` row both still
     exist; her `work_segment` row is still there; the detail's `intervals` and `events` still carry her
     `personId`; and `/config` `people` still carries her name.

### Goal 2 — tags are gone

Tests 8–10 are regression guards: they pass today and must keep passing. Test 11–13 are the new red/green ones.

9. **`still returns a legacy tag event in the timeline`** · `apps/server/test/tickets.test.ts`
   - **Given** a ticket with events, and a row inserted straight into `ticket_event`
     (`type = 'tag_add'`, `seq = last_event_seq + 1`, payload `{"code":"M"}`) with `ticket.last_event_seq`
     bumped to match — a ticket that carried tags before they were removed.
   - **When** `GET /api/v1/tickets/<id>` is read.
   - **Then** the answer is 200 and `events` contains an entry with `type: 'tag_add'`.
10. **`answers 404 on the removed tag routes`** · `apps/server/test/tickets.test.ts`
    - **Given** Asha's token and an existing ticket.
    - **When** `GET /api/v1/tags`, `GET /api/v1/tickets/<id>/tags`, `POST /api/v1/tickets/<id>/tags` and
      `DELETE /api/v1/tickets/<id>/tags/<uuid>` are called.
    - **Then** each answers 404.
11. **`no server SQL deletes a work segment, list entry, login, person or ticket event`** ·
    `apps/server/test/history-guard.test.ts` (new, reads `apps/server/src/**/*.ts` from disk, no database)
    - **Given** every file under `apps/server/src`.
    - **When** each is matched against `/delete\s+from\s+(work_segment|list_item|login|person|ticket_event)\b/i`.
    - **Then** the list of offending `file:line` entries is `[]`. (Today it is two: `repo/ticket.ts` and
      `plant/repo/config.ts`.) `ticket`, `breakdown_report`, `tenant`, `session`, `push_subscription` and
      `command_idempotency` are **not** in the pattern: import undo and the seed are ticket 07's definer
      functions.
12. **`no server SQL names ticket_tag`** · same file
    - **Given** the same files, excluding `apps/server/src/modules/manifest.ts` (ownership of the table ticket
      07 drops — decision 7).
    - **When** each is searched for `ticket_tag`.
    - **Then** the offending list is `[]`.
13. **`registers no tag route`** · `apps/server/test/guard.test.ts`
    - **Given** the built app's `routeTable`.
    - **When** the urls are filtered for `/tags`.
    - **Then** the result is `[]`. (The existing route-table test loses its `'GET /api/v1/tags'` line.)

### Goal 3 — the migration check · `tools/migrations.test.ts` (new)

14. **`catches each guarded statement anywhere in a statement`**
    - **Given** one planted statement per rule, each mid-statement and none at line start:
      `ALTER TABLE ticket DROP COLUMN urgent;` · `ALTER TABLE x DROP CONSTRAINT x_key;` ·
      `  UPDATE ticket SET severity = 'S4';` · `ALTER TABLE ticket ALTER COLUMN severity SET NOT NULL;` ·
      `ALTER TABLE ticket ALTER COLUMN note TYPE text;` · `REVOKE DELETE ON ticket FROM app_user;` ·
      `TRUNCATE ticket;` · `DELETE FROM ticket WHERE id = '…';`
    - **When** `guardedStatements` reads each, and `scanMigrations` reads an `mkdtemp` directory holding the
      first of them as `0008_planted.sql`.
    - **Then** each returns its rule (`DROP`, `DROP`, `UPDATE`, `SET NOT NULL`, `ALTER TYPE`, `REVOKE`,
      `TRUNCATE`, `DELETE FROM`) with the right line number, and `scanMigrations` returns exactly
      `["migrations: 0008_planted.sql:1: DROP needs '-- approved-by:' and '-- backup:' in the file header"]`.
      (Today's regex misses all but the last two: it is anchored at line start.)
15. **`passes an approved header and fails a half or misplaced one`**
    - **Given** the planted `DROP COLUMN` file with the header
      `-- approved-by: agent-reviewer` + `-- backup: s3://uptimo-backups/pre-0008` above the SQL.
    - **When** `scanMigrations` reads that directory.
    - **Then** it returns `[]`.
    - **And** with only `-- approved-by:`, only `-- backup:`, an empty value after either marker, or both
      markers written **below** the SQL, it returns the finding again (four cases).
16. **`leaves benign grants, column defaults and comments alone`**
    - **Given** a planted file with `CREATE TABLE t (updated_at timestamptz NOT NULL DEFAULT now(), ref uuid
REFERENCES ticket(id) ON DELETE SET NULL ON UPDATE CASCADE);`,
      `GRANT SELECT, INSERT, UPDATE, DELETE ON t TO app_user;`,
      `CREATE TRIGGER x BEFORE INSERT OR UPDATE OF ref ON t …;` and the comment `-- we will drop t later`.
    - **When** `guardedStatements` reads it.
    - **Then** it returns `[]`.
17. **`skips the seven dated exceptions by name and passes the merged migrations`**
    - **Given** `EXCEPTIONS` and `packages/db/migrations`.
    - **When** the list is read and `scanMigrations()` runs over the real directory.
    - **Then** `EXCEPTIONS.map(e => e.file)` equals exactly the seven file names in order, every entry has a
      `merged` date of the form `YYYY-MM-DD` and a non-empty reason, and `scanMigrations()` returns `[]`
      (today it returns `[]` only because the rules are too narrow — this test is what stops an eighth file
      from being waived).
    - **And** a file named `0005_ticket_tag.sql` planted in an `mkdtemp` directory with an unapproved
      `DROP TABLE` is skipped (exceptions are by name), while the same content as `0008_planted.sql` is caught.

### Gates

`pnpm verify` green, `pnpm boundaries`, `pnpm migrations:check`, `pnpm migrations:immutable`,
`pnpm pii:scan` (no real name in the new fixtures; the approver string is `agent-reviewer`), the full
Playwright suite (one spec fewer), `pnpm size` (`repo/ticket.ts` drops under 350 lines).

## 7. Changelog fragment

`changes/84-stop-destroying-history.md`:

```
- Pausing, resuming and transferring a ticket keeps every work stretch and records why it ended.
- A list entry is switched off, never deleted, and still reads back on old tickets.
- Tags are gone from the app; tag history on old tickets still shows.
- CI refuses a migration that drops, rewrites or revokes anything without an approver and a backup.
```

## 8. Out of scope

- **Any migration, grant or constraint change.** Revoking `UPDATE`/`DELETE`, turning cascades into `RESTRICT`,
  the definer functions, the `ticket_tag` drop and the duplicate-breakdown index are all ticket 07. This slice
  only makes the code ready for them.
- **A UI for switching a list entry off.** The route exists and the web never calls it today; an admin screen
  for lists is not in this ticket (see §9).
- **Replacing `isolation.test.ts`'s login/person deletion case** with the RESTRICT rule — ARCHITECTURE §9 item
  21 puts that in ticket 07, together with the revokes that make it true.
- **Import undo, the Cosmos seed's tenant delete, erasure, offboarding, `audit.purge`** — ticket 07.
- **`ticket_event` immutability** — nothing in this slice edits an event; the database rule is ticket 07.
- **The reply contract, `api-types.ts`, Zod reply schemas** — ticket 04.
- **`components/actions.ts`, catalogue structure, Gujarati strings** — ticket 05.
- **`docs/plan/MILESTONES.md`, `docs/plan/COVERAGE.md`, `docs/spec/parity.yaml`, `docs/HANDOFF.md`** — not
  edited here (the handoff is rewritten by the session-end hook; COVERAGE's G10 row still carries pre-renumber
  ticket ids, which the next planning pass owns).
- **Pausing with a switched-off wait reason** still works (`waitReasonSlaFlags` does not filter `active`).
  Unchanged on purpose: behaviour not named by the ticket.
- **The 500 a malformed uuid gives `DELETE /api/v1/lists/:list/:id`** today stays a 500; that is existing
  behaviour and route-wide input validation is ticket 04.

## 9. Regression risks and the tests that guard them

| Risk                                                                                                    | Guard                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The new insert/update path mis-orders or double-counts stretches, so per-person minutes or figures move | Tests 1–4, plus the whole existing suite: `tickets-commands.test.ts`, `state.test.ts`, `tickets-list.test.ts`, `day-report.test.ts`, `ticket-report.test.ts`, `ticket-pdf.test.ts`, `import-figures.test.ts`, and the `desk.spec.ts` browser lifecycle (pause → resume → transfer → close through the UI) |
| An extra SELECT per command slows the hot command path                                                  | One indexed read on `work_segment_ticket_idx` inside an existing transaction; the SLA/board timings in CI are unchanged                                                                                                                                                                                   |
| A switched-off list entry disappears from an old ticket or a report                                     | Test 5; `settings.test.ts` (config fingerprint and lists), `ticket-report.test.ts`, `ticket-pdf.test.ts`                                                                                                                                                                                                  |
| Deleting the three plant list reads breaks another caller                                               | `pnpm typecheck` plus `pnpm boundaries`; they had exactly one caller (checked)                                                                                                                                                                                                                            |
| A legacy `tag_add` event breaks the timeline or the detail reply                                        | Test 9; the two `timeline.tag*` keys stay, so `i18n.test.ts` (en/gu key parity) stays green                                                                                                                                                                                                               |
| Removing the tag routes changes the auth guard's generated route table                                  | Tests 10 and 13; `guard.test.ts`'s generated 401 sweep                                                                                                                                                                                                                                                    |
| The stricter migration rules turn CI red on a legitimate future migration                               | Tests 15–16 pin the benign forms (grants, `updated_at`, `ON UPDATE CASCADE`, comments) and the escape hatch (the two header markers)                                                                                                                                                                      |
| Ticket 05 edits the same i18n catalogue in parallel                                                     | This slice touches only the seven `tags.*` keys in `en.ts` and nothing else in `i18n/`; `actions.ts` is untouched                                                                                                                                                                                         |

## 10. Questions

1. **(Nimish, not blocking.)** Switching a list entry off instead of deleting it means an old entry stays
   visible on past tickets and reports but can no longer be picked. There is no screen for this yet: today only
   the API can switch an entry off. Should the admin screen later show switched-off entries in a separate
   "not in use" group, or hide them completely? (Default taken for now: hidden from pickers, shown on history.)

No other product question: tags were decided on 13 November (D14, DATA-MAP Q12), and everything else in this
ticket is a technical decision made above.
