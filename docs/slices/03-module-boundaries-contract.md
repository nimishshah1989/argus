# 03 — Module boundaries: contract

Issue: [#81](https://github.com/nimishshah1989/argus/issues/81) · Milestone M0 · Blocked by: 02 (done, #149).
Three PRs (§2.1), each `no-parity` and one changelog fragment; 03a and 03b also `size:large` (wide move, mostly
renames). Branches `claude/t03a-boundaries-modules`, `claude/t03b-boundaries-ticket-tables`,
`claude/t03c-domain-registries-isolation`. 03b starts after 03a merges; 03c can run beside either. The last one
to merge says `Closes #81`.

## 1. Goal

Every server module sits behind its `index.ts`, no module reads or writes another module's tables, and CI fails
the moment code crosses a boundary, names a table outside its owner, or a database table appears that the table
budget does not allow. Nothing a user sees changes.

## 2. Decisions (technical; deviations from ARCHITECTURE or the brief are marked **D**)

1. **D — three PRs, not one.** A probe of 02's tool with the new owners (tickets, accountability, files,
   notifications, imports) finds ~60 statements in 19 files beyond the ten LEGACY files, e.g. `imports` writes
   `ticket`/`ticket_event`/`crew_member`, `accountability` locks `ticket`, `reports` reads `ticket` and
   `ticket_event`. Emptying LEGACY with those owners means moving all of them. Split so each PR ends with LEGACY
   empty and full enforcement for the owners it adds: **03a** moves + G2/G4/G5/G6 + owners for files,
   notifications, accountability; **03b** owners for tickets and imports (their statements move into
   `tickets`/`imports` repos); **03c** G7 + G8 (no server file in common).
2. **D — repo folder.** A module's SQL may live in `modules/<m>/repo.ts` **or** any file under
   `modules/<m>/repo/`. Reason: `tickets` SQL is ~1,100 lines and the file budget is 400. Files that are mostly SQL
   move whole into `repo/` (Karpathy 3: no split of logic and SQL in this ticket).
3. **D — tenant argument.** New published read functions take `tenantId` (e.g. `machinesByIds(tx, tenantId, ids)`,
   ARCHITECTURE writes `machinesByIds(tx, ids)`) so every statement keeps today's explicit `tenant_id` filter on
   top of RLS. Same rows, defence in depth unchanged.
4. **Manifest.** `apps/server/src/modules/manifest.ts` (pure data, no imports) holds `OWNERS`, `CALLS` and
   `EXCEPTIONS`; the tool imports it (resolves 02 §2.13 D). `LEGACY` stays in the tool as `{}` with its stale rule.
5. **G5 direction = ARCHITECTURE's "May call" column**, not a single line: `CALLS` below. It is acyclic and
   consistent with the order kernel < ops < identity < plant < files < notifications < tickets < accountability <
   reports < imports (reports may not call accountability; imports may not call accountability or notifications).
   Any other module-to-module import fails unless it is in `EXCEPTIONS` (five, dated, §4.4). `jobs` stops being an
   exception: the job runner moves into `accountability`, and `app.ts`/`index.ts` (composition roots) may import any
   module index. `plant/service.ts → accountability (loadSlaPolicies)` stays an exception (moving it is not trivial:
   `/config` key order feeds the fingerprint).
6. **Tables stay with their writer**: `ticket-report.ts` (writes `breakdown_report`) → tickets; `settings.ts` (SLA
   policies + criticality) → accountability (it calls tickets and plant, both allowed); `file-store.ts` → files.
7. **Shifts.** Two plant functions (`shiftWindows`, `shiftsOf`) keep today's two statements byte for byte: the import
   path builds a map in heap order with no `ORDER BY`, and changing that order is not this slice.
8. **Workspace (measured on a copy):** with `exports` maps, `@uptimo/domain` declared, root `paths`, vitest aliases
   and the esbuild aliases removed, `tsc --noEmit` passes for the whole repo (web included), `pnpm build:server`
   bundles, vitest resolves and `tsx apps/server/src/app.ts` loads. `apps/web` imports no `@uptimo/*` package (it uses
   relative paths), so no alias is kept and web is not touched. `apps/server/test/harness.ts` keeps its relative
   `packages/db` import (the ESLint rule covers `apps/server/src` only, as asked).
9. **ESLint** core `no-restricted-imports` with `regex` patterns (ESLint 10.14 supports them), one block per folder
   depth (§4.5). The tool checks the same import rules (asked for both; the tool also sees module _calls_).
