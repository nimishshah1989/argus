# D24 — Database roles: the router role holds policies, not BYPASSRLS; history is deleted only through four functions

Date: 13 November 2026 · Status: proposed (architect, ticket 07; waits for the schema-reviewer)

## Decision

1. **`app_router` never bypasses row security.** It gets one explicit policy, `router_definer … TO app_router USING (true)`, on each table its SECURITY DEFINER functions read or write, and nothing on the rest. Migration 0009 removes the BYPASSRLS attribute where it is set.
2. **Four functions are the only way to delete history or edit it:** `import_undo`, `erase_person`, `offboard_tenant`, `audit_purge`. Each is owned by `app_router`, pins `search_path`, is executable by `app_router` alone, and takes a required `p_operator` that it writes into the audit trail; `import_undo` and `erase_person` also take the customer and refuse another customer's batch or person. `app_user` and `app_api` cannot call them. (`erase_json_values`, a helper of `erase_person`, has the same owner and no grant.)
3. **The operator credential reaches them, the server does not.** The migration role (`MIGRATION_DATABASE_URL`) is a member of `app_router`, so operator scripts run with it and call the functions directly. `import:undo` reads that connection from `ROUTER_DATABASE_URL`, which is an operator credential: kept out of `app.env`, used only by the operator CLIs and `migrate.env`. The server holds only `DATABASE_URL` (`app_api`), which is not a member. **What this guarantees, honestly:** history is protected against the application role (`app_user`, `app_api`). `app_router` itself holds table rights through its policies, so any login that is a member of it can change history without the four functions. A separate NOLOGIN history-owner role that owns the functions, leaving `app_router` as a caller only, is a follow-up before production cutover (orchestrator ruling, round 3).
4. **The migration runner prepares the roles** before the first file: it creates `app_router` when missing, makes the migration role a member, lends `app_router` CREATE on schema `public` inside each file's own transaction (PostgreSQL needs it for `OWNER TO`), so a failure, a rollback or a killed run takes it back with the file; a grant an older run left behind is revoked at start-up. When the migration role cannot grant BYPASSRLS it skips the one statement in `0001` that asks for it.
5. **A migration that reads or rewrites rows runs with `row_security = off`** and lifts FORCE on the tables it touches for its transaction. A table it forgot then raises an error instead of quietly returning no rows.

## Why

- RDS's master user is not a superuser. On PostgreSQL 16 a non-superuser without BYPASSRLS can neither create nor alter a BYPASSRLS role (measured, `docs/slices/07-schema-notes.md` §8). With policies the design needs no attribute that a managed database may refuse.
- A role that sees only the tables its functions need is narrower than one that bypasses everything.
- A table owner that is not a superuser is itself filtered by FORCE row security: a guard such as "does `ticket_tag` hold rows?" answers 0 and the data is dropped. Point 5 turns that silent answer into an error.

## Rejected

- **Grant EXECUTE to `app_user`** (the pattern of `auth_lookup`): any query the server can be made to run could then offboard a customer.
- **Let `app_api` `SET ROLE app_router`:** the same hole by another door, plus cross-tenant reads of logins and sessions.
- **A third login role for operators:** one more credential to store and rotate; the migration role already exists, is already kept away from the server, and already owns the tables. Revisited in round 3: a NOLOGIN history-owner role is wanted before production cutover, not now.
- **Keep BYPASSRLS and ask AWS support or an `rds_superuser` grant to allow it:** unverified, differs by provider and version, and wider than needed.
- **Edit `0001`:** merged migrations are immutable.
- **A new "bootstrap" migration numbered before `0001`:** the runner sorts by name and every existing database would see a new, unapplied file ahead of its ledger.

## Consequence

- `audit_purge` cannot be called by the server's job worker and stays that way (orchestrator ruling): the purge is an operator task. No audit row can be 3 years old before November 2029.
- `erase_person` searches text only for terms of three characters or more. A person whose every term is shorter is still switched off and unlinked by id; the audit row says `text_searched: false` and how many terms were skipped, and the plant reviews the text by hand.
- A data-only reload of `platform_access` into a migrated database must switch off `platform_access_guard` and lift the approver check for the reload; the runbook is in both migration headers. RDS snapshot restores and full restores into an empty database are unaffected.
- Offboarding keeps the tenant row, marked `offboarded`, and one audit line, so the proof has a home without a new table (D17).
