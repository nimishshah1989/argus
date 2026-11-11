# M2 configurable ticket tags

## Scope and decision

A user with a work role can classify a ticket using active, tenant-configured `list_item` values and
can remove a classification. Other authenticated roles can read tags. The catalogue uses the existing
`breakdown_category`, `maint_code`, and `work_type` lists; there is no second in-code vocabulary and no
free-text/custom tag in this slice.

This is a written addition, not a parity claim. The PR needs `no-parity` and `size:large`: one vertical
slice requires a relational migration, API/UI, and DB-backed concurrency/RLS tests plus real-browser
coverage; the large label covers test-heavy evidence, not extra features.

**Out of scope:** manual severity tags, custom tags, new list management, offline tag writes, and the
other categories in the design exploration. M2-2.1 separately derives S1–S4 from the plant's
criticality/state matrix (`docs/spec/DOMAIN.md` §Severity). No severity catalogue or mapping ships here.
The rejected `setting` shim was never merged or deployed, so there is no released `tag:<ticketId>` data
to backfill or delete.

## Public contract

`TagCategory = 'breakdown_category' | 'maint_code' | 'work_type'`.

`TagDefinition = { id, code, label, labelGu?, labelHi?, category, active, sortOrder }`, where `id` is the
owning tenant's `list_item.id`. `TicketTag = { tagId, appliedAt, appliedBy, appliedByLogin }`.
`TagList = { applied: TicketTag[], tags: TagDefinition[] }`; `tags` resolves the applied definitions.
An applied item remains visible if it later becomes inactive.

- `GET /api/v1/tags` and `/api/v1/tags/:category` → `{ tags: TagDefinition[] }`, active caller-tenant
  items only, ordered by category, `sort`, and `code`. Unknown category → 404; unauthenticated → 401.
- `GET /api/v1/tickets/:id/tags` → `TagList`; missing/other-tenant ticket → 404.
- `POST /api/v1/tickets/:id/tags` with `{ tagId: uuid }` and `Idempotency-Key` → `TagList` (200).
  Missing/invalid input or missing key → 422; unknown/inactive/non-tag item → 422; forbidden role →
  403; missing/other-tenant ticket → 404. Reapplying an existing item is a successful no-op.
- `DELETE /api/v1/tickets/:id/tags/:tagId` with `Idempotency-Key` → `TagList` (200). Removing an absent
  assignment is a no-op; an inactive assignment remains removable. A malformed uuid/missing key → 422;
  the same role and tenant rules apply.
- A replay of the same key and exact command returns the stored first response. A key reused for a
  different request returns 422. Every effective add/remove appends `tag_add`/`tag_remove` with login,
  acting person, time, label and item metadata, and increments the ticket sequence under its row lock.
- `technician`, `supervisor`, `head`, and `admin` may write through the existing domain `canWork` rule;
  `operator`, `plant_head`, and `board` may not. The browser uses the same rule.

## Data and module boundaries

- New `packages/db/migrations/0005_ticket_tag.sql`: `ticket_tag` has `id`, `tenant_id`, `ticket_id`,
  `item_id`, `applied_at`, nullable `applied_by_login_id`, nullable `applied_by_person_id`, `created_at`
  and `updated_at`. Add `UNIQUE(tenant_id,id)` to `list_item`; use composite tenant FKs to `ticket`,
  `list_item`, `login`, and `person`, with ticket/item cascade and actor preservation matching existing
  event behavior. Add `UNIQUE(tenant_id,ticket_id,item_id)`, forced tenant RLS and app grants.
- `packages/shared/src/tags.ts`: categories, wire types and `tagApplySchema`; exported from its index.
  `packages/shared/src/config.ts` reuses the existing list names, not a parallel source of list values.
- `packages/domain/src/types.ts`: add the two tag event types. Existing `permissions.ts` owns write
  permission. No catalogue, label, colour, fixture, or database lookup enters `packages/domain`.
- `apps/server/src/tag-sql.ts`: tenant catalogue/assignment queries, ticket row lock, event append and
  response loading. `apps/server/src/tags.ts`: auth/validation/idempotency/routes only, reusing
  `ticket-idempotency.ts` and `ticket-sql.ts`; all mutation steps share one `withTenant` transaction.
- `apps/web/src/api.ts` / tag components: load catalogue and applied tags independently; send an
  idempotency key on every mutation. Neutral pills use labels, not synthetic-id colour mappings.
- `apps/web/src/components/Timeline.tsx` and `i18n/en.ts`: translated tag add/remove labels and
  configured category labels. `fixtures.ts` adds fake configured values and an isolated tags machine.

## Tests (Given / When / Then)

Each case is exercised through the public API, real database, or real browser, one red/green cycle at a
time. Tests use only synthetic ids/data.

