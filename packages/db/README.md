# @uptimo/db

Schema v1 and migrations. Plain SQL, not an ORM migration dialect: RLS policies and the
`app_router` functions live next to the tables.

- `migrations/0001_schema_v1.sql` — 26 tables (25 tenant tables), forced RLS, composite
  `(tenant_id, id)` foreign keys, `tenant_by_slug` and `auth_lookup`.
- `test/seed.sql` — one row per tenant in every tenant table.
- `test/isolation.test.ts` — Testcontainers Postgres 16; starts a container, applies the
  migration and seed, then proves the isolation, roles, functions and constraints.
- `src/tenant.ts` — `withTenant(pool, tenantId, run)`: one transaction, `app.tenant_id`
  set transaction-locally, `MissingTenantError` if it is absent.

```bash
pnpm test          # includes packages/db/test/isolation.test.ts (Docker required)
```
