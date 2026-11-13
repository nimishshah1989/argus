# 04 — One contract, reply parts

Issue: [#82](https://github.com/nimishshah1989/argus/issues/82) · Milestone M0 · Blocked by: 03 (merged) · Branch
`claude/t04-one-contract`. One PR, labels `no-parity` (nothing a user sees changes) and `size:large` (the contract,
its enforcement and the web type switch must land together; the golden fixture is under `fixtures/` and not
counted). The PR body contains `Closes #82`.

**Status: plan-review findings 1-7 applied (orchestrator ruling); ready to build.** One product question (§10) does not block the build. The technical deviations
from ARCHITECTURE are marked **D** in §2 and need the orchestrator's acceptance.

## 1. Goal

Server and web read one typed contract, so a reply that drifts from it fails a test, and the SLA clock reaches a
ticket reply from `accountability` without `tickets` knowing about it. Nothing a user sees changes.

| Label   | Ticket text (MILESTONES "04")                                                                                     |
| ------- | ----------------------------------------------------------------------------------------------------------------- |
| **G1**  | Every route's reply parses with its shared Zod schema; a missing or extra field fails the route test              |
| **G1w** | `api-types.ts` and the domain DTO copies are deleted and web types are `z.infer`                                  |
| **G2**  | `/state` is byte-identical for a fixed ticket set while SLA arrives as the `sla` reply part from `accountability` |
| **G2b** | `tickets` imports no higher module                                                                                |

**Two readings of "SLA data leaves the ticket reply"** (MILESTONES 04 "Delivers"): (a) SLA stops being part of what
`tickets` builds, and arrives as a part `accountability` contributes; (b) SLA fields disappear from replies. Chosen: **(a)**
(ticket item 2: byte-identical `/state`, `sla` as a contributed part). Likewise `slaPolicies` stays in `/config` as a
config part contributed by `accountability`. "SLA policies leave /config" (the old manifest exception text) is
**deferred** by the orchestrator and noted in the PR body.

## 2. Decisions (technical)

1. **Schemas live in `packages/shared`, one contract file per module**, reached by a new wildcard subpath export
   `"./*": "./src/*.ts"` (Node's subpath pattern; the explicit `"."` and `"./i18n"` keys win over it). New files are
   **not** added to the `index.ts` barrel; reply schemas added to files already in the barrel (`auth.ts`,
   `config.ts`, `error.ts`, `sla.ts`, `ticket.ts`) reach it automatically. **D:** ARCHITECTURE §4 removes the
   barrel; removing it rewrites every server import and is left to a later mechanical change.
2. **Strict replies.** Every reply object schema is `.strict()` (an unknown key fails), nested objects included.
   Every field the server sends today is **required** unless the server omits it today (`cancelledAt`,
   `figures.overridden`), so a missing key fails. **Field types follow today's web declaration** (for example
   `role: z.string()`, `severity: … .nullable()`), widened only where the server really sends more: `Ticket.
raisedLoginId` is `string | null` (the column is nullable; `state.test.ts` seeds such tickets).
3. **Enforcement without editing route tests.** `kernel/reply-check.ts` adds a Fastify `onSend` hook that parses
   every JSON reply of a matched route against `REPLY_SCHEMAS` and, on a mismatch, replaces the reply with `500`
   and `apiError('internal', 'Reply contract: ' + problem)`, with `problem` as defined in §4.3 (one format). `app.ts` registers it only when
   `process.env.CHECK_REPLIES === '1'`; `vitest.config.ts` sets that for the whole test run, so all 18 server test
   files that call `buildApp` check every reply. Production is unchanged (no parse, no new failure mode).
   **D:** ARCHITECTURE §4 names a kernel `route()` that parses and replies through the schema; that wrapper is not
   built here. Rejected: wrapping `app.inject` in `harness.ts` (no test builds the app there; every file would be
   edited); parsing in production (a strict mismatch would turn into a user-facing 500).
4. **What the check accepts**: a reply passes when it matches its route's schema, or when its status is ≥ 400
   and it matches `errorBodySchema`. `/health`'s 503 `{status:'down',db,queue}` is part of its own schema.
   The one binary route (`GET /api/v1/reports/day.pdf`) maps to `null`: their bytes are not JSON and are not checked; their JSON errors
   are. HEAD requests, non-JSON content types and requests answered by the not-found handler (`request.is404`
   or no `routeOptions.url`) are not checked.
5. **Reply parts in the kernel (D11).** `kernel/reply-parts.ts` holds two tiny registries keyed by name:
   ticket parts (batch `load` for reads, `afterWrite` for a ticket write) and config parts. `accountability`
   contributes `sla` (ticket) and `slaPolicies` (config) inside its `register`. `tickets` and `plant` call the
   kernel; neither imports `accountability`. Output is unchanged byte for byte: the part's value is spread after
   the projection exactly where `sla`/`slaPolicies` are spread today.
   **D:** D11 says write reactions go through a `ticket.changed` event; here the SLA reconcile rides on the part's
   `afterWrite`, which also returns `{ slaPolicyId, sla }` for the command reply (keeps the reply identical and
   adds no event bus with one subscriber). **D:** ARCHITECTURE §2 names a `replyParts` field on `defineModule`;
   here the module calls `contributeTicketPart` in `register` (no `ModuleDefinition` change). Both are revisited
   when `handback` (M2) becomes the second contributor.
6. **Golden `/state`** is captured from today's `main` **before** any refactor (commit 1), on a fixed fake ticket
   set in its own tenant, with only the JS clock frozen (`vi.useFakeTimers({ toFake: ['Date'] })`) for the one
   request. No field is normalised.
7. **Domain DTO copies** become type re-exports from `@uptimo/shared` (`packages/domain` → `shared` is a types-only
   dependency, ARCHITECTURE §2 table): `Criticality`, `Severity`, `SeverityMatrix`, `SlaPolicy`, `SlaTimerState`.
   The server's `CommandAction` copy in `tickets/mapper.ts` becomes a re-export of the new shared one. Kept, with
   reason: `StoredReport` (server row type with `submittedAt: Date`, used by the PDF templates; its wire form is the
   new `storedReportSchema`), `ConfigPayload` (plant's own part of `/config`, minus `slaPolicies`), `ShareTicket`
   (input type of `shareText`, not a reply).
8. **Web is type-only.** `apps/web` gets no `zod` dependency and no runtime parsing: shared exports
   `type X = z.infer<typeof xSchema>` next to each schema, and `apps/web/src/api.ts` re-exports them under today's
   names, so no screen file changes. `apps/web` already declares `@uptimo/shared: workspace:*` and resolves
   `@uptimo/shared/i18n` in Vite, Vitest and `tsc` (ticket 05); no alias is added. `ShareButton.tsx`'s relative
   `packages/shared/src/share.js` import is left as is.

## 3. Files

**Shared (`packages/shared`)**

| File                  | Change                                                                                                                                                                                                                                                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`        | `exports` gains `"./*": "./src/*.ts"`.                                                                                                                                                                                                                                                                                                                    |
| `src/error.ts`        | `errorCodeSchema` (the eight codes), `errorBodySchema`; `ErrorCode`, `ErrorBody` become `z.infer` (the hand-written interface is deleted). `apiError` unchanged.                                                                                                                                                                                          |
| `src/auth.ts`         | Add `userSchema`, `loginReplySchema`, `meReplySchema`, `brandReplySchema`; type `User`.                                                                                                                                                                                                                                                                   |
| `src/config.ts`       | Add `listItemSchema`, `segmentSchema`, `groupSchema`, `machineSchema`, `personSchema`, `shiftSchema`, `severityMatrixReplySchema`, `plantConfigSchema`, `settingRowSchema`, `listRowSchema`, `missingTranslationSchema`; types `ListItem`, `Segment`, `Group`, `Machine`, `Person`, `Shift`. `severityMatrixSchema` (request) unchanged. About 150 lines. |
| `src/sla.ts`          | `slaTimerSchema` and `slaProjectionSchema` gain `.strict()` (reply-only schemas). `slaPolicySchema` and the update schema unchanged.                                                                                                                                                                                                                      |
| `src/ticket.ts`       | Add `COMMAND_ACTIONS` (the 15 actions, `as const`, today's order in `COMMAND_SCHEMAS`) and `type CommandAction`.                                                                                                                                                                                                                                          |
| `src/push.ts`         | New (notifications contract): `pushKeyReplySchema`, `pushSentReplySchema`.                                                                                                                                                                                                                                                                                |
| `src/ticket-reply.ts` | New (tickets reply contract, about 120 lines): `isoDateTimeSchema`, `ticketKindSchema`, `ticketStatusSchema`, `closeKindSchema`, `figuresSchema`, `ticketSchema`, `ticketEventSchema`, `ticketPersonSchema`, `ticketIntervalSchema`, `storedReportSchema` and their types (§4.1).                                                                         |
| `src/replies.ts`      | New (about 130 lines): the composed replies (`ticketReplySchema` = ticket + `sla` part, `configReplySchema` = plant config + `slaPolicies` part + `fp`), `okReplySchema`, `healthReplySchema`, `REPLY_SCHEMAS`, re-export of `errorBodySchema` (§4.1).                                                                                                    |

**Server (`apps/server`)**

| File                                       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/kernel/reply-parts.ts`                | New. §4.2.                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `src/kernel/reply-check.ts`                | New. `replyProblem`, `registerReplyCheck` (§4.3).                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `src/kernel/index.ts`                      | Export everything public from the two new files.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/app.ts`                               | Import `registerReplyCheck` from `./kernel/index.js`; one line `if (process.env.CHECK_REPLIES === '1') registerReplyCheck(app);` directly after the `x-request-id` `onSend` hook (before the guard and every route). Nothing else changes.                                                                                                                                                                                                                               |
| `src/modules/accountability/parts.ts`      | New. `slaTicketPart`, `slaPoliciesPart` (§4.2).                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `src/modules/accountability/projection.ts` | **Deleted** (`withSlaProjections` is replaced by the kernel's `withTicketParts`).                                                                                                                                                                                                                                                                                                                                                                                        |
| `src/modules/accountability/index.ts`      | Drop the `projectTicketSla`, `withSlaProjections` and `loadSlaPolicies` exports (no caller outside the module is left); `register` becomes `(app, config) => { registerSettings(app, config); contributeTicketPart(slaTicketPart); contributeConfigPart(slaPoliciesPart); }`.                                                                                                                                                                                            |
| `src/modules/tickets/routes.ts`            | Delete the `../accountability/index.js` import. `executeCommand`: lines 107-117 become `const parts = await ticketPartsAfterWrite(client, { tenantId: tx.tenantId, ticketId: tx.ticketId, now: new Date(), boss });` and `body: { ticket: { ...tm.ticketProjection(result.ticket, loaded.extras), ...parts } }`. `executeRaise`: same with `ticketId: raised.ticket.id, now`. `state`: `withSlaProjections(` → `withTicketParts(`. Imports from `../../kernel/index.js`. |
| `src/modules/tickets/list.ts`              | Delete the accountability import. `queryList` and `listNeedReport`: `withSlaProjections(` → `withTicketParts(`. `detail`: the `ticket` field becomes `(await withTicketParts(client, ctx.tenantId, [row], () => tm.ticketProjection(ticket, tm.rowExtras(row))))[0]`.                                                                                                                                                                                                    |
| `src/modules/tickets/mapper.ts`            | The `CommandAction` union is replaced by `export type { CommandAction } from '@uptimo/shared';`.                                                                                                                                                                                                                                                                                                                                                                         |
| `src/modules/plant/service.ts`             | Delete the accountability import and its comment; `ConfigPayload` loses `slaPolicies` (and the `SlaPolicy` import); `loadConfig` returns `Promise<ConfigPayload & Record<string, unknown>>`, drops `loadSlaPolicies`, and ends `return { …today's ten fields in today's order…, ...(await configParts(client, tenantId)) };`.                                                                                                                                            |
| `src/modules/manifest.ts`                  | Delete the three `EXCEPTIONS` entries whose `until` starts `ticket 04` (`plant/service.ts`, `tickets/routes.ts`, `tickets/list.ts`). Add none.                                                                                                                                                                                                                                                                                                                           |
| `vitest.config.ts` (root)                  | `test.env: { CHECK_REPLIES: '1' }`.                                                                                                                                                                                                                                                                                                                                                                                                                                      |

**Domain (`packages/domain`)**

| File             | Change                                                                                                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`   | `"dependencies": { "@uptimo/shared": "workspace:*" }`; `pnpm install --offline` updates only the `packages/domain` importer in `pnpm-lock.yaml`.                                             |
| `src/types.ts`   | Lines 115-122 (`Criticality`, `Severity`, `SeverityMatrix`) → `export type { Criticality, Severity, SeverityMatrix } from '@uptimo/shared';`. `TicketContext.raisedLoginId: string \| null`. |
| `src/sla.ts`     | Delete `SlaTimerState` and `interface SlaPolicy`; add `import type { SlaPolicy, SlaTimerState } from '@uptimo/shared';` and `export type { SlaPolicy, SlaTimerState };`.                     |
| `src/actions.ts` | `ActionTicket.raisedLoginId: string \| null` (decision 2; `isOwn` compares with `===`, so `null` never matches).                                                                             |

**Web (`apps/web`)**

| File                                 | Change                                                                                                                                               |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/api-types.ts`                   | **Deleted.**                                                                                                                                         |
| `src/api.ts`                         | Lines 3-18 (import from `./api-types.js`) and 180-181 (`export type *`) replaced by the block in §4.4. About 265 lines after (warn 250, budget 400). |
| `src/components/actionSpecs.test.ts` | The `ticket()` fixture gains the 22 keys of §4.5 (no assertion changes).                                                                             |
| `src/screens/desk/views.test.ts`     | Same 22 keys in its `ticket()` fixture.                                                                                                              |
| `src/screens/board/data.test.ts`     | `segment` gains `sort: 0, show_on_board: true, group_by: 'letters'`; `group` gains `sort: 0, hidden: false`.                                         |
| `e2e/sla-test-helpers.ts`            | `import type { ListItem } from '../src/api-types.js'` → `'../src/api.js'`.                                                                           |

If `pnpm typecheck` reports an error in any other web file, the coder stops and returns to the planner.

**Tests and fixtures**

| File                                          | Change                                                                                 |
| --------------------------------------------- | -------------------------------------------------------------------------------------- |
| `apps/server/test/fixtures/state-golden.ts`   | New. `seedGolden(admin, passwordHash)` and constants (§5.2).                           |
| `apps/server/test/fixtures/state-golden.json` | New. Today's `/state` body for the golden tenant, pretty-printed (§5.2).               |
| `apps/server/test/state.test.ts`              | `get(url, token, host = 'cosmos.localhost')`; `beforeAll` also calls `seedGolden`; S1. |
| `apps/server/test/reply-contract.test.ts`     | New. R1–R6.                                                                            |
| `apps/server/test/reply-parts.test.ts`        | New. P1, P2.                                                                           |
| `apps/server/test/settings.test.ts`           | New case R7.                                                                           |
| `tools/boundaries.test.ts`                    | B1: the pinned exception list shrinks to the two `imports` rows.                       |
| `tools/workspace.test.ts`                     | X1, X2.                                                                                |

**Records:** `changes/82-one-contract-reply-parts.md` (§8), one line in `wiki/log.md`, top of `docs/HANDOFF.md`.
Not touched: `packages/db`, `migrations/`, `tools/check-migrations.ts`, `docs/plan/ledger.md`,
`docs/plan/MILESTONES.md` (row 04 is the orchestrator's), any `ai` module, any screen or copy.

## 4. Interfaces

### 4.1 Shared reply schemas (load-bearing)

Notation: every `z.object` below ends `.strict()`; `T?` = `.nullable()`; `opt` = `.optional()`;
`iso` = `isoDateTimeSchema` = `z.string().datetime({ offset: true })`; `str` = `z.string()`; `num` = `z.number()`;
`bool` = `z.boolean()`.

`error.ts`: `errorBodySchema = { error: { code: errorCodeSchema, message: str, field: str opt } }`.

`auth.ts`: `userSchema = { id: str, username: str, name: str, title: str?, role: str, shared: bool,
actingPersonId: str }` (every session has an acting person: login refuses without one, identity/routes.ts:63-75);
`loginReplySchema = { token: str, user: userSchema }`; `meReplySchema = { user: userSchema }`;
`brandReplySchema = { company: str, logo: z.null() }`.

`config.ts`:

| Schema                      | Fields                                                                                                                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `listItemSchema`            | `id, list, code, label: str; labelGu, labelHi: str?; sort: num; active, isVendor, pausesSla: bool; tag: str?`                                                                                             |
| `segmentSchema`             | `id, code, name: str; sort: num; show_on_board: bool; group_by: str`                                                                                                                                      |
| `groupSchema`               | `id, segment_id, code, name: str; sort: num; hidden: bool`                                                                                                                                                |
| `machineSchema`             | `id, code: str; category, cell, segment_id, group_id: str?; criticality: criticalitySchema?`                                                                                                              |
| `personSchema`              | `id, name, team: str; title: str?; active: bool; phone: str?`                                                                                                                                             |
| `shiftSchema`               | `id, code, name, starts_at, ends_at: str; crosses_midnight: bool`                                                                                                                                         |
| `severityMatrixReplySchema` | same shape as `severityMatrixSchema`, every level strict (the request schema stays non-strict so `PUT /settings/severity_matrix` is unchanged)                                                            |
| `plantConfigSchema`         | `features: z.record(bool); language, timeZone: str; lists: z.record(z.array(listItemSchema)); segments, groups, machines, people, shifts: arrays of the above; severityMatrix: severityMatrixReplySchema` |
| `settingRowSchema`          | `key: str; value: z.unknown()`                                                                                                                                                                            |
| `listRowSchema`             | `id, code, label: str; label_gu, label_hi: str?; sort: num; active, is_vendor, pauses_sla: bool; tag: str?`                                                                                               |
| `missingTranslationSchema`  | `id, list, code, label: str; label_gu, label_hi: str?`                                                                                                                                                    |

`push.ts`: `pushKeyReplySchema = { publicKey: str }`; `pushSentReplySchema = { sent: num }`.

`ticket-reply.ts`:

- `ticketKindSchema = z.enum(['stopped','support','general'])` (`TicketKind`); `ticketStatusSchema` = the five
  statuses (`TicketStatus`); `closeKindSchema = z.enum(['report','no_report','done'])` (`CloseKind`).
- `figuresSchema` (`Figures`): `responseMin: num?; activeMin, waitMin, vendorMin, handoverWaitMin, downAccMin: num;
downtimeMin, followMin: num?; repairMin: num; perPerson: z.record(num); overridden: z.array(z.enum(['responseMin',
'activeMin','waitMin','downtimeMin','repairMin'])) opt`.
- `ticketSchema` (no `sla`; the 47 keys `ticketProjection` emits): `id, ref, problem: str; kind: ticketKindSchema;
status: ticketStatusSchema; machineId, reportedByPersonId, leadPersonId, transferToPersonId, transferToShift,
waitReason, assignedToPersonId, closedByPersonId, closeNote, taskReason, taskExpectedOn, slaPolicyId, location,
workType, problemLang, reportedByRole, parentId, waitingSpare, raisedLoginId: str?; reportedAt: iso; startedAt,
segmentStartedAt, handoverSince, waitSince, machineRunningAt, machineStoppedAt, closedAt, kindUpgradedAt,
expectedBackAt: iso?; cancelledAt: iso opt; selfStarted, handedOver, urgent: bool; transfers, lastEventSeq: num;
taskDownMin: num?; closeKind: closeKindSchema?; figures: figuresSchema?; severity: severitySchema?;
criticalitySnapshot: criticalitySchema?; raisedChannel: str; machineSnapshot: { code, category, cell, id: str? opt;
criticality: criticalitySchema? opt }?`.
- `ticketEventSchema` (`TicketEvent`): `seq: num; type: str; at: iso; text, reason, actingPersonId, loginId: str?;
isVendor: bool`. `ticketPersonSchema` (`TicketPerson`): `personId, role: str; leftAt: iso?; leftReason: str?`.
  `ticketIntervalSchema` (`TicketInterval`): `personId, role: str; startedAt: iso; endedAt: iso?`.
- `storedReportSchema` (`BreakdownReport`): `id, machineId, date, shiftCode, problem: str; ticketId, observedBy,
correctiveAction, breakdownCategory, maintCode, spareUsed, rootCause, handoverName, submittedByPersonId: str?;
downtimeMin: num; responseMin, repairMin: num?; submittedAt: iso; people: z.array({ personId: str; role:
z.enum(['done','supported']) })`.

`replies.ts`:

```ts
export const pdfFileReplySchema = z.object({ fileId: z.string(), url: z.string() }).strict();
export const okReplySchema = z.object({ ok: z.literal(true) }).strict();
export const healthReplySchema = z.union([
  z.object({ status: z.literal('ok') }).strict(),
  z.object({ status: z.literal('down'), db: z.boolean(), queue: z.boolean() }).strict(),
]);
/** A ticket as every reply carries it: tickets' fields, then accountability's `sla` part. */
export const ticketReplySchema = ticketSchema
  .extend({ sla: slaProjectionSchema.nullable() })
  .strict();
export const stateReplySchema = z
  .object({
    open: z.array(ticketReplySchema),
    needReport: z.array(ticketReplySchema),
    now: isoDateTimeSchema,
  })
  .strict();
export const ticketPageSchema = z
  .object({ items: z.array(ticketReplySchema), nextCursor: z.string().nullable() })
  .strict();
export const commandReplySchema = z.object({ ticket: ticketReplySchema }).strict();
export const ticketDetailSchema = z
  .object({
    ticket: ticketReplySchema,
    events: z.array(ticketEventSchema),
    people: z.array(ticketPersonSchema),
    tasks: z.array(z.never()),
    intervals: z.array(ticketIntervalSchema),
    report: storedReportSchema.nullable(),
  })
  .strict();
/** `/config`: plant's fields, then accountability's `slaPolicies` part, then the fingerprint. */
export const configReplySchema = plantConfigSchema
  .extend({ slaPolicies: z.array(slaPolicySchema.strict()), fp: z.string() })
  .strict();
export const configSameSchema = z.object({ same: z.literal(true), fp: z.string() }).strict();
export { errorBodySchema } from './error.js';
export type Ticket = z.infer<typeof ticketReplySchema>; // also State, TicketPage, CommandReply, TicketDetail, Config
/** `METHOD /fastify/url` → schema of a non-error reply; `null` = binary success body. */
export const REPLY_SCHEMAS: Readonly<Record<string, z.ZodTypeAny | null>>;
```

`REPLY_SCHEMAS` has exactly these 41 keys:

| Key                                                                                                                                                                                                                                                                                                                                   | Schema                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `GET /api/v1/health`                                                                                                                                                                                                                                                                                                                  | `healthReplySchema`                                                                          |
| `GET /api/v1/brand` · `POST /api/v1/auth/login` · `GET /api/v1/auth/me`                                                                                                                                                                                                                                                               | `brandReplySchema` · `loginReplySchema` · `meReplySchema`                                    |
| `POST /api/v1/auth/logout`, `POST /api/v1/auth/password`, `PUT /api/v1/settings/:key`, `PUT /api/v1/settings/sla-policies`, `PUT /api/v1/machines/:id/criticality`, `PUT /api/v1/lists/:list/:code`, `DELETE /api/v1/lists/:list/:id`, `PUT /api/v1/translations/:id`, `POST /api/v1/push/subscribe`, `POST /api/v1/push/unsubscribe` | `okReplySchema`                                                                              |
| `GET /api/v1/config`                                                                                                                                                                                                                                                                                                                  | `z.union([configReplySchema, configSameSchema])`                                             |
| `GET /api/v1/settings` · `GET /api/v1/lists/:list` · `GET /api/v1/translations/missing`                                                                                                                                                                                                                                               | `z.array(settingRowSchema)` · `z.array(listRowSchema)` · `z.array(missingTranslationSchema)` |
| `GET /api/v1/push/key` · `POST /api/v1/push/test`                                                                                                                                                                                                                                                                                     | `pushKeyReplySchema` · `pushSentReplySchema`                                                 |
| `POST /api/v1/tickets` and `POST /api/v1/tickets/:id/<action>` for each of `COMMAND_ACTIONS` (15)                                                                                                                                                                                                                                     | `commandReplySchema`                                                                         |
| `GET /api/v1/tickets` · `GET /api/v1/state` · `GET /api/v1/tickets/:id`                                                                                                                                                                                                                                                               | `ticketPageSchema` · `stateReplySchema` · `ticketDetailSchema`                               |
| `GET /api/v1/tickets/:id/pdf` · `GET /api/v1/reports/day.pdf`                                                                                                                                                                                                                                                                         | `pdfFileReplySchema` (`{ fileId: str, url: str }`, JSON) · `null` (binary)                   |

### 4.2 Kernel reply parts and the SLA parts

```ts
// apps/server/src/kernel/reply-parts.ts (imports only types from 'pg' and 'pg-boss')
export interface TicketWrite {
  tenantId: string;
  ticketId: string;
  now: Date;
  boss?: PgBoss;
}
export interface TicketPart {
  /** The reply key this part owns, e.g. 'sla'. */
  readonly name: string;
  /** One batch read for every ticket in the reply (never per ticket). */
  load(
    client: PoolClient,
    tenantId: string,
    ticketIds: string[],
    now: Date,
  ): Promise<Map<string, unknown>>;
  /** Inside a ticket write's transaction, after the row is stored: react, then return the fields for that reply. */
  afterWrite(client: PoolClient, write: TicketWrite): Promise<Record<string, unknown>>;
}
export interface ConfigPart {
  readonly name: string;
  load(client: PoolClient, tenantId: string): Promise<unknown>;
}
export function contributeTicketPart(part: TicketPart): void; // module-level Map by name; same name replaces (one app per test file builds several apps)
export function contributeConfigPart(part: ConfigPart): void;
/** `project(row)` then each part's value under its name (`?? null`), parts in contribution order; `now = new Date()` once per call. */
export function withTicketParts(
  client: PoolClient,
  tenantId: string,
  rows: Record<string, unknown>[],
  project: (row: Record<string, unknown>) => Record<string, unknown>,
): Promise<Record<string, unknown>[]>;
/** Every part's `afterWrite`, merged in contribution order. */
export function ticketPartsAfterWrite(
  client: PoolClient,
  write: TicketWrite,
): Promise<Record<string, unknown>>;
/** `{ [part.name]: await part.load(client, tenantId) }` for every config part, in contribution order. */
export function configParts(client: PoolClient, tenantId: string): Promise<Record<string, unknown>>;
```

```ts
// apps/server/src/modules/accountability/parts.ts
export const slaTicketPart: TicketPart = {
  name: 'sla',
  load: (client, tenantId, ids, now) => loadSlaProjections(client, tenantId, ids, now),
  afterWrite: async (client, write) => ({
    slaPolicyId: await reconcileTicket(client, write),
    sla: await projectTicketSla(client, write.tenantId, write.ticketId, write.now),
  }),
};
export const slaPoliciesPart: ConfigPart = {
  name: 'slaPolicies',
  load: (client) => loadSlaPolicies(client),
};
```

Byte-identity, by construction: `withSlaProjections` was `{ ...project(row), sla: slas.get(id) ?? null }` with
`new Date()`; `withTicketParts` is the same with one part. A command reply was `{ ...projection, slaPolicyId, sla }`
and is `{ ...projection, ...{ slaPolicyId, sla } }`; `slaPolicyId` already sits inside the projection, so its
position is unchanged and `sla` stays last. `/config` keeps `slaPolicies` after `severityMatrix`, and `fp` is still
computed over the same object. The detail's `projectTicketSla(…, new Date())` and `loadSlaProjections(…, [id], new
Date())` run the same projection. One accepted difference: a command's SLA projection now uses the reconcile's
`now` instead of a second `new Date()` taken microseconds later.

### 4.3 Reply check

```ts
// apps/server/src/kernel/reply-check.ts
/** Why a JSON reply breaks the contract (route, status, failing paths), or null. Decision 4's rules. */
export function replyProblem(route: string, status: number, body: unknown): string | null;
/** onSend: checks JSON replies of matched routes; a problem becomes 500 + apiError('internal', `Reply contract: ${problem}`). */
export function registerReplyCheck(app: FastifyInstance): void;
```

The hook runs only when the reply's `content-type` starts with `application/json`; the payload is a string and is
`JSON.parse`d (a Buffer or stream payload is skipped, never checked). On a problem the hook sets `reply.code(500)`, the
content-type to `application/json; charset=utf-8`, and returns `JSON.stringify(apiError('internal', 'Reply contract: ' + problem))`.
The one message format is `` `${route} ${status}: ${issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}` ``.

`replyProblem`: no key in `REPLY_SCHEMAS` → `"<route> has no reply schema"`; status ≥ 400 and a valid error body →
`null`; schema `null` → `"<route> is binary but sent JSON"`; otherwise `schema.safeParse(body)` → `null` or
`"<route> <status>: <path> <message>; …"` from the Zod issues.

### 4.4 Web `api.ts` type block (replaces the `api-types` import and re-export)

```ts
import type { User } from '@uptimo/shared/auth';
import type {
  Criticality,
  Group,
  ListItem,
  Machine,
  Person,
  Segment,
  Severity,
  SeverityMatrix,
  Shift,
} from '@uptimo/shared/config';
import type {
  CommandReply,
  Config,
  State,
  Ticket,
  TicketDetail,
  TicketPage,
} from '@uptimo/shared/replies';
import type { SlaPoliciesUpdate, SlaPolicy, SlaProjection, SlaTimer } from '@uptimo/shared/sla';
import type { BreakdownReportBody, CommandAction, RaiseTicketBody } from '@uptimo/shared/ticket';
import type {
  BreakdownReport,
  CloseKind,
  Figures,
  TicketEvent,
  TicketInterval,
  TicketKind,
  TicketPerson,
  TicketStatus,
} from '@uptimo/shared/ticket-reply';

export type {
  BreakdownReport,
  BreakdownReportBody,
  CloseKind,
  CommandAction,
  Config,
  Criticality,
  Figures,
  Group,
  ListItem,
  Machine,
  Person,
  RaiseTicketBody,
  Segment,
  Severity,
  SeverityMatrix,
  Shift,
  SlaPoliciesUpdate,
  SlaPolicy,
  SlaProjection,
  SlaTimer,
  State,
  Ticket,
  TicketDetail,
  TicketEvent,
  TicketInterval,
  TicketPage,
  TicketPerson,
  TicketStatus,
};
export type RaiseKind = TicketKind;
export type Me = User;
export type BreakdownCategory = NonNullable<BreakdownReportBody['breakdownCategory']>;
export type CommandResult = CommandReply | { queued: true; id: string };
```

`CorrectChanges`, `TicketListQuery` and `CommandBody` move into `api.ts` verbatim from `api-types.ts` lines 229-231 (`CorrectChanges`), 241-251 (`TicketListQuery`) and 258-268
(`CommandBody`; lines 232-239 `RaiseTicketBody` and 253-256 `TicketPage` are NOT moved: the web `RaiseTicketBody` becomes
the shared `z.infer` type, which has a required `kind` and more optional fields, and no caller breaks because callers
already pass `kind`; `TicketPage` becomes the shared page type):
they are request builders the web sends, not replies, and the shared request schemas coerce dates to `Date`, so their
`z.infer` would not match what the web sends.

### 4.5 Web ticket fixture keys

Added to both `ticket()` builders: `selfStarted: false, segmentStartedAt: null, handoverSince: null,
transferToPersonId: null, transferToShift: null, transfers: 0, waitSince: null, assignedToPersonId: null,
machineStoppedAt: null, closedByPersonId: null, taskReason: null, taskExpectedOn: null, taskDownMin: null,
kindUpgradedAt: null, lastEventSeq: 0, problemLang: null, reportedByRole: null, raisedChannel: 'floor',
parentId: null, expectedBackAt: null, waitingSpare: null, sla: null`.

## 5. Data

**No schema change, no migration, no new table, nothing new written.** The reply fields are those of §4.1, read
from the same columns and functions as today (`TICKET_COLUMNS`, `loadPlantRows`, `listPeople`, `tenantInfo`,
`loadSlaPolicies`, `loadSlaProjections`, `ticket_event`, `crew_member`, `work_segment`, `breakdown_report`). The SLA
reconcile still writes `sla_timer` and `ticket.sla_policy_id` exactly as today, now reached through the part.

### 5.1 Reply fields no web screen reads (kept as-is; grep of `apps/web/src`, tests excluded)

| Reply                       | Fields with no web consumer                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ticket (all ticket replies) | `selfStarted`, `segmentStartedAt`, `handoverSince`, `transferToPersonId`, `transferToShift`, `transfers`, `waitSince`, `assignedToPersonId`, `machineStoppedAt`, `closedByPersonId`, `taskReason`, `taskExpectedOn`, `taskDownMin`, `kindUpgradedAt`, `lastEventSeq`, `problemLang`, `reportedByRole`, `raisedChannel`, `parentId`, `expectedBackAt`, `waitingSpare`, `slaPolicyId`; `figures.overridden` |
| `/tickets`                  | `nextCursor` (no screen pages)                                                                                                                                                                                                                                                                                                                                                                            |
| `/tickets/:id`              | `tasks` (always `[]`), `events[].loginId`, `people[].leftReason`, `report.submittedByPersonId`, `report.submittedAt`                                                                                                                                                                                                                                                                                      |
| `/config`                   | `features`, `fp` and the whole `{same, fp}` reply (the web never sends `?fp=`), `segments[].sort/show_on_board/group_by`, `groups[].sort/hidden`, `lists[][].list`, `people[].team/title/phone`                                                                                                                                                                                                           |
| `/brand`                    | `logo` (always `null`)                                                                                                                                                                                                                                                                                                                                                                                    |
| whole routes                | `POST /auth/logout`, `POST /auth/password`, `GET /settings`, `GET /lists/:list`, `GET /translations/missing`, `PUT /translations/:id`, `POST /push/test`                                                                                                                                                                                                                                                  |

### 5.2 Golden fixture (fake data only)

`apps/server/test/fixtures/state-golden.ts` exports `GOLDEN_HOST = 'golden.localhost'`, `GOLDEN_USER = 'ravi'`,
`GOLDEN_NOW = '2026-11-12T06:00:00.000Z'`, `GOLDEN_FILE` (URL of the JSON) and `seedGolden(admin: Pool,
passwordHash: string): Promise<void>`, which inserts with the superuser pool (ids `30000000-0000-0000-0000-0000000000NN`):

- tenant `01` slug `golden`, name `Golden Works`; person `02` `Ravi Test` (maintenance); login `03` `ravi`,
  `supervisor`, personal; machines `04` `GW-1` (VMC, Cell-A, A), `05` `GW-2` (HMC, Cell-B, B), `06` `GW-3` (Lathe,
  Cell-C, C); `sla_policy` `11`–`14` for S1–S4 with ack/restore minutes 15/120, 30/240, 60/480, 240/1440,
  `business_hours_only` false.
- five tickets, each with fixed `id`, `ref`, timestamps and its `ticket_event` rows (`seq`, `type`, `at`, `payload`);
  `sla_policy_id` is set to its severity's policy (so a background SLA reconcile writes the same value):
  `21` BD-9001 stopped **open** on GW-1, S1, reported 05:50 (`down`); `22` BD-9002 stopped **working** on GW-2, S2,
  reported 05:00, started 05:10 by Ravi as lead (`down`, `start`), `response_min` 10; `23` WR-9003 general urgent
  **waiting** (Store, Electrical), S3, reported 2026-11-11 22:00, started 22:30, paused 23:00 `spare` with
  `waiting_spare` 'Contactor' and `expected_back_at` 2026-11-13 06:00 (`down`, `start`, `pause` with payload
  `{"reason":"spare","pausesSla":true}`); `24` BD-9004 support **open** on GW-3, S3, `raised_channel` 'desk',
  reported 04:00 (ack breached at `GOLDEN_NOW`); `25` WR-9005 general **open** (Canteen, Civil), S4,
  `raised_channel` 'backfill', `raised_login_id` NULL, `sla_policy_id` NULL, reported 03:00 (`sla` is `null`).
  **Rule for every column not named:** it takes its default or NULL; `problem` = `Golden <ref>`; every `ticket_event` has
  `login_id` = login `03`, `acting_person_id` = person `02`, `text` = `Golden <ref>`, payload `{}` unless named;
  `reported_by_person_id` = person `02`; `self_started` false; `handed_over` false; `criticality_snapshot` = the machine's
  criticality (21 `A`, 22 `B`, 24 `C`, others NULL); `severity` as named; figure columns NULL except `response_min`.
  Ticket 23 is started by Ravi (lead = person `02`). All times 2026-11-12 UTC unless dated. Machine snapshots on 21, 22, 24 are `{code, category, cell, criticality}`.

The golden user sees no `no_report` ticket, so `needReport` is `[]` (its rows are filtered by Postgres `now()`,
which cannot be frozen; the same `withTicketParts` path is checked on every other `needReport` by the contract).
**Time handling:** the JS clock (`Date` only) is frozen at `GOLDEN_NOW` around the one `/state` request, which fixes
`now` and every `sla` value (`remainingMinutes`, `breached`, `state`). Nothing in the reply is normalised.

**The golden is captured first.** Commit 1 adds the fixture, S1 and the JSON, generated on unchanged `main` code by
`WRITE_GOLDEN=1 pnpm vitest run apps/server/test/state.test.ts` (S1 then writes
`JSON.stringify(JSON.parse(res.body), null, 2) + '\n'`), then `pnpm prettier --write` on the JSON. S1 compares
`res.body` with `JSON.stringify(JSON.parse(<file>))`, which is byte-exact (Fastify serialises with `JSON.stringify`;
parse and stringify keep key order) and immune to reformatting of the file.

## 6. Test cases

All fail first except those marked **guard** (they pass on today's code and must keep passing).

**G2 — `apps/server/test/state.test.ts`**

- **S1** `answers /state byte for byte as before` (**guard**, commit 1): Given the golden tenant seeded by
  `seedGolden` and `ravi` signed in on `golden.localhost`, when `GET /api/v1/state` runs with `Date` frozen at
  `GOLDEN_NOW`, then the status is 200 and `res.body` equals `JSON.stringify(JSON.parse(state-golden.json))`.

**G2b — `tools/boundaries.test.ts`**

- **B1** `lists the dated call exceptions, so they can only shrink`: Given the manifest, then `EXCEPTIONS` is exactly
  `imports/bhavin.ts -> accountability` and `imports/cli.ts -> accountability`. (Fails first: five rows today.)
- **B2** `passes the server tree's imports` (**guard**): the tree has no `tickets → accountability` or
  `plant → accountability` import and no stale exception; `pnpm boundaries` reports 0 problems.

**G2 — `apps/server/test/reply-parts.test.ts`** (no database; `{} as PoolClient`)

- **P1** `merges each part under its name after the projection`: Given a contributed part `fake` whose `load`
  returns `Map { 't1' → 'x' }`, when `withTicketParts(client, 'tenant', [{ id: 't1' }, { id: 't2' }], (row) =>
({ id: row.id, a: 1 }))`, then the result is `[{ id: 't1', a: 1, fake: 'x' }, { id: 't2', a: 1, fake: null }]`
  and `Object.keys` of the first is `['id', 'a', 'fake']`.
- **P1b** `keeps contribution order`: Given two parts `fake` then `fake2`, the keys of a merged row are
  `['id', 'a', 'fake', 'fake2']`.
- **P2** `returns the write fields of every part in order`: Given `fake`'s `afterWrite` returns `{ b: 2, fake: 'y' }`,
  when `ticketPartsAfterWrite(client, { tenantId, ticketId: 't1', now })`, then `{ b: 2, fake: 'y' }`, and its
  `afterWrite` received the same `client` and `write`.

- **P3** `a part contributed twice under one name is replaced`: Given `fake` contributed twice, the second `load`
  wins and the key `fake` appears once.

**G1 — `apps/server/test/reply-contract.test.ts`** (R1 uses `buildApp` with the fake pool and fake `jobBoss` of
`guard.test.ts`; R2–R5 call `replyProblem` on the golden JSON; R6 uses a bare `Fastify()`)

- **R1** `has a reply schema for every route`: Given the built app, when its `routeTable` minus `HEAD` is listed as
  `METHOD url`, then the sorted list equals the sorted keys of `REPLY_SCHEMAS` (41).
- **R2** `accepts today's /state reply`: Given the golden body, then `replyProblem('GET /api/v1/state', 200, body)`
  is `null`.
- **R3** `fails a reply with a missing field`: Given the golden body without `open[0].sla`, then the problem names
  `open.0.sla`; without `now`, it names `now`.
- **R4** `fails a reply with an extra field`: Given the golden body with `open[0].tags = []`, then the problem names
  `open.0` and `Unrecognized key`; with a top-level `version: 1`, it fails too.
- **R5** `accepts an error body only on an error status`: `replyProblem('GET /api/v1/state', 404, apiError(
'not_found', 'Unknown ticket'))` is `null`; the same body on 200 is a problem; `{ message: 'x' }` on 422 is a problem;
  `replyProblem('GET /api/v1/nope', 200, {})` says it has no reply schema.
- **R6** `turns a broken reply into a 500 and leaves good and binary replies alone`: Given a bare Fastify app with
  `registerReplyCheck` and three routes, when `GET /api/v1/brand` sends `{ company: 'Fake Co', logo: null, extra:
true }`, then 500 with `error.code` `internal` and a message starting `Reply contract:`; when it sends
  `{ company: 'Fake Co', logo: null }`, then 200 and that exact body; when `GET /api/v1/reports/day.pdf` sends a
  `Buffer` with `content-type: application/pdf`, then 200 and the same bytes.
- **R7** (**guard**: passes on today's code; it only pins the two routes no test reached, `apps/server/test/settings.test.ts`) `reads settings and a list in the shared shape`: Given `admin`, when
  `GET /api/v1/settings` and `GET /api/v1/lists/wait_reason`, then both are 200 (the only two JSON routes no test
  reaches today; the contract hook checks their shape) and the list has the two seeded codes `spare` and `vendor`.
- **R8** (**the whole suite**) every existing server test passes with `CHECK_REPLIES=1`, none edited except those in
  §3. A contract 500 in an existing test means §4.1 is wrong about a field: the coder stops and returns it, never
  loosens a schema or edits the server to fit.

**G1w — `tools/workspace.test.ts`, and the typecheck**

- **X1** `keeps no hand-written API types in the web`: Given `apps/web`, then `apps/web/src/api-types.ts` does not
  exist, no file under `apps/web/src` or `apps/web/e2e` mentions `api-types`, and `apps/web/src/api.ts` declares no
  `interface` or `type` named `Ticket`, `State`, `Config`, `TicketDetail`, `TicketPage`, `Machine`, `Segment`,
  `Group`, `ListItem`, `Person`, `Shift`, `Figures`, `BreakdownReport`, `TicketEvent`, `TicketPerson` or
  `TicketInterval`.
- **X2** `takes the contract types in the domain from shared`: Given `packages/domain/src/**/*.ts`, then none declares
  `type Criticality =`, `type Severity =`, `type SlaTimerState =`, `interface SeverityMatrix` or `interface
SlaPolicy`, and `packages/domain/package.json` lists `@uptimo/shared` as `workspace:*`.
- **W1** `pnpm typecheck` passes with `api-types.ts` deleted; the existing web unit tests (`actionSpecs`,
  `views`, `board/data`, `replay`, `push`, `i18n`) pass with only the fixture keys of §3 added.

Commands: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm boundaries && pnpm build &&
pnpm test:e2e && pnpm audit:lean`. `pnpm build` proves esbuild and Vite resolve the `./*` export; if it does not,
the coder stops.

**Commit order:** (1) golden fixture, S1, JSON on unchanged code; (2) shared schemas, `REPLY_SCHEMAS`, reply check,
`vitest.config.ts`, `app.ts` line, R1–R7; (3) reply parts, accountability parts, tickets/plant rewiring, manifest,
P1, P2, B1; (4) domain re-exports, web types and fixtures, X1, X2.

## 7. Regression risk

- **Every server test now checks its replies.** A field the plan types wrongly fails tests loudly (R8 rule). Known
  edges named in decision 2: nullable `raisedLoginId`; `features` assumed `Record<string, boolean>` (an admin could
  store anything under `PUT /settings/features`; production is unaffected since the check is test-only);
  `machineSnapshot` holds `code, category, cell, criticality` and `id` (imported tickets carry `id`; ruling: stays strict, all five optional).
- **Behaviour:** `/state`, `/tickets`, `/tickets/:id`, raise, all commands and `/config` keep their bytes (§4.2);
  stored idempotent replies replay unchanged. Existing tests that read `sla`, `slaPolicyId` and `slaPolicies`
  (`sla-timers`, `sla-policies`, `tickets-commands`, `tickets-list`, `settings`) must stay green.
- **Registry state is module-global**: several `buildApp` calls in one file re-contribute the same names, which
  replaces them. An app built without `accountability` would reply without `sla` (none exists).
- **Web:** `Ticket.sla` is now typed required (`SlaProjection | null`); `SlaTimerSummary` keeps its `=== undefined`
  branch for cached pre-SLA replies, so runtime is unchanged. Cached replies never carried fewer keys than today.
- **Golden:** the frozen `Date` lasts one request; the frozen `Date` is global during that one request, so pg-boss and the rate limiter also read it. S1 asserts status
  and body only, never headers. If S1 is flaky, the coder stops.
- **Domain now depends on shared (types only).** `import type`/`export type` only, so no runtime `zod` in the domain.
- **PR size:** over 400 changed lines without the fixtures; `size:large` with the reason above.

## 8. Changelog

`changes/82-one-contract-reply-parts.md`:

```
- Server and web now share one typed contract; every API reply is checked against it in the test suite.
- SLA clocks reach ticket replies as a part contributed by the accountability module; replies are unchanged.
```

## 9. Out of scope

- Removing the `@uptimo/shared` barrel and the relative `share.js` import in `ShareButton.tsx` (decision 1).
- A kernel `route()` that parses requests and replies in production; checking replies in production or in the
  browser tests (`CHECK_REPLIES` is not set for Playwright).
- An event bus and `ticket.changed` (decision 5); `defineModule({ replyParts })`.
- Moving SLA policies to their own route (`/sla-policies`); `/config` keeps `slaPolicies`.
- Dropping `ticket.sla_policy_id` or stopping its use (D13, a later contract migration).
- Deleting any unused reply field (§5.1) or the importers' `accountability` exceptions (ticket 09).
- Typing request bodies from the shared schemas on the web (`CommandBody`, `CorrectChanges`, `TicketListQuery`).

## 10. Questions

**For Nimish (product, does not block this slice):** Every signed-in phone downloads the plant settings, and that
download includes every person's phone number, although no screen shows it. This slice keeps it exactly as it is.
Should phone numbers stop being sent to the phones?

**For the orchestrator (technical, accept or reject):** the deviations marked **D** in decisions 1, 3 and 5.
