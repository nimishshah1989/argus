# Status — session 1

Date: 10 November 2026
Session: 1 — foundation, no product code

## Done

- Repo private and restructured: `docs/spec` live, `docs/discovery` frozen, `apps/`, `packages/`, `infra/` ready.
- Workflow resolved: `docs/WORKFLOW.md`, `docs/SKILLS.md`.
- ADRs: 0001 stack, 0002 hosting/outside services, 0003 auth (proposed, spike pending), 0004 commercial layer deferred.
- `docs/spec/parity.yaml`: 79 rows, stable ids, 78 todo / 1 waived; validator + test.
- `docs/plan/backlog.md`: 34 spec tickets + 4 design tickets, dependencies, verification; `NEEDS.md`; this file.
- `docs/spec/QUESTIONS.md` (21 conflicts), `docs/spec/DIFFERENCES.md` (18 deliberate departures).
- `docs/LEAN.md`, `docs/QUALITY-BAR.md`, `.claude/skills/ponytail/`, size/dependency/shortcut/PR-size checks.
- Root scaffold: pnpm workspace, strict TypeScript, ESLint (size/complexity rules), Prettier, Vitest, Playwright/Testcontainers packages, CI (checks + gitleaks), `THIRD_PARTY.md`, `.env.example`.
- `pnpm verify` green: format, lint, typecheck, 4 tests, build, parity (79 rows), licences, migrations, lean audit.
- PR #1 merged after CI (checks + gitleaks) and a fresh-context review PASS. A waived parity row now needs a reason.

## Auth spike

- **Done.** Hand-rolled sessions vs better-auth on Postgres 16. Hand-rolled: RLS 1/1, shared acting person, 30-day sliding, 132 lines including schema/test. better-auth: sign-up/sign-in/Argon2id/30-day work, but the session `tenantId` is null after sign-in and the model is email-first with 4 core tables; rejected. ADR 0003 accepted; `SPEC.md` and `THIRD_PARTY.md` updated.

## M0-0.3 schema

- **Done.** 26 tables (25 tenant tables), forced RLS, composite `(tenant_id, id)` foreign keys, `tenant_by_slug` and `auth_lookup`. Testcontainers suite: 11 schema/isolation + 2 wrapper tests, plus 4 parity tests = 17 total; two tenants see only their own rows; unset tenant returns zero; cross-tenant FK rejected; expired/revoked/disabled tokens and tampered audit rows rejected. PR #5 merged; schema-review fixes merged in PR #7; CI green.

## M0-0.4 auth

- **Done.** Fastify auth: host tenancy, login/logout/me/change-password, Argon2id, opaque bearer token hashed at rest, 30-day sliding, shared-login acting person, `/brand`. 8 integration tests against Testcontainers; 25 tests total. PR #9 merged; CI green.

## M0-0.5 settings

- **Done.** Settings API: `/config` with fingerprint and `?fp=` delta; `/settings` read/write; lists upsert/delete; missing translations + set. 6 integration tests; 31 tests total. The Settings React UI is deferred to the web scaffold in M0-0.8.

## M0-0.6 seed

- **Done.** `seed:cosmos` loads 192 machines (CNC 125, Conventional 16, Process 17, Utility 30, DG 3, Robot 1), 14 people, 19 active + 3 inactive codes, 2 shifts, 144 glossary terms. Idempotent; seed report committed at `docs/plan/seed-report.md`. 2 integration tests; 33 tests total.

## M0-0.7 infrastructure

- **Authored and fixed for the external gate.** Terraform (VPC with two RDS AZs, EC2, RDS, S3, IAM/OIDC, Secrets Manager, EIP, Route 53 zone + `cosmos`/`cosmos.staging` records, no duplicate budget), SSM-based deploy (no public SSH), Docker Compose + Caddy, server image, deploy/rollback, restore runbook.
- `terraform init` + `validate` + `plan` green: **32 resources to create**, state in `argus-tfstate-118167167649`.
- **Blocked-external:** apply needs the registered domain and GitHub secrets (deploy-role ARN after apply); `terraform apply` is not run yet.

## M0-0.8 walking skeleton

- **Done locally.** Vite + React app (login, floor report, desk open list), minimal `POST /tickets` and `GET /state`. 37 tests.

## M1a domain core

- **Done:** figures (8 tests), permissions (6), state machine core + remaining commands (12). 57 tests total.
- **Next:** M1a-4 tickets API (row locks, idempotency), then M1a-5 floor/desk.

## Blocked / questions

Domain registration (uptimo.in recommended), raise AWS spend limit to $150, confirm management-account root MFA, Bhavin's export/Worker, shifts, code aliases.