10. **Tests.** In 03a/03b the only edits under `apps/server/test`, `packages/db/test` and the moved
    `sla-jobs.test.ts` are import-path lines; new test files are listed in §6. Moved files keep their
    `@uptimo/db` import of `withTenant` (02's "through the kernel" is not enforced; no edit for it).
11. **G8.** `seed.sql` already has `breakdown_report_person` for both tenants (lines 78-80); only the hand list missed
    it, so **seed.sql is not edited**. D17's "28 today" = the 29 tables the migrations create minus `ticket_tag`
    (verified: `grep "CREATE TABLE" packages/db/migrations`). pg-boss lives in schema `pgboss` and the runner's
    `schema_migration` is not created by the isolation test (migrations are applied directly), so the check scans
    `public` only and needs no infrastructure allowance. `D17_TABLES` (40): `audit_log, breakdown_report,
breakdown_report_person, command_idempotency, crew_member, file, glossary_term, import_batch, import_row,
list_item, login, machine, machine_group, machine_move, person, platform_access, push_subscription, ref_counter,
segment, session, setting, shift, sla_policy, sla_timer, tenant, ticket, ticket_event, work_segment` (28) +
    `roster_entry, escalation_rule, notification, kpi_snapshot, forecast, intervention, pm_plan, asset_register,
ai_suggestion, document, document_chunk, wa_message` (12).
12. **Order of additions.** Each new published function lands in the commit of its first caller (§8); `app.ts`
    loses each `register*` call in the commit that moves that registrar.

## 3. PR 03a — modules, workspace, plant/identity reads, enforcement for three new owners

### 3.1 Moves (`git mv`, all under `apps/server/src/`), then the listed edits

| Old                      | New                                      | Old                       | New                                            |
| ------------------------ | ---------------------------------------- | ------------------------- | ---------------------------------------------- |
| `db.ts`                  | `kernel/db.ts`                           | `tickets.ts`              | `modules/tickets/routes.ts`                    |
| `file-store.ts`          | `modules/files/store.ts`                 | `ticket-list.ts`          | `modules/tickets/list.ts`                      |
| `push.ts`                | `modules/notifications/routes.ts`        | `ticket-mapper.ts`        | `modules/tickets/mapper.ts`                    |
| `reports.ts`             | `modules/reports/routes.ts`              | `ticket/severity.ts`      | `modules/tickets/severity.ts`                  |
| `day-report.ts`          | `modules/reports/day-report.ts`          | `tags.ts`                 | `modules/tickets/tags.ts`                      |
| `day-report-template.ts` | `modules/reports/day-report-template.ts` | `ticket-sql.ts`           | `modules/tickets/repo/ticket.ts`               |
| `pdf.ts`                 | `modules/reports/pdf.ts`                 | `ticket/events.ts`        | `modules/tickets/repo/events.ts`               |
| `pdf-template.ts`        | `modules/reports/pdf-template.ts`        | `ticket-idempotency.ts`   | `modules/tickets/repo/idempotency.ts`          |
| `ticket/sla.ts`          | `modules/accountability/sla.ts`          | `ticket-report.ts`        | `modules/tickets/repo/report.ts`               |
| `sla-projection.ts`      | `modules/accountability/projection.ts`   | `tag-sql.ts`              | `modules/tickets/repo/tags.ts`                 |
| `settings.ts`            | `modules/accountability/routes.ts`       | `import/<f>.ts` (all 23)  | `modules/imports/<f>.ts` (same names)          |
| `jobs/index.ts`          | `modules/accountability/jobs.ts`         | `jobs/sla-consistency.ts` | `modules/accountability/consistency.ts`        |
| `jobs/sla-timer.ts`      | `modules/accountability/repo/timers.ts`  | `jobs/sla-jobs.test.ts`   | `modules/accountability/test/sla-jobs.test.ts` |

**Deleted:** `auth.ts`, `session.ts`, `tenant.ts`, `config.ts`, `jobs/adapter.ts`. Their importers use
`modules/identity/index.js` (`requireAuth`, `hashToken`, `resolveTenant`, `tenantSlugFromHost`, `TenantRow`) or
`kernel/index.js` (`AppConfig`, `jobDb`). Root files left: `app.ts`, `index.ts`.

**Import rewiring rule** (every moved file and every importer): a relative import of a moved file becomes the new
relative path; an import that now crosses into another module goes to that module's `index.js`; `AppConfig`,
`jobDb`, `JobRole`, `JobsHandle`, `createPool` come from `kernel/index.js`. Examples that settle every case:
`tickets/routes.ts` imports `../identity/index.js` (requireAuth), `../../kernel/index.js` (AppConfig),
`./mapper.js`, `./repo/ticket.js`, `./repo/idempotency.js`, `./list.js`, `./repo/report.js`, `./severity.js`,
`../accountability/index.js` (reconcileTicket, projectTicketSla, withSlaProjections — exception);
`accountability/repo/timers.ts` imports `jobDb` from `../../../kernel/index.js`; `imports/cli.ts` imports
`createPool` from `../../kernel/index.js`, `resolveTenant` from `../identity/index.js`, `startJobs, reconcileTicket`
from `../accountability/index.js`; `plant/service.ts` imports `loadSlaPolicies` from `../accountability/index.js`
(comment kept); `reports/pdf-template.ts` imports `type StoredReport` from `../tickets/index.js`.
`tools/import-bhavin.ts` → `../apps/server/src/modules/imports/cli.js`. Tests: `../src/<old>` → `../src/<new>`
per the table; `../src/session.js`, `../src/tenant.js` → `../src/modules/identity/index.js`;
`../src/config.js`, `../src/jobs/adapter.js` → `../src/kernel/index.js`. `sla-jobs.test.ts` imports become
`../consistency.js`, `../jobs.js`, `../repo/timers.js`.

### 3.2 New and edited files (03a)

| File                                                           | Content                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kernel/index.ts`                                              | add `export { createPool } from './db.js';`                                                                                                                                                                                                                                                                                                                                                                    |
| `modules/index.ts`                                             | `modules = [opsModule, identityModule, plantModule, filesModule, notificationsModule, ticketsModule, accountabilityModule, reportsModule, importsModule]`                                                                                                                                                                                                                                                      |
| `modules/manifest.ts` (new)                                    | `OWNERS`, `CALLS`, `EXCEPTIONS` (§4.4)                                                                                                                                                                                                                                                                                                                                                                         |
| `modules/files/repo.ts` (new)                                  | `NewFile`, `insertFileRow` moved verbatim from `store.ts` (imports `sha256` from `./store.js`); `fileIdForTickets`                                                                                                                                                                                                                                                                                             |
| `modules/files/index.ts` (new)                                 | publishes `createLocalFileStore`, `pdfObjectKey`, `dayReportObjectKey`, `type ObjectStore`, `insertFileRow`, `fileIdForTickets`, `filesModule` (`register: () => undefined`)                                                                                                                                                                                                                                   |
| `modules/notifications/repo.ts` (new)                          | the four `push_subscription` statements of `routes.ts` (§4.3)                                                                                                                                                                                                                                                                                                                                                  |
| `modules/notifications/routes.ts`                              | `personExists` deleted; callers use identity `activePerson`; the four queries call repo functions                                                                                                                                                                                                                                                                                                              |
| `modules/notifications/index.ts` (new)                         | `notificationsModule` (`register: registerPush`)                                                                                                                                                                                                                                                                                                                                                               |
| `modules/reports/machines.ts` (new)                            | `withMachines` (§4.2)                                                                                                                                                                                                                                                                                                                                                                                          |
| `modules/reports/day-report.ts`, `routes.ts`                   | §4.2 edits                                                                                                                                                                                                                                                                                                                                                                                                     |
| `modules/reports/index.ts` (new)                               | `reportsModule` (`register: registerReports`)                                                                                                                                                                                                                                                                                                                                                                  |
| `modules/accountability/repo/policies.ts` (new)                | every `sla_policy` statement (§4.3)                                                                                                                                                                                                                                                                                                                                                                            |
| `modules/accountability/sla.ts`                                | `loadCalendar` uses `tenantInfo` + `shiftWindows`; policy query → `tenantPolicies`; `slaPolicyDto`/`loadSlaPolicies` move to `repo/policies.ts`                                                                                                                                                                                                                                                                |
| `modules/accountability/routes.ts`                             | `upsertSlaPolicies` INSERT → `upsertPolicy`; `before` query → `currentPolicies`; `registerSettings` unchanged                                                                                                                                                                                                                                                                                                  |
| `modules/accountability/index.ts` (new)                        | publishes `reconcileTicket`, `reconcileSlaPolicies`, `projectTicketSla`, `withSlaProjections`, `loadSlaPolicies`, `startJobs`, `type SlaTicketReconciler`, `accountabilityModule` (`register: registerSettings`)                                                                                                                                                                                               |
| `modules/tickets/repo/ticket.ts`                               | `personExists` → identity `activePerson`; `waitReasonSlaFlags` → plant `listItem`                                                                                                                                                                                                                                                                                                                              |
| `modules/tickets/repo/report.ts`                               | `tenantDate`, `currentShift`, `assertPeople` (§4.2)                                                                                                                                                                                                                                                                                                                                                            |
| `modules/tickets/repo/tags.ts`                                 | three `list_item` reads → plant; `loadTicketTags` split (§4.2)                                                                                                                                                                                                                                                                                                                                                 |
| `modules/tickets/severity.ts`                                  | `loadSeverityMatrix` → plant `setting`; `machineCriticality` → plant `machinesByIds`                                                                                                                                                                                                                                                                                                                           |
| `modules/tickets/routes.ts`                                    | `validateMachine` machine read → `machinesByIds(client, tx.tenantId, [tx.body.machineId as string], 'share')` then `[0]`                                                                                                                                                                                                                                                                                       |
| `modules/tickets/index.ts` (new)                               | publishes `loadEvents`, `reviveCorrection`, `lockRefCounter`, `loadSeverityMatrix`, `loadReport`, `type StoredReport`, `figuresFromRow`, `ticketsModule` (`register` calls `registerTickets` then `registerTags`)                                                                                                                                                                                              |
| `modules/imports/references.ts`                                | `loadLists`/`loadShifts`/`loadMachine`/`loadPeople` reads and the person insert → plant/identity (§4.2)                                                                                                                                                                                                                                                                                                        |
| `modules/imports/undo.ts`                                      | the `file` probe → `fileIdForTickets`; error text unchanged                                                                                                                                                                                                                                                                                                                                                    |
| `modules/imports/index.ts` (new)                               | `importsModule` (`register: () => undefined`; the CLI is `cli.ts`)                                                                                                                                                                                                                                                                                                                                             |
| `modules/identity/repo.ts`, `index.ts`                         | add and publish `activePerson`, `peopleByIds`, `activePeople`, `ensurePendingPerson`; `tenantInfo` return type widens to `{ name: string; language: string; time_zone: string }` (SQL unchanged)                                                                                                                                                                                                               |
| `modules/plant/repo.ts`, `index.ts`                            | add and publish `MachineRow`, `machinesByIds`, `activeMachineByCode`, `setting`, `listItem`, `activeListItems`, `listItemsOf`, `listItemOf`, `listItemsByIds`, `shiftWindows`, `shiftsOf`, `shiftCodeAt`                                                                                                                                                                                                       |
| `app.ts`                                                       | delete the five `register*` imports and calls (`registerSettings`, `registerTickets`, `registerReports`, `registerPush`, `registerTags`); `AppConfig` from `./kernel/index.js`; `startJobs`, `reconcileTicket`, `SlaTicketReconciler` from `./modules/accountability/index.js`. `Fastify(...)`, the guard line (still before every route), `/health`, the module loop and the error handler are byte-identical |
| `index.ts`                                                     | `createPool`, `type JobRole` from `./kernel/index.js`; `startJobs`, `reconcileTicket`, `SlaTicketReconciler` from `./modules/accountability/index.js`; nothing else                                                                                                                                                                                                                                            |
| `tools/check-boundaries.ts`, `tools/boundaries.test.ts`        | §4.4, §6.1                                                                                                                                                                                                                                                                                                                                                                                                     |
| `eslint.config.js`, `tools/eslint-boundaries.test.ts` (new)    | §4.5, §6.2                                                                                                                                                                                                                                                                                                                                                                                                     |
| `packages/{db,domain,shared}/package.json`                     | add `"exports": { ".": "./src/index.ts" }`                                                                                                                                                                                                                                                                                                                                                                     |
| `apps/server/package.json`, `pnpm-lock.yaml`                   | add `"@uptimo/domain": "workspace:*"`; `pnpm install`                                                                                                                                                                                                                                                                                                                                                          |
| `tsconfig.json`, `vitest.config.ts`, `scripts/build-server.ts` | delete `compilerOptions.paths`; delete the three path constants and `resolve.alias`; delete the esbuild `alias`                                                                                                                                                                                                                                                                                                |
| `tools/workspace.test.ts` (new)                                | §6.2                                                                                                                                                                                                                                                                                                                                                                                                           |
| `apps/server/test/plant-repo.test.ts` (new)                    | §6.3                                                                                                                                                                                                                                                                                                                                                                                                           |

Not touched: `apps/web`, `health.ts`/`logging.ts` (do not exist yet; ticket 13), seed scripts, migrations,
`docs/plan/MILESTONES.md`, `ledger.md`, `.github/`.

## 4. Interfaces

### 4.1 Published functions (03a). `Db = Pick<PoolClient, 'query'>`; each runs in the caller's transaction

```ts
// identity/repo.ts
activePerson(tx: Db, tenantId: string, personId: string): Promise<{ id: string; name: string } | undefined>
//   SELECT id, name FROM person WHERE tenant_id = $1 AND id = $2 AND active
peopleByIds(tx: Db, tenantId: string, ids: readonly string[]): Promise<{ id: string; name: string }[]>
//   SELECT id, name FROM person WHERE tenant_id = $1 AND id = ANY($2::uuid[])
activePeople(tx: Db, tenantId: string): Promise<{ id: string; name: string }[]>
//   SELECT id, name FROM person WHERE tenant_id = $1 AND active
ensurePendingPerson(tx: Db, tenantId: string, name: string): Promise<string>   // returns rows[0].id
//   the INSERT INTO person … RETURNING id of references.ts:183-187, verbatim
// plant/repo.ts
interface MachineRow { id: string; code: string; category: string | null; cell: string | null; criticality: Criticality | null }
machinesByIds(tx: Db, tenantId: string, ids: readonly string[], lock?: 'share'): Promise<MachineRow[]>
//   `SELECT id, code, category, cell, criticality FROM machine WHERE tenant_id = $1 AND id = ANY($2::uuid[]) ORDER BY id${lock === 'share' ? ' FOR SHARE' : ''}`
activeMachineByCode(tx: Db, tenantId: string, code: string): Promise<MachineRow[]>
//   SELECT id, code, category, cell, criticality FROM machine WHERE tenant_id = $1 AND code = $2 AND status = $3  ['active']
setting(tx: Db, tenantId: string, key: string): Promise<unknown>   // rows[0]?.value
//   SELECT value FROM setting WHERE tenant_id = $1 AND key = $2
listItem(tx: Db, tenantId: string, list: string, code: string): Promise<{ is_vendor: boolean; pauses_sla: boolean } | undefined>
//   SELECT is_vendor, pauses_sla FROM list_item WHERE tenant_id = $1 AND list = $2 AND code = $3
activeListItems(tx: Db, tenantId: string, lists: readonly string[]): Promise<Record<string, unknown>[]>
//   references.ts:78 verbatim (list, code, is_vendor, pauses_sla)
listItemsOf(tx: Db, tenantId: string, lists: readonly string[], only: string | null): Promise<Record<string, unknown>[]>
//   tag-sql.ts:25 verbatim (id, list, code, label, label_gu, label_hi, active, sort), params [tenantId, lists, only]
listItemOf(tx: Db, tenantId: string, id: string, lists: readonly string[]): Promise<Record<string, unknown> | undefined>
//   tag-sql.ts:52 verbatim
listItemsByIds(tx: Db, tenantId: string, ids: readonly string[], lists: readonly string[]): Promise<Record<string, unknown>[]>
//   SELECT id, list, code, label, label_gu, label_hi, active, sort FROM list_item
//   WHERE tenant_id = $1 AND id = ANY($2::uuid[]) ORDER BY array_position($3::text[], list), sort, code
shiftWindows(tx: Db): Promise<Record<string, unknown>[]>        // sla.ts:34 verbatim (code, starts_at::text, ends_at::text, crosses_midnight; ORDER BY code)
shiftsOf(tx: Db, tenantId: string): Promise<Record<string, unknown>[]>  // references.ts:112 verbatim
shiftCodeAt(tx: Db, timeZone: string | null): Promise<string | undefined>  // rows[0]?.code
//   WITH local_time AS (SELECT (now() AT TIME ZONE $1)::time AS t) SELECT code FROM shift, local_time
//   WHERE (NOT crosses_midnight AND t >= starts_at AND t < ends_at) OR (crosses_midnight AND (t >= starts_at OR t < ends_at))
//   ORDER BY code LIMIT 1
// files/repo.ts
fileIdForTickets(tx: Db, tenantId: string, ticketIds: readonly string[]): Promise<string | undefined>
//   SELECT id FROM file WHERE tenant_id = $1 AND ticket_id = ANY($2::uuid[]) LIMIT 1
```

### 4.2 Caller edits that replace a cross-module statement (03a; results byte-identical)

- **`reports/machines.ts`**: `withMachines(tx, tenantId, rows: Record<string, unknown>[]): Promise<Record<string, unknown>[]>`
  — unique non-null `row.machine_id` strings; if none, no query; `machinesByIds` → map by id; returns
  `rows.map((row) => ({ ...row, machine_code: m?.code ?? null, machine_category: m?.category ?? null, machine_cell: m?.cell ?? null }))`
  (exactly a `LEFT JOIN`'s nulls).
- **`day-report.ts`**: in `JOBS_SQL` and `PENDING_SQL` delete the `m.code AS machine_code, m.category AS
machine_category, m.cell AS machine_cell` select items and the `LEFT JOIN machine m …` line, add `t.machine_id`
  after `t.machine_snapshot`; `queryJobs`/`queryPending` wrap their rows in `withMachines(client, tenantId, rows)`.
  `loadDayReport`: tenant → `await tenantInfo(client, query.tenantId)`; person →
  `await activePerson(client, query.tenantId, query.personId)`; the `if (!tenant)`/`if (!person)` returns stay.
- **`reports/routes.ts`**: same `TICKET_SQL` edit; `loadPdfContext` row → `(await withMachines(client, tenantId, rows))[0]`;
  tenant → `tenantInfo`; `personNames` → `peopleByIds(client, tenantId, ids)`.
- **`tickets/repo/report.ts`**: `tenantDate`: `const zone = (await tenantInfo(client, tenantId))?.time_zone ?? null;`
  then `SELECT (now() AT TIME ZONE $1)::date::text AS today` with `[zone]`; `currentShift`: same `zone`, then
  `(await shiftCodeAt(client, zone)) ?? '1'`; `assertPeople`: `(await peopleByIds(client, tenantId, unique)).length !== unique.length`.
- **`tickets/repo/tags.ts`**: `listCatalogue` → `listItemsOf(client, tenantId, TAG_CATEGORIES, category ?? null)`;
  `findDefinition` → `listItemOf(client, tenantId, itemId, TAG_CATEGORIES)`; `loadTicketTags`: assignments =
  `SELECT item_id, applied_at, applied_by_login_id, applied_by_person_id FROM ticket_tag WHERE tenant_id = $1 AND ticket_id = $2`;
  items = `listItemsByIds(client, tenantId, assignments' item_ids, TAG_CATEGORIES)` (no call when empty); each item
  pairs with its assignment by `item_id`; `applied` and `tags` are built in item order with today's mappers.
- **`tickets/severity.ts`**: `const value = await setting(client, tenantId, 'severity_matrix'); if (!value) return defaultSeverityMatrix;`
  then parse `value`; `machineCriticality`: `(await machinesByIds(client, tenantId, [machineId]))[0]?.criticality ?? null`.
- **`tickets/repo/ticket.ts`**: `personExists` → `Boolean(await activePerson(client, tenantId, personId))`;
  `waitReasonSlaFlags` → `const row = await listItem(client, tenantId, 'wait_reason', reasonCode);`.
- **`accountability/sla.ts` `loadCalendar`**: `(await tenantInfo(client, tenantId)).time_zone` and `await shiftWindows(client)`.
- **`imports/references.ts`**: `loadLists` → `activeListItems(ctx.client, ctx.tenantId, [...LISTS])`; `loadShifts` →
  `shiftsOf`; `loadMachine` → `activeMachineByCode` (the `length !== 1` check stays); `loadPeople` → `activePeople`
  and `ensurePendingPerson(ctx.client, ctx.tenantId, name)`.
- **`notifications/routes.ts`**: `personExists(…)` → `Boolean(await activePerson(client, auth.tenantId, actingPersonId))`.

### 4.3 In-module repo functions (03a; SQL and params verbatim from the cited line)

`notifications/repo.ts`: `subscriptionsOfLogin(tx, tenantId, loginId)` (push.ts:76, rows);
`upsertSubscription(tx, s: { tenantId; loginId; actingPersonId; endpoint; keys: string; role })` (push.ts:118, `keys`
already `JSON.stringify`d by the caller); `deleteSubscription(tx, tenantId, endpoint)` (push.ts:155);
`subscriptionsOfPerson(pool: Pool, personId)` (push.ts:199, rows).
`accountability/repo/policies.ts`: `tenantPolicies(tx, tenantId): Promise<SlaPolicy[]>` (sla.ts:93);
`currentPolicies(tx): Promise<Record<string, unknown>[]>` (settings.ts:108); `upsertPolicy(tx, tenantId, policy)`
(settings.ts:56, `policy` = one element of `input.policies`); `slaPolicyDto`, `loadSlaPolicies` (moved verbatim).

### 4.4 `modules/manifest.ts` and `tools/check-boundaries.ts`

<!-- prettier-ignore -->
```ts
// apps/server/src/modules/manifest.ts — pure data, no imports
export const OWNERS: Readonly<Record<string, readonly string[]>> = {
  ops: ['audit_log'], identity: [/* 02's eight names */], plant: [/* 02's nine names */],
  files: ['file'], notifications: ['push_subscription'], accountability: ['sla_policy', 'sla_timer'], reports: [],
  // 03b adds: tickets: ['ticket', 'ticket_event', 'ticket_tag', 'crew_member', 'work_segment', 'breakdown_report',
  //   'breakdown_report_person', 'command_idempotency', 'ref_counter'], imports: ['import_batch', 'import_row']
};
export const CALLS: Readonly<Record<string, readonly string[]>> = {
  ops: [], identity: ['ops'], plant: ['identity', 'ops'], files: ['ops'], notifications: ['identity', 'plant', 'ops'],
  tickets: ['identity', 'plant', 'files', 'ops'], accountability: ['tickets', 'identity', 'plant', 'notifications', 'ops'],
  reports: ['tickets', 'identity', 'plant', 'files'], imports: ['tickets', 'identity', 'plant', 'files', 'ops'],
};
export interface CallException { file: string; module: string; until: string } // file: repo-relative path
export const EXCEPTIONS: readonly CallException[] = [/* the five rows of the table below, in that order */];

// tools/check-boundaries.ts — table names in SQL text
const NAME = String.raw`(?:only\s+)?(?:lateral\s+)?(?:"?[a-z_][a-z0-9_]*"?\s*\.\s*)?"?([a-z_][a-z0-9_]*)"?`;
const AFTER_KEYWORD = new RegExp(String.raw`\b(?:join|into|update)\s+${NAME}`, 'gi');
const FROM_LIST = /\bfrom\s+([^;()]*?)(?=\b(?:where|join|on|group|order|limit|union|returning|set|having|for|using|window)\b|[;()]|$)/gi;
const FROM_ITEM = new RegExp(String.raw`^\s*${NAME}`, 'i');
// tablesNamed(sql): AFTER_KEYWORD captures + for each FROM_LIST capture, split(','), FROM_ITEM capture of each item;
// lower-cased, unique, sorted.
```

| `EXCEPTIONS` file (`apps/server/src/modules/…`) | module         | until                                                    |
| ----------------------------------------------- | -------------- | -------------------------------------------------------- |
| `plant/service.ts`                              | accountability | 04: SLA policies leave `/config`                         |
| `tickets/routes.ts`                             | accountability | 04: `sla` reply part                                     |
| `tickets/list.ts`                               | accountability | 04: `sla` reply part                                     |
| `imports/bhavin.ts`                             | accountability | 04: SLA reconciles on `ticket.changed` (open question 3) |
| `imports/cli.ts`                                | accountability | 04: SLA reconciles on `ticket.changed` (open question 3) |

Tool (keeps `SERVER_SRC`, `sqlLiterals`, `serverFiles`, `LEGACY: Baseline = {}`; `OWNERS` now re-exported from the
manifest). Functions stay under 60 lines; file under 400.

- `ownerRepo(file, owner)`: true for `modules/<owner>/repo.ts` and any file under `modules/<owner>/repo/`.
- `unitOf(file)`: `kernel` (under `kernel/`), module `<m>` (under `modules/<m>/`), `root` (`app.ts`, `index.ts`,
  `modules/index.ts`, `modules/manifest.ts`), else `legacy`.
- `importsOf(source)`: specifiers of every `ImportDeclaration` and `ExportDeclaration` with a module specifier
  (type-only included) that start with `.`; resolved against the file's folder, `.js` → `.ts`.
- `boundaryErrors(root, legacy = LEGACY, exceptions = EXCEPTIONS): string[]` — 02's SQL errors (with `ownerRepo`), then:
  - legacy file: `${file}: legacy path; move it into kernel/ or modules/<name>/`
  - module folder not in `CALLS`: `${file}: module ${m} is not in the manifest`
  - import of a legacy path: `${file}: imports legacy path ${target}`
  - another unit's non-index file: `${file}: imports ${target}; ${unit} is reached only through ${index}` (index =
    `kernel/index.ts` or `modules/<m>/index.ts`, with `SERVER_SRC/` prefix)
  - kernel importing a module or root file: `${file}: the kernel imports no module (${target})`
  - a module importing a root file: `${file}: a module may not import ${target}`
  - module `s` importing module `t` not in `CALLS[s]` and not in `exceptions`: `${file}: ${s} may not call ${t} (${target})`
  - an exception the file no longer needs: `${file}: EXCEPTIONS lists ${module} but the file no longer imports it; remove it`

### 4.5 ESLint (`eslint.config.js`, after the `**/*.ts` block; message text as shown)

| `files`                            | `no-restricted-imports` `patterns[].regex`                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `apps/server/src/*.ts`             | `^\.\./` ("leaves apps/server/src"); `^\./(?:kernel\|modules/[^/]+)/(?!index\.js$)` ("only through index.js") |
| `apps/server/src/kernel/*.ts`      | `^\.\./` ("the kernel imports nothing outside it")                                                            |
| `apps/server/src/modules/*.ts`     | `^\.\./(?!kernel/index\.js$)`; `^\./[^/]+/(?!index\.js$)`                                                     |
| `apps/server/src/modules/*/*.ts`   | `^\.\./\.\./(?!kernel/index\.js$)`; `^\.\./[^./][^/]*/(?!index\.js$)`                                         |
| `apps/server/src/modules/*/*/*.ts` | `^\.\./\.\./\.\./(?!kernel/index\.js$)`; `^\.\./\.\./[^./][^/]*/(?!index\.js$)`                               |

(`\|` above is table escaping; the regex is `(?:kernel|modules/[^/]+)`.)

## 5. PR 03b — `tickets` and `imports` own their tables

All statements below move to the named function, SQL text verbatim from the cited line (as left by 03a). Arguments
are the statement's `$n` values in order, in one object when more than three; the function returns what the caller
used (`rows`, `rows[0]`, an id, `rowCount`), typed `QueryResult['rows']` where the caller reads rows untyped. The
caller's other code is unchanged. Each new function is published through `modules/tickets/index.ts` when a
caller is in another module.

| From                                                                                                                 | Function (new file)                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accountability/sla.ts:52`                                                                                           | `ticketEventRows(tx, ticketIds)` (`tickets/repo/sla.ts`)                                                                                                                                                                                                                                                                                      |
| `accountability/sla.ts:87`                                                                                           | `slaTicketRows(tx, tenantId, ticketIds)` (same)                                                                                                                                                                                                                                                                                               |
| `sla.ts:197`, `repo/timers.ts:201`, `:244`                                                                           | `lockTicket(tx, tenantId, ticketId): Promise<boolean>` (`rowCount === 1`; callers test the boolean)                                                                                                                                                                                                                                           |
| `accountability/sla.ts:234`                                                                                          | `setSlaPolicyId(tx, tenantId, ticketId, policyId)`                                                                                                                                                                                                                                                                                            |
| `accountability/sla.ts:249`                                                                                          | `slaCandidateIds(tx, tenantId): Promise<string[]>`                                                                                                                                                                                                                                                                                            |
| `accountability/consistency.ts:26`                                                                                   | `slaConsistencyIds(tx, tenantId): Promise<string[]>` (caller returns `.length`)                                                                                                                                                                                                                                                               |
| `accountability/routes.ts` criticality block (matrix load → `UPDATE … UNNEST`)                                       | `refreshMachineSeverity(tx, { tenantId, machineId, criticality })` in `tickets/severity.ts`, its two statements in `tickets/repo/severity.ts` as `machineTicketsForUpdate(tx, tenantId, machineId)` and `setSeverities(tx, { ids, severities, tenantId })`; the route keeps `lockRefCounter`, `setMachineCriticality`, `reconcileSlaPolicies` |
| `reports/day-report.ts` `JOBS_SQL`, `PENDING_SQL`                                                                    | `dayJobRows(tx, { tenantId, personId, start, end })`, `pendingRows(tx, tenantId, end)` (`tickets/repo/history.ts`)                                                                                                                                                                                                                            |
| `reports/routes.ts` `TICKET_SQL`, `:184`                                                                             | `pdfTicketRow(tx, tenantId, ticketId)`, `setReportPdf(tx, { fileId, payload, reportId, tenantId })` (same)                                                                                                                                                                                                                                    |
| `tickets/routes.ts:201`, `:335`                                                                                      | `openDuplicateId(tx, tenantId, machineId)`, `openTicketRows(tx, tenantId)` (`tickets/repo/list.ts`)                                                                                                                                                                                                                                           |
| `tickets/list.ts` `loadPerPerson` query, `queryList` lines 94-124, `listNeedReport` lines 192-206, `detail` row      | `segmentRowsFor(tx, tenantId, ticketIds)`, `selectTicketPage(tx, tenantId, filters)` (+ `ListFilters` moves here), `needReportRows(tx, tenantId, actingPersonId, role)`, `ticketRowById(tx, tenantId, id)`                                                                                                                                    |
| `imports/counters.ts:19`, `:23`, `:52`                                                                               | `refCounterRows(tx, tenantId, prefix)`, `ticketRefsLike(tx, tenantId, pattern)`, `raiseRefCounter(tx, { tenantId, prefix, next })` (`tickets/repo/imported.ts`)                                                                                                                                                                               |
| `imports/identity.ts:87`, `parents.ts:139`                                                                           | `ticketParents(tx, tenantId)` (identity.ts's `ORDER BY ref` text; parents only builds maps)                                                                                                                                                                                                                                                   |
| `imports/identity.ts:100`                                                                                            | split: `provenanceRows(tx, tenantId, contract)` in `imports/repo.ts` (same SQL minus `t.ref` and the `LEFT JOIN ticket`) + `refsByIds(tx, tenantId, ids): Promise<Map<string, string>>` (`SELECT id, ref FROM ticket WHERE tenant_id = $1 AND id = ANY($2::uuid[])`); `ref` = `refs.get(ticket_id) ?? ''`                                     |
| `imports/parents.ts:177`                                                                                             | `setParent(tx, { tenantId, childId, parentId })`                                                                                                                                                                                                                                                                                              |
| `imports/insert.ts:179`, `:193`, `:225`, `:249`                                                                      | `insertImportedTicket(tx, columns, values): Promise<string>`, `insertImportedEvent(tx, values)`, `insertImportedCrew(tx, values)`, `insertImportedSegment(tx, values)` (`values` = today's array)                                                                                                                                             |
| `imports/insert-reports.ts:29`, `:15`                                                                                | `insertImportedReport(tx, values): Promise<string>`, `insertReportPerson(tx, values)`                                                                                                                                                                                                                                                         |
| `imports/fingerprint-sql.ts` `loadTicketRows`, `queryChildren`                                                       | `importedTicketRows(tx, { tenantId, ticketIds, columns, lock })`, `importedChildren(tx, tenantId, ticketIds)` (bodies verbatim; `columns` = the mapped column list)                                                                                                                                                                           |
| `imports/undo.ts:117`, `:128`, `:142+146`                                                                            | `outsideChildRef(tx, tenantId, ids)`, `reportWithFileId(tx, tenantId, ids)`, `deleteImportedTickets(tx, tenantId, ids): Promise<number \| null>`                                                                                                                                                                                              |
| `imports/batch.ts:53`, `:76`; `bhavin.ts:145`, `:153`, `:163`, `:295`; `fingerprint-sql.ts:50`; `undo.ts:71`, `:161` | `imports/repo.ts`: `insertBatch`, `failBatch`, `updateImportRow`, `insertPendingRow`, `insertErrorRow`, `finishBatch`, `importedRowRows`, `lockBatchRow`, `markUndone`                                                                                                                                                                        |

Then `OWNERS` gains `tickets` and `imports` (§4.4). `bhavin.ts`'s savepoints, advisory lock and `SHOW TIME ZONE`
name no table and stay.

## 6. Tests (Given / When / Then; each red before its code)

### 6.1 `tools/boundaries.test.ts` (DB-free, fast tests). 02's B1–B7 stay; B2 (`LEGACY` snapshot) becomes `{}`

1. **B8 "names a table in every FROM form"** (`it.each`): Given `legacy = {}` and one planted
   `apps/server/src/modules/reports/x.ts`, When `boundaryErrors` runs, Then exactly
   `…x.ts: SQL names person (owned by identity); only apps/server/src/modules/identity/repo.ts may` for each of
   `'SELECT 1 FROM widget w, person p'`, `'SELECT 1 FROM public.person'`, `'SELECT 1 FROM "person"'`,
   `'SELECT 1 FROM ONLY person'`, `'SELECT 1 FROM widget w JOIN LATERAL person p ON true'`,
   `'SELECT 1 FROM widget w, LATERAL (SELECT 1) x, "public"."person" y'` (`widget` has no owner, so these
   expectations still hold after 03b).
2. **B9 "allows SQL anywhere under the owner's repo/ folder"**: `modules/tickets/repo/x.ts` with `'SELECT 1 FROM machine'` → plant error; `modules/plant/repo/x.ts` same text → `[]`.
3. **B10 "fails a non-index import of another module"**: `modules/reports/a.ts` = `import { x } from '../plant/repo.js';` → `…a.ts: imports apps/server/src/modules/plant/repo.ts; plant is reached only through apps/server/src/modules/plant/index.ts`. Also `import type` of the same path fails the same way.
4. **B11 "fails a kernel-internal import"**: `modules/plant/a.ts` = `import { guard } from '../../kernel/guard.js';` → kernel-index error.
5. **B12 "fails a legacy path"**: `apps/server/src/tickets.ts` (any text) → legacy-path error; `modules/plant/a.ts` = `import '../../auth.js';` → `imports legacy path apps/server/src/auth.ts`.
6. **B13 "fails a call the manifest does not allow"**: `modules/plant/a.ts` = `import { x } from '../tickets/index.js';` → `…a.ts: plant may not call tickets (apps/server/src/modules/tickets/index.ts)`; with `exceptions = [{ file: …a.ts, module: 'tickets', until: 't' }]` → `[]`; with that exception and no import → the stale-exception error.
7. **B14 "the kernel imports no module"**: `kernel/a.ts` = `import { m } from '../modules/plant/index.js';` → kernel error.
8. **B15 "a module folder missing from the manifest fails"**: `modules/zzz/index.ts` → `module zzz is not in the manifest`.
9. **B16 "EXCEPTIONS is the dated list"**: `EXCEPTIONS.map((e) => `${e.file} -> ${e.module}`)` equals the five lines of §4.4 (shrink-only snapshot).
10. **B17 (03b) "every current table has one owner"**: each of the 28 D17 tables and `ticket_tag` is in
    exactly one `OWNERS` list, and no name is in two lists. Red at the start of 03b (tickets and imports tables
    have no owner).

### 6.2 `tools/eslint-boundaries.test.ts`, `tools/workspace.test.ts` (DB-free)

`lint(path, code)` = `new ESLint({ cwd: process.cwd() }).lintText(code, { filePath: path })`, rule ids
`no-restricted-imports` collected.

11. **E1**: `apps/server/src/modules/reports/a.ts` + `import { x } from '../plant/repo.js';` → 1 message; `../plant/index.js` → 0.
12. **E2**: same file + `import { y } from '../../../../packages/db/src/index.js';` → 1; `../../kernel/index.js` → 0; `../../kernel/guard.js` → 1.
13. **E3**: `apps/server/src/modules/tickets/repo/a.ts` + `../../plant/repo.js` → 1; `../ticket.js` and `../../plant/index.js` → 0.
14. **E4**: `apps/server/src/app.ts` + `./modules/tickets/routes.js` → 1; `apps/server/src/kernel/a.ts` + `../modules/plant/index.js` → 1.
15. **W1**: each of `packages/{db,domain,shared}/package.json` has `exports['.'] === './src/index.ts'`.
16. **W2**: every `@uptimo/<name>` imported under `apps/server/src` is in `apps/server/package.json` dependencies as `workspace:*` (red today: `@uptimo/domain`).
17. **W3**: `tsconfig.json` has no `compilerOptions.paths`; `vitest.config.ts` and `scripts/build-server.ts` contain no `alias`.

### 6.3 `apps/server/test/plant-repo.test.ts` (Docker; `startTestDb()`, admin inserts tenant `lock-test` and machine `LOCK-1`, criticality `A`)

18. **P1 "machinesByIds returns the machine row"**: When `withTenant(db.app, T, (c) => machinesByIds(c, T, [M]))`,
    Then `[{ id: M, code: 'LOCK-1', category: null, cell: null, criticality: 'A' }]`.
19. **P2 "the share lock is held until commit"**: Given an open `withTenant` that has called
    `machinesByIds(c, T, [M], 'share')`, When an admin client runs `SET lock_timeout = '300ms'` and
    `UPDATE machine SET code = code WHERE id = $1`, Then it rejects with `/lock timeout/`; without `'share'` the same
    update resolves. (Proves `tickets.ts:193`'s `FOR SHARE` survives.)

### 6.4 03c — `packages/domain/test/registry.test.ts`, `packages/db/test/isolation.test.ts`

20. **D1 "one file per command"**: `readdirSync('packages/domain/src/state/commands').sort()` equals the 15 command
    files of §7 plus `index.ts`, `registry.ts`; `Object.keys(handlers).sort()` equals the 15 command types.
21. **D2 "public API unchanged"**: `Object.keys(await import('../src/index.js')).sort()` equals today's 49 names:
    `SlaInputError, TransitionError, addBusinessMinutes, apply, assertWorking, businessMinutesBetween, canAnalytics, canCancel, canClose, canCorrect, canDayReport, canLateReport, canLiveBoard, canMoney, canRaise, canRestore, canSettingsLists, canSettingsPeople, canSettingsSla, canWork, cancel, clampAt, close, closeSegments, computeSeverity, correct, defaultSeverityMatrix, figures, join, lastEventAt, lateReport, leave, machineRunning, machineStopped, nextRef, nextSeq, pause, projectSlaTimers, raiseTicket, recordPastBreakdown, remainingSlaMinutes, restore, resume, slaBreached, start, transfer, transition, update, upgradeKind` (green before and after: the over-change guard).
22. **D3 "permissions are one file per area"**: `readdirSync('packages/domain/src/permissions')` equals `['settings.ts', 'ticket.ts', 'views.ts']`.
23. **I1 "discovers every tenant table"** (replaces `TENANT_TABLES`; `tenantTables` filled in `beforeAll` by
    `SELECT c.relname FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','p') AND a.attname = 'tenant_id' AND NOT a.attisdropped ORDER BY 1`):
    Then it contains `breakdown_report_person` and `rowProblems(tenantTables)` is `[]`, where `rowProblems` sets
    each tenant and returns `${table} as ${tenant}: ${n} rows` for every count ≠ 1. The existing RLS, unset-tenant
    and count tests use `tenantTables`.
24. **I2 "no table outside D17"**: `budgetProblems(await allTables())` is `[]` (`allTables` = same catalogue query
    without the column join); `budgetProblems` returns `${t}: not in D17's table list` for each name not in
    `D17_TABLES` (the 28 + the 12 of D17 = 40, asserted `toHaveLength(40)`) or `DATED_TABLES = { ticket_tag: 'ticket 07 drops it' }`.
25. **I3 "a planted table is caught"**: Given `RESET ROLE; BEGIN; CREATE TABLE stray_widget (id uuid PRIMARY KEY, tenant_id uuid NOT NULL); GRANT SELECT ON stray_widget TO app_user`,
    When `budgetProblems(await allTables())`, discovery, then `SET LOCAL ROLE app_user` and `rowProblems(['stray_widget'])` run,
    Then `['stray_widget: not in D17\'s table list']`, discovery includes `stray_widget`, and the row problems are
    `stray_widget as ${A}: 0 rows`, `stray_widget as ${B}: 0 rows` (A, B: the test's tenant ids); `finally`: `ROLLBACK; SET ROLE app_user`.

### 6.5 Regression (runs, not new tests)

26. **R1** after every task: `pnpm exec vitest run` (Docker) green; `git diff -U0 origin/main -- apps/server/test 'apps/server/src/**/*.test.ts'`
    shows only `import`/`from` lines plus the new files (03a/03b). Day-report, PDF, tags, push, severity, SLA and
    import tests prove the split queries return the same answers.
27. **R2** `pnpm boundaries` exits 0; planting `export const x = 'SELECT 1 FROM ticket t, person p';` in
    `modules/reports/routes.ts` exits 1 naming it (paste both in §9).
28. **R3** `pnpm verify` and `pnpm test:e2e` green (e2e starts `apps/server/src/index.ts` through `tsx`).

## 7. 03c files

| File                                                       | Change                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/domain/src/state/commands/<f>.ts` (15 new)       | one exported function each, body verbatim: `start`, `pause`, `resume`, `transfer`, `update`, `machine-running` (`machineRunning`), `machine-stopped`, `close`, `cancel`, `join`, `leave`, `upgrade-kind`, `late-report` (from `commands.ts` 6-319), `restore` (`corrections.ts` 88-117), `correct` (118-195 with `CorrectResult`, `recordEdit`, `assertCorrectionTimeline`); imports: only what the body uses |
| `…/state/commands/index.ts`, `registry.ts` (new)           | index: `export { start } from './start.js';` × 15; registry: the `handlers` map moved from `state.ts`, exported, not re-exported by `index.ts`                                                                                                                                                                                                                                                                |
| `…/state/past-breakdown.ts`, `state/limits.ts` (new)       | `PastBreakdownInput`, `recordPastBreakdown` (`corrections.ts` 17-86); `SEVEN_DAYS_MS` (not re-exported)                                                                                                                                                                                                                                                                                                       |
| `…/state.ts`                                               | `export * from './state/commands/index.js'; export * from './state/past-breakdown.js';` replace the two old lines; `import { handlers } from './state/commands/registry.js'`; `transition` unchanged                                                                                                                                                                                                          |
| `…/state/commands.ts`, `corrections.ts`                    | deleted                                                                                                                                                                                                                                                                                                                                                                                                       |
| `…/permissions/ticket.ts`, `views.ts`, `settings.ts` (new) | ticket: `WORK_ROLES`, `isOwn`, `isLeadOrPrimary`, `canRaise`, `canCancel`, `canWork`, `canClose`, `canLateReport`, `canRestore`, `canCorrect`; views: `canDayReport`, `canLiveBoard`, `canMoney`, `canAnalytics`; settings: `HEAD_ADMIN`, `canSettingsLists`, `canSettingsPeople`, `canSettingsSla`                                                                                                           |
| `…/permissions.ts`                                         | the registry: three `export *` lines (keeps `test/permissions.test.ts`'s import path)                                                                                                                                                                                                                                                                                                                         |
| `packages/db/test/isolation.test.ts`                       | I1–I3; `TENANT_TABLES` deleted                                                                                                                                                                                                                                                                                                                                                                                |

## 8. Tasks (one commit each; typecheck + tests green at each; the riskiest moves stand alone)

| PR  | #   | Commit                                                                                                                                                                       |
| --- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 03a | 1   | W1–W3 red → exports, server deps, lockfile, paths/aliases removed                                                                                                            |
|     | 2   | `kernel/db.ts` move; `index.ts`, `import/cli.ts` take `createPool` from `kernel/index.js`                                                                                    |
|     | 3   | files + notifications moves, repos, indexes, manifest list, `app.ts` drops `registerPush`; identity `activePerson`; LEGACY drops `push.ts`                                   |
|     | 4   | reports moves, `machines.ts`, §4.2 reports edits, identity `peopleByIds`, plant `machinesByIds` (P1, P2 first); LEGACY drops `day-report.ts`, `reports.ts`; snapshot updated |
|     | 5   | accountability moves, `repo/policies.ts`, `sla.ts` edits, `sla-jobs.test.ts` move, `app.ts`/`index.ts` imports; LEGACY drops `ticket/sla.ts`                                 |
|     | 6   | tickets moves and §4.2 tickets edits (biggest move); LEGACY drops the five ticket files                                                                                      |
|     | 7   | imports moves, `references.ts`, `undo.ts` file probe (second biggest); LEGACY `{}`                                                                                           |
|     | 8   | B8–B16 red → manifest, tool, OWNERS for files/notifications/accountability; shims deleted, test imports; E1–E4 red → ESLint                                                  |
|     | 9   | `changes/81-module-boundaries-contract.md`, `wiki/log.md`, `docs/HANDOFF.md` Guards bullet, §9                                                                               |
| 03b | 1–4 | accountability, reports, tickets-internal, imports statements of §5 (one commit each)                                                                                        |
|     | 5   | B17 red → OWNERS `tickets`, `imports`; R2; `changes/81-module-boundaries-ticket-tables.md`                                                                                   |
| 03c | 1–3 | D1/D2 → commands; D3 → permissions; I1–I3 → isolation; `changes/81-domain-registries-isolation.md`                                                                           |

Fragments (one bullet each): 03a "Server code is grouped into nine modules, each reached only through its index;
`pnpm boundaries` and lint fail a crossing." 03b "Ticket and import tables are touched only by their own module."
03c "Ticket commands and permissions are one file each, and the isolation test finds every tenant table itself and
fails on a table outside the 40-table budget." `docs/HANDOFF.md` Guards bullet: `pnpm boundaries` (table owners,
module calls and dated exceptions in `apps/server/src/modules/manifest.ts`). `wiki/log.md`: one dated line per PR.

## 9. Out of scope, risks, evidence

**Out of scope:** reply parts, `route()`, shared contracts and removing the five exceptions (04); deleting tags (06);
dropping `ticket_tag` (07); `/health` checks (13); splitting logic from SQL inside `repo/` files; any migration,
web, infra or seed-script change; ARCHITECTURE rule 7's `now`.

**Regression risks and their catch:** split joins (day report, PDF, tags, import provenance) → R1 suites;
`FOR SHARE` → P2; route registration order changes (find-my-way is order-independent; guard G2 lists routes);
`/config` fingerprint (plant untouched) → `settings.test.ts`; `tsx`/esbuild resolution without aliases → R3 e2e and
`pnpm build`; a moved test silently not collected → vitest `apps/**/*.test.ts` include, count compared before/after;
merge conflicts with 10 (web only: none) and 13 (`app.ts` health/Fastify lines untouched).

**Not verified here:** the full Docker suite and e2e (no Docker in the planning session); line numbers cited are
from `main` at a1eac62 and shift after earlier commits (the coder finds the statement by its text).

**Evidence (filled by the builder):** red/green per test id, R1 counts, R2 outputs, R3 links.

**Open questions (technical, for the orchestrator):** (1) accept the three-PR split; (2) is `repo/` (D §2.2) and the
`tenantId` argument (D §2.3) an architecture change to route through the architect; (3) the two `imports →
accountability` exceptions are not "upward" but ARCHITECTURE lists no such call: confirm 04 (or which ticket)
removes them. No product question for Nimish: nothing a user sees changes.