1. **Catalogue:** Given active/inactive A items and a different B catalogue, when A/B list all or one
   category, then each sees only its own active items in stable order and an unknown category is 404.
2. **First-tag browser path:** Given a ticket with no tags, when the technician opens detail, then all
   configured options are visible; after add and reload the applied pill and timeline event remain;
   after remove and reload the ticket is empty again.
3. **CRUD:** Given a ticket, when an item is added, reread and removed, then `ticket_tag` and the API
   agree and applied actor/time are present.
4. **Validation:** Given missing/unknown/inactive/wrong-list ids and missing idempotency keys, when
   POST/DELETE arrive, then the documented 422 response occurs without writes.
5. **Permissions:** Given every role, when POST/DELETE arrive, then exactly the `canWork` roles succeed;
   every other role gets 403 and no assignment/event.
6. **Replay:** Given one successful add, when the exact request/key repeats, then the bodies match and
   one assignment/event exists; a different request with that key gets 422. Same-item replay with a new
   key is a successful no-op.
7. **Concurrency:** Given two writers, when different adds or add-vs-delete overlap, then committed work
   is not lost and event sequences are unique/consecutive. Same-item concurrent adds leave one row.
8. **Tenancy:** Given tenants A and B with tickets/items, when A requests B's ticket for GET/POST/DELETE,
   then each is 404 and B's assignment/catalogue is unchanged.
9. **Audit:** Given effective add/remove commands, when detail is read, then ordered tag events carry
   actor/time/label; no-op commands append nothing.
10. **Lifecycle/RLS:** Given a tagged ticket, when it is deleted/import-undo cascades, then its assignment
    is gone while its tenant remains; the generic isolation suite covers `ticket_tag` like every table.

## Executable acceptance

Run from the repository root. “Exit 0” also requires no skipped or weakened test.

| #   | Criterion                                | Command                                                                                                                    | Expected                                                             |
| --- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | Tenant catalogue and active filtering    | `pnpm vitest run apps/server/test/tags.test.ts -t catalogue`                                                               | exit 0; A/B isolation, ordering, inactive filtering and 404 asserted |
| 2   | Empty ticket can add, persist and remove | `pnpm playwright test apps/web/e2e/tags.spec.ts --project=chromium`                                                        | exit 0; 1 real-browser test passes                                   |
| 3   | CRUD persistence                         | `pnpm vitest run apps/server/test/tags.test.ts -t CRUD`                                                                    | exit 0; API and stored actor/time asserted                           |
| 4   | Validation and required keys             | `pnpm vitest run apps/server/test/tags.test.ts -t validation`                                                              | exit 0; all 422 cases assert no writes                               |
| 5   | Server role enforcement                  | `pnpm vitest run apps/server/test/tags.test.ts -t permissions && pnpm vitest run packages/domain/test/permissions.test.ts` | exit 0; every role checked at API and domain seams                   |
| 6   | Exact replay and same-item no-op         | `pnpm vitest run apps/server/test/tags.test.ts -t replay`                                                                  | exit 0; identical first body, one event, 422 key misuse              |
| 7   | Concurrent writers                       | `pnpm vitest run apps/server/test/tags.test.ts -t concurrent`                                                              | exit 0; no lost update, duplicate row, or sequence collision         |
| 8   | Real cross-tenant routes                 | `pnpm vitest run apps/server/test/tags.test.ts -t cross-tenant`                                                            | exit 0; GET/POST/DELETE all 404 and B unchanged                      |
| 9   | Event history                            | `pnpm vitest run apps/server/test/tags.test.ts -t audit`                                                                   | exit 0; add/remove actor/time/label and no-op count asserted         |
| 10  | Cascade and generic RLS                  | `pnpm vitest run apps/server/test/tags.test.ts packages/db/test/isolation.test.ts -t 'cascade                              | schema v1 isolation'`                                                | exit 0; delete cleanup and every-table RLS cases pass |
| 11  | Whole suite                              | `pnpm test`                                                                                                                | exit 0; all files/tests pass                                         |
| 12  | Typecheck and production builds          | `pnpm build`                                                                                                               | exit 0                                                               |
| 13  | Formatting                               | `pnpm format:check`                                                                                                        | exit 0                                                               |
| 14  | Migration/dependency/lean guards         | `pnpm migrations:check && pnpm migrations:immutable && pnpm audit:lean`                                                    | exit 0; no unapproved destructive SQL/dependency/size failure        |
| 15  | Parity and declared large-slice reason   | `pnpm parity && LEAN_ALLOW_LARGE=1 pnpm pr:size`                                                                           | exit 0; report names the test-heavy vertical-slice exception above   |

## Evidence

Red evidence is recorded before each implementation cycle; green output is pasted here at completion.

| Rows  | Red result | Green result |
| ----- | ---------- | ------------ |
| 1–10  | Pending    | Pending      |
| 11–15 | Pending    | Pending      |
