# Changelog

All notable changes to this product. Format: Keep a Changelog. The build is pre-release; no user-visible capability ships yet.

## Unreleased

### Added

- Ticket lists (M1a-5c): `GET /api/v1/tickets` — filterable by status/kind/machine/person/reporter/date, cursor-paginated with microsecond-precise keyset; desk Open/Mine/Team tabs and a floor My complaints list. 8 integration tests.

- Desk face (M1a-5b): Open board (counts strip, team-now, Breakdowns/Tasks/Work lists), ticket detail with facts, live figures, timeline and people, and the state-dependent action set (start/pick up, pause, resume, update, transfer, machine running/stopped, close, cancel) — every action idempotent.

- Floor face (M1a-5a): Tailwind design system + TanStack Query, a typed API client with per-request Idempotency-Key, and a three-tap report (machine search and segment/group chips, situation, problem with quick chips, work request, confirmation).

- Tickets API (M1a-4): full command endpoints (raise, start/join/leave, pause/resume, transfer, update, machine-running/stopped, close, late report, cancel/restore, correct, upgrade-kind) over the domain state machine, plus `GET /state` and `GET /tickets/{id}`. `FOR UPDATE` row locks, `Idempotency-Key` replay, figures recomputed and persisted. 20 integration tests; 83 total.

- Infrastructure (M1a-4, EIP-only): run without a domain — optional Terraform `domain` (skips Route 53 when empty), Caddy defaults to HTTP `:80` (no Let's Encrypt), and a bare-IP Host resolves the default tenant.

- State machine complete (M1a-3b): join, leave, upgrade-kind, late-report, restore, correct, record-past-breakdown. 12 state tests; 57 total.

- Domain state machine (M1a-3): raise, start, pause, resume, transfer, update, running/stopped, close, cancel as pure transitions with time clamping and permission gates. 8 tests.

- Domain permissions (M1a-2): the §3 matrix as pure functions (raise, cancel, work, close, late report, restore, correct, day report, live board, money, analytics, settings). 6 tests.

- Domain figures engine (M1a-1): exact response, hands-on union, waiting/vendor, handover, downtime, follow-up, repair and per-person minutes with overrides. 8 tests.

- Walking skeleton (M0-0.8): Vite + React web app (login, floor, desk), minimal ticket raise and open list. Runs locally; 37 tests.

- Infrastructure (M0-0.7, authored): Terraform for ap-south-1, Docker Compose + Caddy, server image, deploy/rollback script, restore runbook and deploy workflow. Apply is blocked on AWS credentials.

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

- State machine complete (M1a-3b): join, leave, upgrade-kind, late-report, restore, correct, record-past-breakdown. 12 state tests; 57 total.

- Domain state machine (M1a-3): raise, start, pause, resume, transfer, update, running/stopped, close, cancel as pure transitions with time clamping and permission gates. 8 tests.

- Domain permissions (M1a-2): the §3 matrix as pure functions (raise, cancel, work, close, late report, restore, correct, day report, live board, money, analytics, settings). 6 tests.

- Domain figures engine (M1a-1): exact response, hands-on union, waiting/vendor, handover, downtime, follow-up, repair and per-person minutes with overrides. 8 tests.

- Walking skeleton (M0-0.8): Vite + React web app (login, floor, desk), minimal ticket raise and open list. Runs locally; 37 tests.

- Infrastructure (M0-0.7, authored): Terraform for ap-south-1, Docker Compose + Caddy, server image, deploy/rollback script, restore runbook and deploy workflow. Apply is blocked on AWS credentials.

- Cosmos seed (M0-0.6): `seed:cosmos` loads tenant zero from the discovery files with a committed seed report. 2 integration tests.

- Settings (M0-0.5): `/config` with fingerprint and `?fp=` delta, `/settings`, list CRUD with flags, missing-translations list and translation upsert. 6 integration tests.

- Auth (M0-0.4): Fastify `login/logout/me/change-password` and `/brand`, Argon2id, opaque bearer token hashed at rest, 30-day sliding sessions, shared-login acting person. 8 integration tests.

- Schema v1: 26 tables, forced RLS, composite tenant foreign keys, `app_router` functions, `withTenant()` and a two-tenant Testcontainers isolation suite (17 tests).

### Changed

- Infra gate fixes: RDS multi-AZ subnets, EIP + Route 53 records, SSM deploy (no public SSH), real S3 backend with lockfile, single budget (account-managed), `terraform.tfvars`/state ignored.

- Schema review fixes: normalised report people, tenant-scoped push endpoints, restrict person deletion, append-only audit log, hot-path indexes and a non-negative downtime check.

- Auth: hand-rolled sessions chosen by the M0 spike (ADR 0003); better-auth removed from the spec and `THIRD_PARTY.md`.

- Commercial shape: managed pilot first; billing and self-serve deferred to after M6.
- Hosting: AWS-only, low-cost; no Supabase, Vercel, Redis, NAT, ALB, ECS or paid APM.
- Secrets: Secrets Manager in production, SSM Parameter Store in staging.
- Local S3: LocalStack or s3rver, not MinIO (AGPL).

### Not yet

- No product code, no schema, no auth, no screens, no deploy.
