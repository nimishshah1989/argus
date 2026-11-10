# Where things stand

Under 50 lines. Read first, rewrite at session end.

## Live (merged on main)

- **UPTIMO** (renamed, #19). M0-0.7 gate fixes merged (#20): SSM deploy, 2-AZ RDS subnet group, EIP + Route 53 (`cosmos.<domain>`, `cosmos.staging.<domain>`), real S3 backend, single account budget. `terraform init/validate/plan` green — 32 resources, **not applied**.
- M0 foundation code done (0.1–0.8): schema+RLS, auth, settings/config, Cosmos seed, walking skeleton (runs locally: `pnpm dev` server + `pnpm --filter @uptimo/web dev`).
- M1a domain core done: figures, permissions, full state machine (57 tests). Next: **M1a-4 tickets API**.
- Repo is still `argus` on GitHub (rename + OIDC `github_repo` var pending).

## In flight

- Nothing.

## Next (new session, run PARALLEL)

1. Read this file and `docs/slices/M1a-4.md`.
2. Spawn worker teammates with disjoint write scopes:
   - **api worker** — `apps/server/src/tickets.ts` full commands, `FOR UPDATE` row locks, `Idempotency-Key` replay, `/state`, `/tickets/{id}`; fix the `pg` client-reuse warning in `config.ts`.
   - **test worker** — integration tests for every command, replay, and row-lock concurrency.
   - **reviewer** — fresh-context review of each PR against the plan.
3. Merge on green, then M1a-5 floor/desk.

## Blocked / questions for Nimish

- Domain: **uptimo.in** recommended (registration pending).
- Raise AWS monthly spend $50 → $150; confirm management-root MFA.
- After apply: set GitHub secrets `AWS_ROLE_ARN`; bootstrap `/opt/uptimo`; then rename GitHub repo `argus → uptimo` + OIDC var.
- Bhavin export/Worker (M1b gate); shifts; legacy code aliases.

## Parallel rule

One orchestrator session. Children get fresh contexts and disjoint files; contract-first; never two writers on one file.
