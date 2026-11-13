# D23 — Database roles: the router role holds policies, not BYPASSRLS; history is deleted only through four functions

Date: 13 November 2026 · Status: proposed (architect, ticket 07; waits for the schema-reviewer)

## Decision

1. **`app_router` never bypasses row security.** It gets one explicit policy, `router_definer … TO app_router USING (true)`, on each table its SECURITY DEFINER functions read or write, and nothing on the rest. Migration 0009 removes the BYPASSRLS attribute where it is set.
2. **Four functions are the only way to delete history or edit it:** `import_undo`, `erase_person`, `offboard_tenant`, `audit_purge`. Each is owned by `app_router`, pins `search_path`, and is executable by `app_router` alone. `app_user` and `app_api` cannot call them.
3. **The operator credential reaches them, the server does not.** The migration role (`MIGRATION_DATABASE_URL`) is a member of `app_router`, so operator scripts run with it and call the functions directly. The server holds only `DATABASE_URL` (`app_api`), which is not a member.
4. **The migration runner prepares the roles** before the first file: it creates `app_router` when missing, makes the migration role a member, lends `app_router` CREATE on schema `public` for the run (PostgreSQL needs it for `OWNER TO`) and takes it back at the end. When the migration role cannot grant BYPASSRLS it skips the one statement in `0001` that asks for it.
5. **A migration that reads or rewrites rows runs with `row_security = off`** and lifts FORCE on the tables it touches for its transaction. A table it forgot then raises an error instead of quietly returning no rows.

## Why

- RDS's master user is not a superuser. On PostgreSQL 16 a non-superuser without BYPASSRLS can neither create nor alter a BYPASSRLS role (measured, `docs/slices/07-schema-notes.md` §8). With policies the design needs no attribute that a managed database may refuse.
- A role that sees only the tables its functions need is narrower than one that bypasses everything.
- A table owner that is not a superuser is itself filtered by FORCE row security: a guard such as "does `ticket_tag` hold rows?" answers 0 and the data is dropped. Point 5 turns that silent answer into an error.

## Rejected

- **Grant EXECUTE to `app_user`** (the pattern of `auth_lookup`): any query the server can be made to run could then offboard a customer.
- **Let `app_api` `SET ROLE app_router`:** the same hole by another door, plus cross-tenant reads of logins and sessions.
- **A third login role for operators:** one more credential to store and rotate; the migration role already exists, is already kept away from the server, and already owns the tables.
- **Keep BYPASSRLS and ask AWS support or an `rds_superuser` grant to allow it:** unverified, differs by provider and version, and wider than needed.
- **Edit `0001`:** merged migrations are immutable.
- **A new "bootstrap" migration numbered before `0001`:** the runner sorts by name and every existing database would see a new, unapplied file ahead of its ledger.

## Consequence

`audit_purge` cannot be called by the server's job worker. No audit row can be 3 years old before November 2029; the job's slice (ARCHITECTURE §9 item 33) decides then whether the purge runs as an operator task or the grant is widened by a reviewed migration.
