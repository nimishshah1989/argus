# Log (append-only)

2026-11-10 — Reviewed the full discovery pack and architecture; verdict, blockers and effort estimate in review/04-build-readiness-review.md. No code written. GitHub repo is empty and public; make it private before pushing.
2026-11-10 — Repo made private, restructured (docs/spec live; docs/discovery frozen), and initial commit pushed (364e899). Added BUILD-PROTOCOL, REVIEW-MECHANISMS, ORCHESTRATION and ADR 0004 (commercial layer deferred). No product code yet.
2026-11-10 — Session 1: workflow/skills, ADRs, 79-row parity ledger, 38-ticket backlog, needs/questions/differences, lean/Ponytail mechanism, scaffold and CI. pnpm verify green. No product code. Next: auth spike, then M0-0.3 schema + RLS.
2026-11-10 — Auth spike: hand-rolled sessions chosen (RLS 1/1, shared acting person, 30-day sliding); better-auth rejected (session tenant null, schema/RLS/shared-phone mismatch). ADR 0003 final; SPEC and THIRD_PARTY updated. No product code yet.
2026-11-10 — M0-0.3: schema v1, forced RLS on 24 tenant tables, composite tenant FKs, app_router tenant_by_slug/auth_lookup, Testcontainers two-tenant isolation suite (8 tests, 12 total). No API code yet.
2026-11-10 — M0-0.3 merged (#5): schema v1 with forced RLS, composite tenant FKs, app_router functions and withTenant; 14 tests. Next M0-0.4 auth.
2026-11-10 — Schema review fixes: report people normalised to breakdown_report_person; tenant-scoped push endpoints; person delete restricted; audit append-only; hot-path indexes; non-negative downtime. 17 tests. Branch m0/0.3a-schema-fixes.
2026-11-10 — M0-0.4: Fastify auth (host tenancy, login/logout/me/password, Argon2id, sliding sessions, shared acting person, /brand). 8 integration tests; 25 total. Next M0-0.5 settings.
2026-11-10 — M0-0.5: settings/config API (fingerprint, lists, features, translations). 6 integration tests; 31 total. Settings UI deferred to the web scaffold in M0-0.8.
