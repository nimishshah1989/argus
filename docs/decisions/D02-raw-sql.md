# D2 — Raw SQL on `pg`; Drizzle is not adopted

Date: 13 November 2026 · Status: accepted (architect); detail in `docs/ARCHITECTURE.md`

## Decision

Keep raw SQL through `pg`. SQL lives only in `repo.ts`; each repo maps rows to the shared Zod type at its edge; every repo function is tested on real Postgres. ADR 0001, SPEC §5/§6 and `THIRD_PARTY.md` are corrected. This supersedes the Drizzle line of ADR 0001.

## Why

162 queries and 507 real-database tests already run this way. RLS policies, definer functions, row locks and pg-boss writes on the ticket's own client (ADR 0006) are SQL in any stack. A rewrite before cutover changes nothing a user sees.

## Rejected

- Drizzle: a retrofit, two query styles during the move, and a second schema source beside the SQL migrations.
- Kysely or a SQL-to-types generator: a new dependency for a problem the repo tests already catch.

Revisit after two production defects caused by a query and schema disagreeing, or if M4a result queries need dynamic SQL.
