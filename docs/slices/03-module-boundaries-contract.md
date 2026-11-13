# 03 — Module boundaries: contract

Issue: [#81](https://github.com/nimishshah1989/argus/issues/81) · Milestone M0 · Blocked by: 02 (#149). Base: `main`
with 13 (#146), 10 (#147), 08 (#150) merged. Three PRs, each labelled `no-parity`, each with one changelog fragment:

| PR                                   | Branch                                                   | Body says                                    | Built by                                               |
| ------------------------------------ | -------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------ |
| **03a** modules and enforcement      | `claude/t03a-boundaries-modules`                         | `Part of #81`, `size:large` (mostly renames) | the orchestrator's session, first                      |
| **03b** ticket and import tables     | `claude/t03b-boundaries-ticket-tables` (from 03a merged) | `Part of #81`, `size:large`                  | the orchestrator's session, second                     |
| **03c** domain registries, isolation | `claude/t03c-domain-registries-isolation` (from `main`)  | `Closes #81`                                 | a separate session, any time; **§6 is self-contained** |

## 1. Goal

Every server module sits behind its `index.ts`, no module reads or writes another module's tables, and CI fails the
moment code crosses a boundary, names a table outside its owner, or a table appears that the 40-table budget does not
allow. Nothing a user sees changes.

## 2. Ticket clauses (labels used below; MILESTONES' own G-labels are not used here)

| Label  | Ticket text (MILESTONES "03")                                                                                     | PR                                                                     |
| ------ | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **C1** | `tickets`, `accountability`, `notifications`, `reports`, `files`, `imports` are moved                             | 03a                                                                    |
| **C2** | workspace dependencies and `exports` replace relative imports                                                     | 03a                                                                    |
| **C3** | commands and permissions are one file each with a registry                                                        | 03c                                                                    |
| **C4** | the whole API suite passes unchanged                                                                              | all                                                                    |
| **C5** | the boundary check is enforced for every module                                                                   | 03a (ops…accountability, plant/identity reads), 03b (tickets, imports) |
| **C6** | the isolation test discovers tenant tables from the catalogue and fails on any table not exercised as two tenants | 03c                                                                    |
| **C7** | the same test fails when a table outside D17's list exists (`ticket_tag` dated until 07)                          | 03c                                                                    |

## 3. Decisions (deviations from ARCHITECTURE are marked **D**; all accepted by the orchestrator)

1. **Three PRs.** A probe of 02's tool with the new owners finds ~60 statements in 19 files beyond the ten LEGACY
   files (`imports` writes `ticket`/`ticket_event`/`crew_member`; `accountability` locks `ticket`; `reports` reads
   `ticket`, `ticket_event`). Each of 03a/03b ends with LEGACY `{}` and full enforcement for the owners it adds.
2. **D — repo folder.** A module's SQL may be in `modules/<m>/repo.ts` **or** any file under `modules/<m>/repo/`
   (tickets' SQL is ~1,100 lines; the file budget is 400). SQL-heavy files move whole into `repo/`. The tool's error
   text stays `only apps/server/src/modules/<m>/repo.ts may` so 02's tests are unchanged.
3. **D — tenant argument.** New published reads take `tenantId` (ARCHITECTURE writes `machinesByIds(tx, ids)`) so
   each statement keeps today's explicit `tenant_id` filter on top of RLS.
4. **Manifest.** `apps/server/src/modules/manifest.ts` (pure data, no imports) holds `OWNERS`, `CALLS`,
   `EXCEPTIONS`; the tool imports it. `LEGACY` stays in the tool, ending `{}`.
5. **Direction = ARCHITECTURE's "May call" column** (`CALLS`, §4.4): acyclic, consistent with kernel < ops <
   identity < plant < files < notifications < tickets < accountability < reports < imports. Five dated
   `EXCEPTIONS`: three until 04, two (`imports → accountability`) until 09, the importer rewrite. `jobs` stops being
   one: the job runner moves into `accountability`; `app.ts`/`index.ts` (composition roots) may import any module
   index.
6. **Seed stays at `apps/server/src/seed/`** as a named unit `seed` (a composition root like `index.ts`): it may
   import `kernel/index.js` and module `index.js` files only; nothing in `kernel/` or `modules/` may import it.
   Rejected: per-owner `modules/<m>/seed.ts` — the seed is one transaction across identity, plant and tickets, and
   reads `cosmos-shifts.json`, `generated/`, `fixtures/` through `import.meta.url`, so splitting moves ~3,800 data
   lines and changes the `seed:cosmos` script. Hence **no** change to `package.json` `seed:cosmos`,
   `cosmos-seed.test.ts` or the seed import in `cosmos-plant.test.ts`. `seed/cosmos.ts:101-104` (`INSERT INTO
ref_counter`) goes behind tickets' `initRefCounters` in 03b, when `ref_counter` gets its owner.
7. **Writers keep their tables:** `ticket-report.ts` → tickets; `settings.ts` (SLA policies + criticality) →
   accountability (calls tickets and plant, both allowed); `file-store.ts` → files.
8. **Shifts:** `shiftWindows`/`shiftsOf` keep today's two statements byte for byte (the import path builds a map in
   heap order). `shiftAt` keeps ticket 08's `ORDER BY starts_at DESC` (18:29 belongs to the later shift).
9. **Workspace (measured on a copy):** `exports` maps, `@uptimo/domain` declared, and root `paths`, vitest aliases and
   esbuild aliases removed → `tsc` passes for the whole repo, `build:server` bundles, vitest resolves, `tsx` loads the
   app. `apps/web` imports no `@uptimo/*` package; web is not touched and no alias is kept.
10. **ESLint** core `no-restricted-imports` `regex` patterns per folder depth (§4.5) over `apps/server/src`; tests
    and `harness.ts` (relative `packages/db` import) are outside it. The tool checks the same plus module calls.
11. **Tests:** in 03a/03b the only edits to existing tests are import paths, except the LEGACY snapshot test
    (expectation shrinks to `[]`, its purpose). Moved files keep their `@uptimo/db` `withTenant` import.
12. **Order:** each published function lands in the commit of its first caller; `app.ts` loses each `register*`
    call in the commit that moves that registrar.

## 4. PR 03a — modules, workspace, plant/identity reads (C1, C2, C4, C5 part)

### 4.1 Moves (`git mv`, under `apps/server/src/`)

| Old                      | New                                                                     | Old                       | New                                                                                                                                                                                                                           |
| ------------------------ | ----------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `db.ts`                  | `kernel/db.ts`                                                          | `tickets.ts`              | `modules/tickets/routes.ts`                                                                                                                                                                                                   |
| `file-store.ts`          | `modules/files/store.ts`                                                | `ticket-list.ts`          | `modules/tickets/list.ts`                                                                                                                                                                                                     |
| `push.ts`                | `modules/notifications/routes.ts`                                       | `ticket-mapper.ts`        | `modules/tickets/mapper.ts`                                                                                                                                                                                                   |
| `reports.ts`             | `modules/reports/routes.ts`                                             | `ticket/severity.ts`      | `modules/tickets/severity.ts`                                                                                                                                                                                                 |
| `day-report.ts`          | `modules/reports/day-report.ts`                                         | `tags.ts`                 | `modules/tickets/tags.ts`                                                                                                                                                                                                     |
| `day-report-template.ts` | `modules/reports/day-report-template.ts`                                | `ticket-sql.ts`           | `modules/tickets/repo/ticket.ts`                                                                                                                                                                                              |
| `pdf.ts`                 | `modules/reports/pdf.ts`                                                | `ticket/events.ts`        | `modules/tickets/repo/events.ts`                                                                                                                                                                                              |
| `pdf-template.ts`        | `modules/reports/pdf-template.ts`                                       | `ticket-idempotency.ts`   | `modules/tickets/repo/idempotency.ts`                                                                                                                                                                                         |
| `ticket/sla.ts`          | `modules/accountability/sla.ts`                                         | `ticket-report.ts`        | `modules/tickets/repo/report.ts`                                                                                                                                                                                              |
| `sla-projection.ts`      | `modules/accountability/projection.ts`                                  | `tag-sql.ts`              | `modules/tickets/repo/tags.ts`                                                                                                                                                                                                |
| `settings.ts`            | `modules/accountability/routes.ts`                                      | `import/<f>.ts` (all 23)  | `modules/imports/<f>.ts`                                                                                                                                                                                                      |
| `jobs/index.ts`          | `modules/accountability/jobs.ts`                                        | `jobs/sla-consistency.ts` | `modules/accountability/consistency.ts`                                                                                                                                                                                       |
| `jobs/sla-timer.ts`      | `modules/accountability/repo/timers.ts`                                 | `jobs/sla-jobs.test.ts`   | `modules/accountability/test/sla-jobs.test.ts`                                                                                                                                                                                |
| `modules/plant/repo.ts`  | `modules/plant/repo/config.ts` (lines 1-136: `PlantRows` … `hasShifts`) | —                         | lines 138-287 (`NewMachine`, `NewListItem`, `NewShift`, `NewGlossaryTerm`, `insertSegments`, `insertMachines`, `insertListItems`, `insertShifts`, `insertSettings`, `insertGlossaryTerms`) → new `modules/plant/repo/seed.ts` |

**Deleted:** `auth.ts`, `session.ts`, `tenant.ts`, `config.ts`, `jobs/adapter.ts`. Root files left: `app.ts`,
`index.ts`; `seed/` unchanged.

**Import rewiring rule.** A relative import of a moved file takes the new path; one that crosses into another
module goes to that module's `index.js`; `AppConfig`, `jobDb`, `JobRole`, `JobsHandle`, `createPool`,
`loggerOptions` come from `kernel/index.js`. Settled cases: `tickets/routes.ts` → `../identity/index.js`
(requireAuth), `../../kernel/index.js`, `./mapper.js`, `./repo/ticket.js`, `./repo/idempotency.js`, `./list.js`,
`./repo/report.js`, `./severity.js`, `../accountability/index.js` (exception); `accountability/repo/timers.ts` →
`jobDb` from `../../../kernel/index.js`; `imports/cli.ts` → `createPool` from `../../kernel/index.js`,
`resolveTenant` from `../identity/index.js`, `startJobs, reconcileTicket` from `../accountability/index.js`;
`plant/service.ts` → `loadSlaPolicies` from `../accountability/index.js`, `loadPlantRows` from `./repo/config.js`;
`plant/routes.ts` → `./repo/config.js`; `reports/pdf-template.ts` → `type StoredReport` from `../tickets/index.js`;
`tools/import-bhavin.ts` → `../apps/server/src/modules/imports/cli.js`.
**Test import edits:** `../src/<old>` → `../src/<new>` per the table; `../src/session.js`, `../src/tenant.js` →
`../src/modules/identity/index.js` (auth, import-cli, import-commands, logging, tenant tests); `../src/config.js`,
`../src/jobs/adapter.js` → `../src/kernel/index.js` (health, sla-timers); `cosmos-plant.test.ts`'s
`../src/ticket-report.js` → `../src/modules/tickets/repo/report.js`; `sla-jobs.test.ts` → `../consistency.js`,
`../jobs.js`, `../repo/timers.js`. `logging.test.ts`'s `../src/kernel/logging.js` and every `seed/` import stay.

### 4.2 New and edited files

| File                                                                                                                 | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kernel/index.ts`                                                                                                    | add `export { createPool } from './db.js';` beside the existing exports (health, logging unchanged)                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `index.ts`                                                                                                           | `import { createPool, loggerOptions, type JobRole } from './kernel/index.js';` replaces the `./db.js`, `./kernel/logging.js` and `JobRole` imports; `startJobs`, `reconcileTicket`, `type SlaTicketReconciler` from `./modules/accountability/index.js`; nothing else                                                                                                                                                                                                                                                                                       |
| `app.ts`                                                                                                             | delete the five `register*` imports and calls (`registerSettings`, `registerTickets`, `registerReports`, `registerPush`, `registerTags`); `type AppConfig` from `./kernel/index.js`; `startJobs`, `reconcileTicket`, `type SlaTicketReconciler` from `./modules/accountability/index.js`. **Byte-identical:** the `Fastify({ logger, genReqId, logController })` block, the `onSend` x-request-id hook, `onClose`, the guard line (still before every route), `app.register(rateLimit…)`, `registerHealth(app, config)`, the module loop, the error handler |
| `modules/index.ts`                                                                                                   | `[opsModule, identityModule, plantModule, filesModule, notificationsModule, ticketsModule, accountabilityModule, reportsModule, importsModule]`                                                                                                                                                                                                                                                                                                                                                                                                             |
| `modules/manifest.ts` (new)                                                                                          | §4.4                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `modules/files/repo.ts` (new); `index.ts` (new)                                                                      | `NewFile`, `insertFileRow` moved verbatim from `store.ts` (imports `sha256` from `./store.js`), `fileIdForTickets`; index publishes `createLocalFileStore`, `pdfObjectKey`, `dayReportObjectKey`, `type ObjectStore`, `insertFileRow`, `fileIdForTickets`, `filesModule` (`register: () => undefined`)                                                                                                                                                                                                                                                      |
| `modules/notifications/repo.ts` (new); `routes.ts`; `index.ts` (new)                                                 | §4.3 statements; `personExists` deleted (uses `activePerson`); `notificationsModule` (`register: registerPush`)                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `modules/reports/machines.ts` (new); `day-report.ts`; `routes.ts`; `index.ts` (new)                                  | §4.3; `reportsModule` (`register: registerReports`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `modules/accountability/repo/policies.ts` (new); `sla.ts`; `routes.ts`; `index.ts` (new)                             | §4.3; index publishes `reconcileTicket`, `reconcileSlaPolicies`, `projectTicketSla`, `withSlaProjections`, `loadSlaPolicies`, `startJobs`, `type SlaTicketReconciler`, `accountabilityModule` (`register: registerSettings`)                                                                                                                                                                                                                                                                                                                                |
| `modules/tickets/repo/{ticket,report,tags}.ts`, `severity.ts`, `routes.ts`; `index.ts` (new)                         | §4.3; index publishes `loadEvents`, `reviveCorrection`, `lockRefCounter`, `loadSeverityMatrix`, `loadReport`, `type StoredReport`, `figuresFromRow`, `ticketsModule` (`register` calls `registerTickets` then `registerTags`)                                                                                                                                                                                                                                                                                                                               |
| `modules/imports/references.ts`, `undo.ts`; `index.ts` (new)                                                         | §4.3; `importsModule` (`register: () => undefined`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `modules/identity/repo.ts`, `index.ts`                                                                               | add and publish `activePerson`, `peopleByIds`, `activePeople`, `ensurePendingPerson`; `tenantInfo`'s return type widens to `{ name: string; language: string; time_zone: string }` (SQL unchanged)                                                                                                                                                                                                                                                                                                                                                          |
| `modules/plant/repo/reads.ts` (new); `index.ts`                                                                      | the published reads of §4.3; index re-exports from `./repo/config.js`, `./repo/seed.js`, `./repo/reads.js`                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `tools/check-boundaries.ts`, `tools/boundaries.test.ts`; `eslint.config.js`, `tools/eslint-boundaries.test.ts` (new) | §4.4, §4.5, §4.6                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `packages/{db,domain,shared}/package.json`; `apps/server/package.json`, `pnpm-lock.yaml`                             | add `"exports": { ".": "./src/index.ts" }`; add `"@uptimo/domain": "workspace:*"`, `pnpm install`                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `tsconfig.json`, `vitest.config.ts`, `scripts/build-server.ts`; `tools/workspace.test.ts` (new)                      | delete `compilerOptions.paths`; the three path constants and `resolve.alias`; the esbuild `alias`                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `apps/server/test/plant-repo.test.ts` (new)                                                                          | P1, P2                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

Not touched: `apps/web`, `kernel/health.ts`, `kernel/logging.ts`, `seed/`, migrations, `MILESTONES.md`, `ledger.md`,
`.github/`.

### 4.3 Published functions and the caller edits (`Db = Pick<PoolClient, 'query'>`; run in the caller's tx)

```ts
// identity/repo.ts
activePerson(tx: Db, tenantId: string, personId: string): Promise<{ id: string; name: string } | undefined>
//   SELECT id, name FROM person WHERE tenant_id = $1 AND id = $2 AND active
peopleByIds(tx: Db, tenantId: string, ids: readonly string[]): Promise<{ id: string; name: string }[]>
//   SELECT id, name FROM person WHERE tenant_id = $1 AND id = ANY($2::uuid[])
activePeople(tx: Db, tenantId: string): Promise<{ id: string; name: string }[]>   // references.ts:153 verbatim
ensurePendingPerson(tx: Db, tenantId: string, name: string): Promise<string>      // references.ts:184 INSERT verbatim; rows[0].id
// plant/repo/reads.ts
interface MachineRow { id: string; code: string; category: string | null; cell: string | null; criticality: Criticality | null }
machinesByIds(tx: Db, tenantId: string, ids: readonly string[], lock?: 'share'): Promise<MachineRow[]>
//   `SELECT id, code, category, cell, criticality FROM machine WHERE tenant_id = $1 AND id = ANY($2::uuid[]) ORDER BY id${lock === 'share' ? ' FOR SHARE' : ''}`
activeMachineByCode(tx: Db, tenantId: string, code: string): Promise<MachineRow[]>  // references.ts:138 verbatim, ['active'] as $3
setting(tx: Db, tenantId: string, key: string): Promise<unknown>  // SELECT value FROM setting WHERE tenant_id = $1 AND key = $2 → rows[0]?.value
listItem(tx: Db, tenantId: string, list: string, code: string): Promise<{ is_vendor: boolean; pauses_sla: boolean } | undefined>
//   SELECT is_vendor, pauses_sla FROM list_item WHERE tenant_id = $1 AND list = $2 AND code = $3
activeListItems(tx: Db, tenantId: string, lists: readonly string[]): Promise<Record<string, unknown>[]>  // references.ts:78
listItemsOf(tx: Db, tenantId: string, lists: readonly string[], only: string | null): Promise<Record<string, unknown>[]>  // tag-sql.ts:25
listItemOf(tx: Db, tenantId: string, id: string, lists: readonly string[]): Promise<Record<string, unknown> | undefined> // tag-sql.ts:52
listItemsByIds(tx: Db, tenantId: string, ids: readonly string[], lists: readonly string[]): Promise<Record<string, unknown>[]>
//   SELECT id, list, code, label, label_gu, label_hi, active, sort FROM list_item
//   WHERE tenant_id = $1 AND id = ANY($2::uuid[]) ORDER BY array_position($3::text[], list), sort, code
shiftWindows(tx: Db): Promise<Record<string, unknown>[]>                // ticket/sla.ts:34 verbatim
shiftsOf(tx: Db, tenantId: string): Promise<Record<string, unknown>[]>  // references.ts:112 verbatim
shiftCodeAt(tx: Db, timeZone: string | null, at: Date): Promise<string | undefined>  // rows[0]?.code, params [timeZone, at]
//   WITH local_time AS (SELECT ($2::timestamptz AT TIME ZONE $1)::time AS t) SELECT code FROM shift, local_time
//   WHERE (NOT crosses_midnight AND t >= starts_at AND t < ends_at) OR (crosses_midnight AND (t >= starts_at OR t < ends_at))
//   ORDER BY starts_at DESC LIMIT 1
// files/repo.ts
fileIdForTickets(tx: Db, tenantId: string, ticketIds: readonly string[]): Promise<string | undefined>
//   SELECT id FROM file WHERE tenant_id = $1 AND ticket_id = ANY($2::uuid[]) LIMIT 1
```

Caller edits (results byte-identical; line numbers re-checked on the merged tree):

- **`reports/machines.ts`** `withMachines(tx, tenantId, rows: Record<string, unknown>[])`: unique non-null
  `row.machine_id` strings; none → no query; else `machinesByIds` → map; returns
  `rows.map((row) => ({ ...row, machine_code: m?.code ?? null, machine_category: m?.category ?? null, machine_cell: m?.cell ?? null }))`.
- **`day-report.ts`**: in `JOBS_SQL` and `PENDING_SQL` delete the three `m.… AS machine_…` items and the
  `LEFT JOIN machine m …` line, add `t.machine_id` after `t.machine_snapshot`; `queryJobs`/`queryPending` wrap rows
  in `withMachines`. `loadDayReport`: tenant → `tenantInfo(client, query.tenantId)`, person →
  `activePerson(client, query.tenantId, query.personId)`; both `if (!…) return null` stay.
- **`reports/routes.ts`**: same `TICKET_SQL` edit; row → `(await withMachines(client, tenantId, rows))[0]`; tenant →
  `tenantInfo`; `personNames` → `peopleByIds`.
- **`tickets/repo/report.ts`**: `tenantDate`: `const zone = (await tenantInfo(client, tenantId))?.time_zone ?? null;`
  then `SELECT (now() AT TIME ZONE $1)::date::text AS today` with `[zone]`. `shiftAt(client, tenantId, at)` stays
  exported with body `const zone = …same…; return (await shiftCodeAt(client, zone, at)) ?? '1';`. `assertPeople`:
  `(await peopleByIds(client, tenantId, unique)).length !== unique.length`.
- **`tickets/repo/tags.ts`**: `listCatalogue` → `listItemsOf(client, tenantId, TAG_CATEGORIES, category ?? null)`;
  `findDefinition` → `listItemOf(…, itemId, TAG_CATEGORIES)`; `loadTicketTags`: assignments = `SELECT item_id,
applied_at, applied_by_login_id, applied_by_person_id FROM ticket_tag WHERE tenant_id = $1 AND ticket_id = $2`;
  items = `listItemsByIds(…, item_ids, TAG_CATEGORIES)` (none when empty); `applied` and `tags` built in item order,
  each item paired with its assignment by `item_id`, today's mappers.
- **`tickets/severity.ts`**: `const value = await setting(client, tenantId, 'severity_matrix'); if (!value) return
defaultSeverityMatrix;` then parse `value`; `machineCriticality` → `(await machinesByIds(client, tenantId,
[machineId]))[0]?.criticality ?? null`.
- **`tickets/repo/ticket.ts`**: `personExists` → `Boolean(await activePerson(client, tenantId, personId))`;
  `waitReasonSlaFlags` → `const row = await listItem(client, tenantId, 'wait_reason', reasonCode);`.
- **`tickets/routes.ts:191-196`**: machine → `(await machinesByIds(client, tx.tenantId, [tx.body.machineId as string], 'share'))[0]`.
- **`accountability/sla.ts`**: `loadCalendar` → `(await tenantInfo(client, tenantId)).time_zone`, `shiftWindows(client)`;
  policy query (`:93`) → `tenantPolicies`; `slaPolicyDto`, `loadSlaPolicies` move to `repo/policies.ts`.
- **`accountability/routes.ts`**: the INSERT in `upsertSlaPolicies` (`:56`) → `upsertPolicy(client, tenantId, policy)`;
  `before` (`:108`) → `currentPolicies(client)`.
- **`accountability/repo/policies.ts`**: `tenantPolicies(tx, tenantId): Promise<SlaPolicy[]>`, `currentPolicies(tx)`,
  `upsertPolicy(tx, tenantId, policy)`, `slaPolicyDto`, `loadSlaPolicies` (SQL verbatim).
- **`notifications/repo.ts`**: `subscriptionsOfLogin(tx, tenantId, loginId)` (push.ts:76), `upsertSubscription(tx,
s: { tenantId; loginId; actingPersonId; endpoint; keys: string; role })` (push.ts:118; caller passes
  `JSON.stringify(subscription.keys)`), `deleteSubscription(tx, tenantId, endpoint)` (push.ts:155),
  `subscriptionsOfPerson(pool: Pool, personId)` (push.ts:199); `routes.ts` person check →
  `Boolean(await activePerson(client, auth.tenantId, actingPersonId))`.
- **`imports/references.ts`**: `loadLists` → `activeListItems(ctx.client, ctx.tenantId, [...LISTS])`; `loadShifts` →
  `shiftsOf`; `loadMachine` → `activeMachineByCode` (`length !== 1` check stays); `loadPeople` → `activePeople`,
  `ensurePendingPerson(ctx.client, ctx.tenantId, name)`. **`imports/undo.ts:122-126`** → `const fileId = await
fileIdForTickets(client, tenantId, ticketIds); if (fileId) throw new Error(`Undo refused: ticket file reference ${fileId}`);`.

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
export interface CallException { file: string; module: string; until: string } // file: repo-relative
export const EXCEPTIONS: readonly CallException[] = [/* the five rows below, in order */];

// tools/check-boundaries.ts — table names in SQL text (replaces 02's single regex)
const NAME = String.raw`(?:only\s+)?(?:lateral\s+)?(?:"?[a-z_][a-z0-9_]*"?\s*\.\s*)?"?([a-z_][a-z0-9_]*)"?`;
const AFTER_KEYWORD = new RegExp(String.raw`\b(?:join|into|update)\s+${NAME}`, 'gi');
const FROM_LIST = /\bfrom\s+([^;()]*?)(?=\b(?:where|join|on|group|order|limit|union|returning|set|having|for|using|window)\b|[;()]|$)/gi;
const FROM_ITEM = new RegExp(String.raw`^\s*${NAME}`, 'i');
// tablesNamed(sql): AFTER_KEYWORD captures + each FROM_LIST capture split(','), FROM_ITEM capture per item;
// lower-cased, unique, sorted.
```

| `EXCEPTIONS` file (`apps/server/src/modules/…`) | module         | until                                   |
| ----------------------------------------------- | -------------- | --------------------------------------- |
| `plant/service.ts`                              | accountability | ticket 04: SLA policies leave `/config` |
| `tickets/routes.ts`                             | accountability | ticket 04: `sla` reply part             |
| `tickets/list.ts`                               | accountability | ticket 04: `sla` reply part             |
| `imports/bhavin.ts`                             | accountability | ticket 09: importer rewrite             |
| `imports/cli.ts`                                | accountability | ticket 09: importer rewrite             |

The tool keeps `SERVER_SRC`, `sqlLiterals`, `serverFiles`, `Baseline`, `LEGACY` (`{}` at the end of 03a) and
`boundaryErrors(root, legacy = LEGACY)` with **today's signature and messages** (02's tests stay byte-identical);
`OWNERS` is re-exported from the manifest. Changes inside `boundaryErrors`: `tablesNamed` above; a file may name its
owner's table if it is `modules/<owner>/repo.ts` or under `modules/<owner>/repo/`. A missing LEGACY file still yields
the stale error (unchanged). **New:** `importErrors(root, exceptions = EXCEPTIONS): string[]` (files sorted, imports
in source order) and `main()` prints both lists (exit 1 if either is non-empty). Functions < 60 lines, file < 400.

- `unitOf(file)`: `kernel` (under `kernel/`), `seed` (under `seed/`), module `<m>` (under `modules/<m>/`), `root`
  (`app.ts`, `index.ts`, `modules/index.ts`, `modules/manifest.ts`), else `legacy`.
- Imports read: every `ImportDeclaration`/`ExportDeclaration` with a specifier starting `.` (type-only included),
  resolved against the file's folder, `.js` → `.ts`. `S` = `apps/server/src`. Messages:
  - legacy file: `${file}: legacy path; move it into kernel/, modules/<name>/ or seed/`
  - module folder not in `CALLS`: `${file}: module ${m} is not in the manifest`
  - target is legacy: `${file}: imports legacy path ${target}`
  - another unit's non-index file: `${file}: imports ${target}; ${unit} is reached only through ${S}/kernel/index.ts`
    (kernel) or `… ${m} is reached only through ${S}/modules/${m}/index.ts` (module)
  - kernel importing a module, seed or root: `${file}: the kernel imports no module (${target})`
  - module importing root or seed: `${file}: a module may not import ${target}`
  - module `s` importing module `t` ∉ `CALLS[s]`, no exception: `${file}: ${s} may not call ${t} (${target})`
  - exception whose file is missing or no longer imports `module` (for each such row, after all files):
    `${exception.file}: EXCEPTIONS lists ${module} but the file no longer imports it; remove it`

### 4.5 ESLint (`eslint.config.js`, after the `**/*.ts` block)

| `files`                            | `no-restricted-imports` `patterns[].regex` (message: "only through index.js" / "leaves apps/server/src") |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `apps/server/src/*.ts`             | `^\.\./`; `^\./(?:kernel\|modules/[^/]+)/(?!index\.js$)`                                                 |
| `apps/server/src/kernel/*.ts`      | `^\.\./`                                                                                                 |
| `apps/server/src/seed/*.ts`        | `^\.\./(?!(?:kernel\|modules/[^/]+)/index\.js$)`                                                         |
| `apps/server/src/modules/*.ts`     | `^\.\./(?!kernel/index\.js$)`; `^\./[^/]+/(?!index\.js$)`                                                |
| `apps/server/src/modules/*/*.ts`   | `^\.\./\.\./(?!kernel/index\.js$)`; `^\.\./[^./][^/]*/(?!index\.js$)`                                    |
| `apps/server/src/modules/*/*/*.ts` | `^\.\./\.\./\.\./(?!kernel/index\.js$)`; `^\.\./\.\./[^./][^/]*/(?!index\.js$)`                          |

(`\|` is table escaping for `|`.)

### 4.6 Tests (Given / When / Then; red first unless marked guard)

**`tools/boundaries.test.ts`** (DB-free). 02's tests at lines 19, 40, 60, 70, 78, 87, 98 are unchanged (same
fixtures, `boundaryErrors(root, {})`, same expected arrays). Line 23 changes:

1. **"keeps the LEGACY baseline empty, so no file may break the rule"**: `expect(Object.keys(LEGACY)).toEqual([])`.
   Each 03a commit shrinks the list it checks (task table §4.7); the final commit makes it `[]`.

New (`plant(files)` as today; `S` = `apps/server/src`; every new import test passes `exceptions = []` unless stated):

2. **B8 "names a table in every FROM form"** (`it.each`): `${S}/modules/reports/x.ts` containing one of
   `'SELECT 1 FROM widget w, person p'`, `'SELECT 1 FROM public.person'`, `'SELECT 1 FROM "person"'`,
   `'SELECT 1 FROM ONLY person'`, `'SELECT 1 FROM widget w JOIN LATERAL person p ON true'`,
   `'SELECT 1 FROM widget w, LATERAL (SELECT 1) x, "public"."person" y'` → `boundaryErrors(root, {})` equals
   `[`${S}/modules/reports/x.ts: SQL names person (owned by identity); only ${S}/modules/identity/repo.ts may`]`.
3. **B9 "allows the owner's repo/ folder"**: `${S}/modules/plant/repo/x.ts` = `q('SELECT 1 FROM machine');` → `[]`;
   `${S}/modules/tickets/repo/x.ts` with the same text → `[`${S}/modules/tickets/repo/x.ts: SQL names machine (owned by plant); only ${S}/modules/plant/repo.ts may`]`.
