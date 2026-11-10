# Changelog

All notable changes to this product. Format: Keep a Changelog. The build is pre-release; no user-visible capability ships yet.

## Unreleased

### Added

- Cosmos seed (M0-0.6): `seed:cosmos` loads tenant zero from the discovery files with a committed seed report. 2 integration tests.

- Settings (M0-0.5): `/config` with fingerprint and `?fp=` delta, `/settings`, list CRUD with flags, missing-translations list and translation upsert. 6 integration tests.

- Auth (M0-0.4): Fastify `login/logout/me/change-password` and `/brand`, Argon2id, opaque bearer token hashed at rest, 30-day sliding sessions, shared-login acting person. 8 integration tests.

- Repository bootstrap: discovery pack under `docs/discovery/`, live spec under `docs/spec/`, build layout under `apps/`, `packages/`, `infra/`.
- `docs/BUILD-PROTOCOL.md`, `docs/WORKFLOW.md`, `docs/SKILLS.md`, `docs/REVIEW-MECHANISMS.md`, `docs/ORCHESTRATION.md`, `docs/FRONTEND-STRATEGY.md`, `docs/INFRASTRUCTURE.md`, `docs/TESTING.md`.
- ADRs 0001 (stack), 0002 (hosting and outside services), 0003 (auth, proposed), 0004 (commercial layer deferred).
- `docs/spec/parity.yaml` with 79 rows and stable ids.
- `docs/plan/backlog.md` with 34 spec tickets plus the design track, `NEEDS.md`, `STATUS.md`.
- `docs/spec/QUESTIONS.md` and `DIFFERENCES.md`.
- Root tooling: pnpm workspace, TypeScript, ESLint, Prettier, Vitest, parity/licence/migration checks, CI.
- Anti-bloat mechanism: Ponytail skill (MIT, adapted), `docs/LEAN.md`, `docs/QUALITY-BAR.md`, file/function/dependency/PR-size/shortcut checks.
- Session 1 verification: `pnpm verify` green (format, lint, typecheck, 3 tests, build, parity, licences, migrations, lean audit).

### Added

- Cosmos seed (M0-0.6): `seed:cosmos` loads tenant zero from the discovery files with a committed seed report. 2 integration tests.

- Settings (M0-0.5): `/config` with fingerprint and `?fp=` delta, `/settings`, list CRUD with flags, missing-translations list and translation upsert. 6 integration tests.

- Auth (M0-0.4): Fastify `login/logout/me/change-password` and `/brand`, Argon2id, opaque bearer token hashed at rest, 30-day sliding sessions, shared-login acting person. 8 integration tests.

- Schema v1: 26 tables, forced RLS, composite tenant foreign keys, `app_router` functions, `withTenant()` and a two-tenant Testcontainers isolation suite (17 tests).

### Changed

- Schema review fixes: normalised report people, tenant-scoped push endpoints, restrict person deletion, append-only audit log, hot-path indexes and a non-negative downtime check.

- Auth: hand-rolled sessions chosen by the M0 spike (ADR 0003); better-auth removed from the spec and `THIRD_PARTY.md`.

- Commercial shape: managed pilot first; billing and self-serve deferred to after M6.
- Hosting: AWS-only, low-cost; no Supabase, Vercel, Redis, NAT, ALB, ECS or paid APM.
- Secrets: Secrets Manager in production, SSM Parameter Store in staging.
- Local S3: LocalStack or s3rver, not MinIO (AGPL).

### Not yet

- No product code, no schema, no auth, no screens, no deploy.
