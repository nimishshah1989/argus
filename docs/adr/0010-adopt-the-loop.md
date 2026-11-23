# 0010 — Argus moves to the loop build process

**Date:** 2026-11-23 · **Status:** accepted (made while Nimish was away; he can reverse it)

## Context

Argus was built with pstack: an orchestrator plus `/poteto-mode` builders, about 75 vendored skills, its own hooks
in `.claude/harness/`, and the plan in `docs/plan/MILESTONES.md`. Nimish asked for every repo on his Mac to run
through the loop plugin (`.loop.json`, `PROJECT.md`, wireframe approvals, `loop-guard` + `loop-tests` CI).

## Decision

- `CLAUDE.md` is the loop template plus a short "Project specifics" section. `AGENTS.md` points to it.
- Removed: pstack skills, agents, rules and vendor notice. Kept: `impeccable` and Emil Kowalski's design skills.
- The product's own design system stays the source of truth (`docs/DESIGN.md`, `apps/web/src/ui/tokens.css`,
  the v2 kit, `docs/design/v2/`). It is listed as protected in `.loop.json`; the global kit is not copied in.
- The schema's source of truth is `packages/db/migrations/*.sql` (raw SQL, D02). There is no `db/schema.sql`.
- `loop-tests` runs the database-free suites (about 3,000 tests). The full suite with Postgres, the browser e2e
  and the gallery still run in `ci.yml` on every PR.
- `ci.yml`, `deploy.yml`, `backup.yml` and the repo's own guards (`tools/`, `pr-meta.yml`) stay.

## Rejected

- Copying the global kit over `apps/web/src/ui/tokens.css`: the repo's kit is more complete and enforced by
  `pnpm ui:check`.
- Running the full Postgres suite in `loop-tests`: it already runs sharded in `ci.yml`; a second copy doubles CI time.

## Consequences

- The old hooks in `.claude/harness/hooks/` are still wired in `.claude/settings.json`; the agent could not edit
  that file in this session. Until someone removes those four hook entries, the old hooks keep running beside the loop's.
- The `pstack@cursor-plugins` plugin is still enabled in `.claude/settings.json` for the same reason.