4. **B10 "fails a non-index import of another module"**: `${S}/modules/reports/a.ts` = `import { x } from '../plant/repo.js';`
   → `importErrors(root, [])` equals `[`${S}/modules/reports/a.ts: imports ${S}/modules/plant/repo.ts; plant is reached only through ${S}/modules/plant/index.ts`]`; same for `import type { X } from '../plant/repo.js';`.
5. **B11 "fails a kernel-internal import"**: `${S}/modules/plant/a.ts` = `import { g } from '../../kernel/guard.js';` →
   `[`${S}/modules/plant/a.ts: imports ${S}/kernel/guard.ts; kernel is reached only through ${S}/kernel/index.ts`]`.
6. **B12 "fails a legacy path"** (two roots): `${S}/tickets.ts` = `export const x = 1;` →
   `[`${S}/tickets.ts: legacy path; move it into kernel/, modules/<name>/ or seed/`]`; `${S}/modules/plant/a.ts` =
   `import '../../auth.js';` → `[`${S}/modules/plant/a.ts: imports legacy path ${S}/auth.ts`]`.
7. **B13 "fails a call the manifest does not allow"**: `${S}/modules/plant/a.ts` = `import { x } from '../tickets/index.js';`
   → `[`${S}/modules/plant/a.ts: plant may not call tickets (${S}/modules/tickets/index.ts)`]`; with
   `[{ file: `${S}/modules/plant/a.ts`, module: 'tickets', until: 't' }]` → `[]`; that exception with
   `a.ts` = `export {};` → `[`${S}/modules/plant/a.ts: EXCEPTIONS lists tickets but the file no longer imports it; remove it`]`; with no `a.ts` at all → the same message.
