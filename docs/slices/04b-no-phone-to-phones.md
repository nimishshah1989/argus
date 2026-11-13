# 04b — No phone numbers to phones

Issue: none found in GitHub Issues at planning time; the orchestrator opens or names it and fills `82` in §6 before
the build. Follows 04 (merged, #160) · Branch `claude/t04b-no-phone-to-phones`. One PR, label `no-parity`. The PR
body contains `Follow-up to #82 (no `Closes`: #82 belongs to merged slice 04)`.

**Status: ready for plan review.** No product question blocks the build (§8).

## 1. Goal

A technician, operator or head who signs in no longer receives everyone's mobile number; only an admin, who manages
people, still does (DATA-MAP §5 "Only what is needed", DPDP Act 2023). Nothing else a user sees changes.

## 2. Decisions (technical)

- **Who gets phones:** `canSettingsPeople(actor)` from `@uptimo/domain` (today `role === 'admin'`). The local
  `canWrite` in `plant/routes.ts` (admin or head) is **not** used: a head does not manage people and gets no phones.
  The server already imports domain permissions this way (`reports/routes.ts:229` builds an `ActorContext` from
  `AuthContext` with `role as ActorContext['role']`); same pattern here.
- **Where to strip:** in `handleConfig`, after `loadConfig`. Smallest change: `loadConfig`, `listPeople` and identity's
  published interface stay as they are (one caller, one line of policy, no new parameter).
- **Key absent, not null:** a non-manager's person entry has no `phone` key, so "no number" (null) and "not shown to you"
  (absent) stay distinct, and nothing leaks through a null-vs-value difference.
- **Fingerprint per audience:** strip **before** `fingerprint(...)`. The fp is of the payload actually sent, so a
  technician's fp differs from an admin's whenever any person has a phone, and `?fp=` can never match across audiences.
- **Strip helper:** a module-private `withoutPhone(p: unknown): Record<string, unknown>` that copies and `delete`s
  `phone` (the lint config has no `ignoreRestSiblings`, so `{ phone: _, ...rest }` would fail `no-unused-vars`).

## 3. Files

| File                                      | Change                                                                                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/server/src/modules/plant/routes.ts` | Import `canSettingsPeople, type ActorContext` from `@uptimo/domain`; add `withoutPhone`; in `handleConfig` strip `people[].phone` for a non-manager, then fingerprint and reply |
| `packages/shared/src/config.ts`           | `personSchema.phone`: `nstr` → `nstr.optional()` (still `.strict()`)                                                                                                            |
| `apps/server/test/settings.test.ts`       | One new test (§6, T1) in `describe('settings and config')`                                                                                                                      |
| `changes/82-no-phone-to-phones.md`        | New changelog fragment, one line (§7)                                                                                                                                           |

No migration, no new dependency, no web source change expected (see §4.3).

## 4. Interfaces

### 4.1 `GET /api/v1/config` (reply contract unchanged except `phone` optional)

```ts
// packages/shared/src/config.ts
export const personSchema = z
  .object({
    id: str,
    name: str,
    team: str,
    title: nstr,
    active: z.boolean(),
    phone: nstr.optional(),
  })
  .strict();
export type Person = z.infer<typeof personSchema>; // phone?: string | null
```

`configReplySchema` and `REPLY_SCHEMAS['GET /api/v1/config']` pick this up unchanged; the reply check
(`kernel/reply-check.ts`) keeps validating every `/config` reply.

### 4.2 `handleConfig` (private, `plant/routes.ts`)

```ts
function withoutPhone(p: unknown): Record<string, unknown>; // shallow copy minus `phone`

async function handleConfig(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  const full = await loadConfig(pool, ctx.tenantId);
  const actor: ActorContext = {
    role: ctx.role as ActorContext['role'],
    loginId: ctx.loginId,
    personId: ctx.personId,
    shared: ctx.shared,
  };
  const payload = canSettingsPeople(actor)
    ? full
    : { ...full, people: full.people.map(withoutPhone) };
  const fp = fingerprint(payload);
  // ?fp= match and reply exactly as today, using `payload`
}
```

Function stays under 60 lines and complexity 12. No exported signature changes.

### 4.3 Web typecheck consequence

`Person.phone` becomes `string | null | undefined` (optional). `grep -rn '\.phone' apps/web/src` finds no reader, so
`pnpm typecheck` is expected to pass unchanged. If a web test fixture or type breaks, only a type-only fix is allowed
(no runtime change); anything more returns to the planner.

## 5. Data

| Field              | Type              | Lives in                     | Read / written                                                            |
| ------------------ | ----------------- | ---------------------------- | ------------------------------------------------------------------------- |
| `person.phone`     | `text NULL`       | Postgres `person` (identity) | Read by `listPeople` as today; in the reply only when `canSettingsPeople` |
| `AuthContext.role` | `string`          | `kernel/context.ts`          | Read, cast to `Role` for the permission rule                              |
| `fp`               | `string` (12 hex) | reply only                   | Now the hash of the audience's payload                                    |

No schema change. Re-verified: no `apps/web/src` code reads `person.phone`; push and WhatsApp paths do not use `/config`.

## 6. Test cases

All in `apps/server/test/settings.test.ts`. Fake number only (`+919999900001`, the seed's fake `+9199999000NN` range).

**T1 — `it('sends people phones only to a login that may manage people, fingerprinted per audience')`** (fails first:
today the technician's people carry `phone`).

- **Given** the existing tenant with logins `admin` (role admin) and `tech` (role technician), and
  `UPDATE person SET phone = '+919999900001' WHERE id = TECH_PERSON` run through `admin` (the superuser pool) at the
  start of the test,
- **When** each signs in (`loginAs`) and calls `GET /api/v1/config`,
- **Then**
  1. both replies are 200;
  2. every entry of the technician's `people` has no `phone` key (`expect(p).not.toHaveProperty('phone')` for each);
  3. the admin's `people` all have a `phone` key and the entry for `TECH_PERSON` has `phone === '+919999900001'`;
  4. the technician's `fp` differs from the admin's `fp`;
  5. the technician's `GET /api/v1/config?fp=<admin fp>` returns a full payload (no `same` key, `people` present) whose
     entries still have no `phone` key;
  6. the technician's `GET /api/v1/config?fp=<own fp>` returns `{ same: true, fp }` (per-audience cache still works).

**Permissions** (orchestrator ruling: admin-only confirmed). T1 also has a head: Given a person id
`10000000-0000-0000-0000-000000000071` ('Phones Head', team 'maintenance') and a login id
`10000000-0000-0000-0000-000000000072` (username 'phones-head', role 'head', shared false, `password_hash` copied from
`ADMIN_LOGIN`; same SQL pattern as `settings.test.ts:171-188`); Then every entry of the head's `people` has no `phone`
key. This guards against gating on `canWrite` (admin or head). Test name: `...fingerprinted per audience` stays.

**Regression:** existing tests `returns same:true for an unchanged fingerprint…` (admin) and the M2-2.1 fingerprint
test keep passing unchanged; `tickets.test.ts:395` reads `people[].name` only; `reply-contract.test.ts` still parses.

Commands (all must pass):

```
pnpm typecheck
pnpm vitest run apps/server/test/settings.test.ts apps/server/test/reply-contract.test.ts
pnpm test
pnpm boundaries
pnpm lint
pnpm pii:scan
pnpm docs:check
```

## 7. Changelog

`changes/82-no-phone-to-phones.md`:

```
- Mobile numbers in the plant setup are now sent only to admins; other logins no longer receive them.
```

## 8. Out of scope

- Phones in `/people` or `/logins` replies (admin-only routes already) and any people screen.
- Clearing phones from configs already cached on devices (`apps/web/src/offline/cache.ts`); the next fetch replaces them.
- Changing `canWrite`, the head role's rights, `listPeople`, or identity's published interface.
- Phone format validation (DATA-MAP §5, before M3).

Product note for Nimish (does not block): a plant head no longer sees mobile numbers in the app, because only an admin
manages people. If heads need numbers, that is a change to the people permission, not to this slice.
