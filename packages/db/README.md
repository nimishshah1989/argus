# @uptimo/db

Schema v1 and migrations. Plain SQL, not an ORM migration dialect: RLS policies and the
`app_router` functions live next to the tables.

- `migrations/0001_schema_v1.sql` — 26 tables (25 tenant tables), forced RLS, composite
  `(tenant_id, id)` foreign keys, `tenant_by_slug` and `auth_lookup`.
- `migrations/0002_app_api_role.sql` — the `app_api` login role (member of `app_user`,
  no `BYPASSRLS`), which the server uses so RLS is actually enforced.
- `test/seed.sql` — one row per tenant in every tenant table.
- `test/isolation.test.ts` — Testcontainers Postgres 16; starts a container, applies the
  migration and seed, then proves the isolation, roles, functions and constraints.
- `src/tenant.ts` — `withTenant(pool, tenantId, run)`: one transaction, `app.tenant_id`
  set transaction-locally, `MissingTenantError` if it is absent, and a one-time warning if
  the connection role bypasses RLS.

## Roles and connection credentials

| Role         | Login | Bypass RLS | Purpose                                                           |
| ------------ | ----- | ---------- | ----------------------------------------------------------------- |
| `app_api`    | yes*  | no         | the server and API runtime (least privilege, RLS enforced)        |
| `app_user`   | no    | no         | the shared table/function grants that `app_api` inherits          |
| `app_router` | no    | no (D23)   | owns the SECURITY DEFINER functions; one policy per table it uses |
| owner        | yes   | yes        | migrations only                                                   |

\* `app_api` is created `NOLOGIN` in the migration; the deployment layer
(`ALTER ROLE app_api LOGIN PASSWORD '…'`, from SSM/Terraform — follow-up) turns on login.
Never commit a password.

The server must connect as `app_api` (via `DATABASE_URL`). The owner/superuser credential is
reserved for migrations (`MIGRATION_DATABASE_URL`) and must not be exposed to the app.
`withTenant` warns once if the connection is a superuser/BYPASSRLS role, which would silently
skip RLS.

## Migration rules

- **A merged migration file is immutable.** Once a migration is on `main` it may not be
  modified, deleted or renamed; a schema fix is a new numbered file. `pnpm migrations:immutable`
  enforces this on pull requests by diffing `origin/main...HEAD` (a new file is fine; it skips
  when there is no diff base).
- Every new tenant table goes in a new migration with its `tenant_id`, RLS enable/force and
  policy in the same file; the generic isolation test picks it up.
- Keep `pnpm migrations:check` green: a `DROP`, data `UPDATE`, `DELETE FROM`, `TRUNCATE`, `SET NOT NULL`,
  column type change or `REVOKE` needs `-- approved-by:` and `-- backup:` lines (with text) in the file's
  leading comment block. The seven files merged before the rule are named, dated exceptions in the tool.

```bash
pnpm test                    # includes packages/db/test/isolation.test.ts (Docker required)
pnpm migrations:check        # destructive-statement guard
pnpm migrations:immutable    # PR-only: no existing migration file is changed
```