8. **B14 "the kernel imports no module"**: `${S}/kernel/a.ts` = `import { m } from '../modules/plant/index.js';` →
   `[`${S}/kernel/a.ts: the kernel imports no module (${S}/modules/plant/index.ts)`]`.
9. **B15 "a module folder missing from the manifest fails"**: `${S}/modules/zzz/index.ts` = `export {};` →
   `[`${S}/modules/zzz/index.ts: module zzz is not in the manifest`]`.
10. **B16 "seed reaches modules only through their index"**: `${S}/seed/a.ts` = `import { x } from '../modules/plant/index.js';` → `[]`;
    `'../modules/plant/repo/config.js'` → `[`${S}/seed/a.ts: imports ${S}/modules/plant/repo/config.ts; plant is reached only through ${S}/modules/plant/index.ts`]`;
    `${S}/modules/plant/a.ts` = `import '../../seed/cosmos.js';` → `[`${S}/modules/plant/a.ts: a module may not import ${S}/seed/cosmos.ts`]`.
11. **B17 "EXCEPTIONS is the dated list"** (shrink-only snapshot): `EXCEPTIONS.map((e) => `${e.file} -> ${e.module}`)`
    equals the five rows of §4.4 with the `apps/server/src/modules/` prefix.
12. **B18 "the server tree's imports pass"**: `importErrors(process.cwd())` equals `[]` (02's tree test covers SQL).

**`tools/eslint-boundaries.test.ts`** — `lint(filePath, code)` = `(await new ESLint({ cwd: process.cwd() }).lintText(code, { filePath }))[0].messages.filter((m) => m.ruleId === 'no-restricted-imports').length`.

13. **E1 `it('forbids another module's non-index file')`**: `apps/server/src/modules/reports/a.ts` +
    `import { x } from '../plant/repo.js';` → 1; `'../plant/index.js'` → 0.
14. **E2 `it('forbids leaving apps/server/src and kernel internals')`**: same path + `'../../../../packages/db/src/index.js'` → 1;
    `'../../kernel/guard.js'` → 1; `'../../kernel/index.js'` → 0.
15. **E3 `it('applies at repo/ depth')`**: `apps/server/src/modules/tickets/repo/a.ts` + `'../../plant/repo.js'` → 1;
    `'../ticket.js'` → 0; `'../../plant/index.js'` → 0.
16. **E4 `it('guards the root, kernel and seed')`**: `apps/server/src/app.ts` + `'./modules/tickets/routes.js'` → 1;
    `apps/server/src/kernel/a.ts` + `'../modules/plant/index.js'` → 1; `apps/server/src/seed/a.ts` + `'../modules/plant/repo/config.js'` → 1, `'../modules/plant/index.js'` → 0.

**`tools/workspace.test.ts`**:

17. **W1 `it('gives every package an exports map')`**: `packages/{db,domain,shared}/package.json` `exports['.'] === './src/index.ts'`.
18. **W2 `it('declares every @uptimo import of the server')`**: every `@uptimo/<name>` imported in `apps/server/src/**/*.ts`
    is a `workspace:*` dependency in `apps/server/package.json` (red today: `@uptimo/domain`).
19. **W3 `it('resolves packages without aliases')`**: `tsconfig.json` has no `compilerOptions.paths`; `vitest.config.ts`
    and `scripts/build-server.ts` contain no `alias`.

**`apps/server/test/plant-repo.test.ts`** (`describe('plant machinesByIds')`; `import { machinesByIds } from '../src/modules/plant/index.js'`;
`T = '40000000-0000-4000-8000-000000000001'`, `M = '40000000-0000-4000-8000-000000000002'`; `beforeAll`:
`startTestDb()`, admin `INSERT INTO tenant (id, slug, name) VALUES ($1, 'lock-test', 'Lock Test')` and
`INSERT INTO machine (id, tenant_id, code, criticality) VALUES ($1, $2, 'LOCK-1', 'A')`; `afterAll`: `db.stop()`):

20. **P1 `it('returns the machine row')`**: `withTenant(db.app, T, (c) => machinesByIds(c, T, [M]))` →
    `[{ id: M, code: 'LOCK-1', category: null, cell: null, criticality: 'A' }]`.
21. **P2 `it('holds a share lock until commit')`**: inside `withTenant(db.app, T, …)` after `machinesByIds(c, T, [M], 'share')`,
    a separate `db.admin.connect()` client runs `SET lock_timeout = '300ms'` then `UPDATE machine SET code = code WHERE id = $1`
    → rejects `/lock timeout/`; the same without `'share'` resolves (proves `tickets.ts:193`'s `FOR SHARE`).

### 4.7 Tasks (one commit each; typecheck and the whole suite green after each)

| #   | Commit                                                                                                                                                                                                                                                                                                                                      | LEGACY snapshot after |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 1   | W1–W3 red → exports, server deps, lockfile, aliases removed                                                                                                                                                                                                                                                                                 | 10 files              |
| 2   | `kernel/db.ts` move; `index.ts` (§4.2), `import/cli.ts` take kernel exports; plant repo split into `repo/config.ts` + `repo/seed.ts`                                                                                                                                                                                                        | 10                    |
| 3   | files + notifications moves, repos, indexes, manifest list, `app.ts` drops `registerPush`; `activePerson`                                                                                                                                                                                                                                   | 9 (no `push.ts`)      |
| 4   | P1, P2 red → reports moves, `machines.ts`, `peopleByIds`, `machinesByIds`                                                                                                                                                                                                                                                                   | 7                     |
| 5   | accountability moves, `repo/policies.ts`, `sla.ts`, `index.ts`/`app.ts` imports, `sla-jobs.test.ts` move                                                                                                                                                                                                                                    | 6                     |
| 6   | tickets moves and edits (biggest move)                                                                                                                                                                                                                                                                                                      | 1                     |
| 7   | imports moves, `references.ts`, `undo.ts` (second biggest)                                                                                                                                                                                                                                                                                  | 0                     |
| 8   | B8–B18 red → manifest, tool, OWNERS for files/notifications/accountability/reports; shims deleted, test imports; E1–E4 red → ESLint                                                                                                                                                                                                         | 0                     |
| 9   | `changes/81-module-boundaries-contract.md`: "Server code is grouped into nine modules, each reached only through its index; `pnpm boundaries` and lint fail a crossing."; `wiki/log.md` line; `docs/HANDOFF.md` Guards bullet (`pnpm boundaries`: owners, calls and dated exceptions in `apps/server/src/modules/manifest.ts`); §8 evidence | —                     |

## 5. PR 03b — `tickets` and `imports` own their tables (C5 complete)

Each statement moves to the named function, SQL verbatim from the cited line of the 03a tree (lines cited are from
`main` today; find the statement by its text). Arguments are its `$n` values in order, one object when more than
three; returns what the caller used (`rows` typed `QueryResult['rows']`, `rows[0]`, an id, a count). Functions are
published through `modules/tickets/index.ts` when called from another module.

| From                                                                                                                 | Function (file)                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accountability/sla.ts:52`, `:87`                                                                                    | `ticketEventRows(tx, ticketIds)`, `slaTicketRows(tx, tenantId, ticketIds)` (`tickets/repo/sla.ts`)                                                                                                                                                                                                    |
| `sla.ts:197`, `repo/timers.ts:201`, `:244`                                                                           | `lockTicket(tx, tenantId, ticketId): Promise<boolean>` (`rowCount === 1`)                                                                                                                                                                                                                             |
| `sla.ts:234`, `:249`; `consistency.ts:26`                                                                            | `setSlaPolicyId(tx, tenantId, ticketId, policyId)`, `slaCandidateIds(tx, tenantId): Promise<string[]>`, `slaConsistencyIds(tx, tenantId): Promise<string[]>` (caller returns `.length`)                                                                                                               |
| `accountability/routes.ts:149-164` (matrix load → `UPDATE … UNNEST`)                                                 | `refreshMachineSeverity(tx, { tenantId, machineId, criticality })` in `tickets/severity.ts`; statements in `tickets/repo/severity.ts`: `machineTicketsForUpdate(tx, tenantId, machineId)`, `setSeverities(tx, { ids, severities, tenantId })`                                                         |
| `reports/day-report.ts` `JOBS_SQL`, `PENDING_SQL`; `reports/routes.ts` `TICKET_SQL`, `:184`                          | `dayJobRows(tx, { tenantId, personId, start, end })`, `pendingRows(tx, tenantId, end)`, `pdfTicketRow(tx, tenantId, ticketId)`, `setReportPdf(tx, { fileId, payload, reportId, tenantId })` (`tickets/repo/history.ts`)                                                                               |
| `tickets/routes.ts:201`, `:335`; `tickets/list.ts:66`, `:94-124`, `:192-206`, `:222`                                 | `openDuplicateId`, `openTicketRows`, `segmentRowsFor`, `selectTicketPage(tx, tenantId, filters)` (+ `ListFilters`), `needReportRows(tx, tenantId, actingPersonId, role)`, `ticketRowById` (`tickets/repo/list.ts`)                                                                                    |
| `imports/counters.ts:19`, `:23`, `:52`                                                                               | `refCounterRows`, `ticketRefsLike(tx, tenantId, pattern)`, `raiseRefCounter(tx, { tenantId, prefix, next })` (`tickets/repo/imported.ts`)                                                                                                                                                             |
| `imports/identity.ts:87`, `parents.ts:139`, `:177`                                                                   | `ticketParents(tx, tenantId)` (identity.ts text; parents only builds maps), `setParent(tx, { tenantId, childId, parentId })`                                                                                                                                                                          |
| `imports/identity.ts:100`                                                                                            | split: `provenanceRows(tx, tenantId, contract)` (`imports/repo.ts`, same SQL minus `t.ref` and the `LEFT JOIN ticket`) + `refsByIds(tx, tenantId, ids): Promise<Map<string, string>>` (`SELECT id, ref FROM ticket WHERE tenant_id = $1 AND id = ANY($2::uuid[])`); `ref = refs.get(ticket_id) ?? ''` |
| `imports/insert.ts:179`, `:193`, `:225`, `:249`; `insert-reports.ts:29`, `:15`                                       | `insertImportedTicket(tx, columns, values): Promise<string>`, `insertImportedEvent`, `insertImportedCrew`, `insertImportedSegment`, `insertImportedReport(tx, values): Promise<string>`, `insertReportPerson` (each `(tx, values)` = today's array)                                                   |
| `imports/fingerprint-sql.ts` `loadTicketRows`, `queryChildren`                                                       | `importedTicketRows(tx, { tenantId, ticketIds, columns, lock })`, `importedChildren(tx, tenantId, ticketIds)` (bodies verbatim)                                                                                                                                                                       |
| `imports/undo.ts:117`, `:128`, `:142` + `:146`                                                                       | `outsideChildRef`, `reportWithFileId`, `deleteImportedTickets(tx, tenantId, ids): Promise<number \| null>`                                                                                                                                                                                            |
| `seed/cosmos.ts:101-104`                                                                                             | `initRefCounters(tx, tenantId)` (`tickets/repo/seed.ts`, SQL verbatim), published                                                                                                                                                                                                                     |
| `imports/batch.ts:53`, `:76`; `bhavin.ts:145`, `:153`, `:163`, `:295`; `fingerprint-sql.ts:50`; `undo.ts:71`, `:161` | `imports/repo.ts`: `insertBatch`, `failBatch`, `updateImportRow`, `insertPendingRow`, `insertErrorRow`, `finishBatch`, `importedRowRows`, `lockBatchRow`, `markUndone`                                                                                                                                |

Savepoints, the advisory lock and `SHOW TIME ZONE` name no table and stay. Test: **B19 `it('gives every current
table exactly one owner')`**: each of the 28 D17 tables (§6.2) and `ticket_tag` is in exactly one `OWNERS` list —
red until `OWNERS` gains `tickets` and `imports`.

| #   | Commit                                                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–4 | accountability; reports; tickets-internal; imports + seed statements (one commit each)                                                                                       |
| 5   | B19 red → OWNERS `tickets`, `imports`; `changes/81-module-boundaries-ticket-tables.md`: "Ticket and import tables are touched only by their own module."; `wiki/log.md` line |

## 6. PR 03c — domain registries and the isolation catalogue (self-contained)

**Goal (C3, C6, C7).** Each ticket command and each permission area is its own file behind a registry, with
`@uptimo/domain`'s public API unchanged; the isolation test finds every tenant table from the database catalogue,
proves each is seen by two tenants, and fails when any table outside D17's 40-table list exists. No server code,
no migration, no seed change. Branch from `main`; touches only `packages/domain` and `packages/db/test`.

**Facts it rests on.** `seed.sql` already has `breakdown_report_person` rows for both tenants (lines 78-80); only the
hand list `TENANT_TABLES` (isolation.test.ts:8-36) misses it, so `seed.sql` is not edited. D17's "28 today" = the
29 tables the migrations create minus `ticket_tag`. pg-boss lives in schema `pgboss`; migrations are applied
directly, so `schema_migration` does not exist in this test; the check scans `public` only.
`D17_TABLES` (40) = `audit_log, breakdown_report, breakdown_report_person, command_idempotency, crew_member, file,
glossary_term, import_batch, import_row, list_item, login, machine, machine_group, machine_move, person,
platform_access, push_subscription, ref_counter, segment, session, setting, shift, sla_policy, sla_timer, tenant,
ticket, ticket_event, work_segment` + `roster_entry, escalation_rule, notification, kpi_snapshot, forecast,
intervention, pm_plan, asset_register, ai_suggestion, document, document_chunk, wa_message`;
`DATED_TABLES = { ticket_tag: 'ticket 07 drops it' }`.

### 6.1 Files

| File                                                       | Change                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/domain/src/state/commands/<f>.ts` (15 new)       | one function each, body verbatim: `start`, `pause`, `resume`, `transfer`, `update`, `machine-running` (`machineRunning`), `machine-stopped`, `close`, `cancel`, `join`, `leave`, `upgrade-kind`, `late-report` (from `state/commands.ts` 6-319), `restore` (`corrections.ts` 88-117), `correct` (118-195 with `CorrectResult`, `recordEdit`, `assertCorrectionTimeline`); imports only what the body uses |
| `…/state/commands/index.ts`, `registry.ts` (new)           | index: `export { start } from './start.js';` × 15; registry: the `handlers` map moved from `state.ts`, exported, not re-exported by `index.ts`                                                                                                                                                                                                                                                            |
| `…/state/past-breakdown.ts`, `…/state/limits.ts` (new)     | `PastBreakdownInput`, `recordPastBreakdown` (`corrections.ts` 17-86); `SEVEN_DAYS_MS` (not re-exported)                                                                                                                                                                                                                                                                                                   |
| `…/state.ts`                                               | `export * from './state/commands/index.js'; export * from './state/past-breakdown.js';` replace the `commands`/`corrections` lines; `import { handlers } from './state/commands/registry.js'`; `transition` unchanged                                                                                                                                                                                     |
| `…/state/commands.ts`, `…/state/corrections.ts`            | deleted                                                                                                                                                                                                                                                                                                                                                                                                   |
| `…/permissions/ticket.ts`, `views.ts`, `settings.ts` (new) | ticket: `WORK_ROLES`, `isOwn`, `isLeadOrPrimary`, `canRaise`, `canCancel`, `canWork`, `canClose`, `canLateReport`, `canRestore`, `canCorrect`; views: `canDayReport`, `canLiveBoard`, `canMoney`, `canAnalytics`; settings: `HEAD_ADMIN`, `canSettingsLists`, `canSettingsPeople`, `canSettingsSla`                                                                                                       |
| `…/permissions.ts`                                         | the registry: three `export *` lines (keeps `test/permissions.test.ts`'s import path)                                                                                                                                                                                                                                                                                                                     |
| `packages/domain/test/registry.test.ts` (new)              | D1–D3                                                                                                                                                                                                                                                                                                                                                                                                     |
| `packages/db/test/isolation.test.ts`                       | `TENANT_TABLES` deleted; `tenantTables`, `allTables`, `rowProblems`, `budgetProblems`, `D17_TABLES`, `DATED_TABLES`; I1–I3; the RLS, unset-tenant and count tests use `tenantTables`                                                                                                                                                                                                                      |

### 6.2 Tests

1. **D1 `it('has one file per command and a registry entry for each')`** (red first): `readdirSync('packages/domain/src/state/commands').sort()`
   equals the 15 file names above + `index.ts`, `registry.ts`; `Object.keys(handlers).sort()` equals the 15 command types.
2. **D2 `it('keeps the public API')`** (guard, green before and after): `Object.keys(await import('../src/index.js')).sort()`
   equals `SlaInputError, TransitionError, addBusinessMinutes, apply, assertWorking, businessMinutesBetween, canAnalytics, canCancel, canClose, canCorrect, canDayReport, canLateReport, canLiveBoard, canMoney, canRaise, canRestore, canSettingsLists, canSettingsPeople, canSettingsSla, canWork, cancel, clampAt, close, closeSegments, computeSeverity, correct, defaultSeverityMatrix, figures, join, lastEventAt, lateReport, leave, machineRunning, machineStopped, nextRef, nextSeq, pause, projectSlaTimers, raiseTicket, recordPastBreakdown, remainingSlaMinutes, restore, resume, slaBreached, start, transfer, transition, update, upgradeKind` (49).
3. **D3 `it('has one permissions file per area')`** (red first): `readdirSync('packages/domain/src/permissions').sort()`
   equals `['settings.ts', 'ticket.ts', 'views.ts']`.
4. **I3 `it('catches a planted table outside D17 and not seen by two tenants')`** — **the recorded red-first proof**:
   Given `RESET ROLE; BEGIN; CREATE TABLE stray_widget (id uuid PRIMARY KEY, tenant_id uuid NOT NULL); GRANT SELECT ON stray_widget TO app_user`,
   When `budgetProblems(await allTables())` runs, discovery runs, then `SET LOCAL ROLE app_user` and `rowProblems(['stray_widget'])`,
   Then `["stray_widget: not in D17's table list"]`, discovery contains `stray_widget`, and the row problems are
   `stray_widget as ${A}: 0 rows`, `stray_widget as ${B}: 0 rows`; `finally`: `ROLLBACK; SET ROLE app_user`.
5. **I1 `it('discovers every tenant table and sees each as both tenants')`** (guard): `tenantTables` (filled in
   `beforeAll` after the seed by `SELECT c.relname FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','p') AND a.attname = 'tenant_id' AND NOT a.attisdropped ORDER BY 1`)
   contains `breakdown_report_person`, and `rowProblems(tenantTables)` is `[]` (`rowProblems` sets each of `A`, `B`
   and returns `${table} as ${tenant}: ${n} rows` for each count ≠ 1).
6. **I2 `it('has no table outside D17')`** (guard): `D17_TABLES` has length 40; `budgetProblems(await allTables())`
   is `[]` (`allTables` = the catalogue query without the attribute join; a name not in `D17_TABLES` or
   `DATED_TABLES` → `${t}: not in D17's table list`).

Regression: `pnpm exec vitest run packages` (Docker) green; every other domain and db test file unchanged.
Tasks: (1) D1, D2 → commands; (2) D3 → permissions; (3) I3 red → I1, I2, `TENANT_TABLES` gone;
(4) `changes/81-domain-registries-isolation.md`: "Ticket commands and permissions are one file each, and the
isolation test finds every tenant table itself and fails on a table outside the 40-table budget."; `wiki/log.md`.

## 7. Regression for 03a and 03b (runs, not new tests)

1. **R1** after every task: `pnpm exec vitest run` (Docker) green, including `cosmos-plant` (guards the 18:29 overlap
   through `shiftAt`), `cosmos-seed`, `health`, `logging`, `guard`, `day-report`, `ticket-pdf`, `tags`, `push`,
   `ticket-severity`, `sla-timers`, `sla-policies`, `settings`, the import suites and the moved `sla-jobs`; test-file
   count equal before and after; `git diff -U0 origin/main -- apps/server/test 'apps/server/src/**/*.test.ts'` shows
   only `import`/`from` lines, the LEGACY snapshot test and the new files.
2. **R2** `pnpm boundaries` exits 0; planting `export const x = 'SELECT 1 FROM widget w, person p';` in
   `modules/reports/routes.ts` exits 1 naming it (paste both in §8).
3. **R3** `pnpm verify` and `pnpm test:e2e` green (e2e starts `apps/server/src/index.ts` with `tsx`).

## 8. Out of scope, risks, evidence

**Out of scope:** reply parts, `route()`, shared contracts, the 04 exceptions (04) and the 09 ones (09); deleting tags
(06); dropping `ticket_tag` (07); splitting logic from SQL inside `repo/` files; any migration, web, infra or seed
data change; ARCHITECTURE rule 7's `now`.

**Risks and their catch:** split joins (day report, PDF, tags, import provenance) → R1; `FOR SHARE` → P2; route
registration order (find-my-way is order-independent; `guard.test.ts` "the route table sees every registrar");
`/config` fingerprint (plant service untouched apart from imports) → `settings.test.ts`; resolution without aliases →
R3; 03a is the largest PR (~1 hour of mostly `git mv` and path edits; tasks 6 and 7 are the risk); 03c and 03a both
touch nothing in common.

**Not verified here:** the Docker suite and e2e (no Docker in planning). Line numbers re-checked on the merged tree
(`ticket-report.ts` is the only cited file 08/13 changed; it is cited by function name).

**Evidence (03a, builder):** red then green: W1-W3 (3 failed, then 3 passed), B9 (red, then green in task 2), P1/P2
(`machinesByIds is not a function`, then 2 passed), B8-B18 (19 failed with E1-E4, then 26 + 4 passed). R1: `pnpm exec
vitest run apps/server packages tools` 61 files, 562 tests passed; test-file diff against `origin/main` is import lines
plus the new files. R2: `pnpm boundaries` exits 0 (81 files, 0 problems); planting `export const x = 'SELECT 1 FROM
widget w, person p';` in `modules/reports/routes.ts` exits 1 with `apps/server/src/modules/reports/routes.ts: SQL names
person (owned by identity); only apps/server/src/modules/identity/repo.ts may`. R3 (`pnpm verify`, `pnpm test:e2e`): CI.

No product question for Nimish: nothing a user sees changes.
