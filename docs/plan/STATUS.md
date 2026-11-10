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
- `pnpm verify` green: format, lint, typecheck, 3 tests, build, parity (79 rows), licences, migrations, lean audit.

## In progress

- M0-0.1 scaffold: CI not yet observed on a pull request; Playwright/Testcontainers config and first database test land with M0-0.3.
- Auth spike (ADR 0003) pending.
- Figure strategy spike (`handsOn: lead | union`) pending.

## Next

1. Push session 1; watch the first CI run.
2. M0-0.3 schema v1 + RLS + generic isolation test (after the auth spike decision).
3. M0-0.4 auth; M0-0.5 settings; M0-0.6 seed + data-quality report.
4. Design track D0.1 (audit/role journeys) can start in parallel; no shared files with schema.

## Blocked / questions

See `docs/HANDOFF.md` and `docs/plan/NEEDS.md`: shifts, legacy code aliases, data use/consent, name/security reviewer, Bhavin’s export/Worker, AWS/domain/secrets.
