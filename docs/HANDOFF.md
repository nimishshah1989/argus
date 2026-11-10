# Where things stand

Under 50 lines. Read first, rewrite at session end.

## Live (merged on main)

- **UPTIMO** (renamed, #19). M0-0.7 gate fixes (#20) and EIP-only run (#22): SSM deploy, 2-AZ RDS, EIP, S3, IAM/OIDC, Secrets Manager, budget. Terraform `domain` is now optional — empty skips Route 53; Caddy defaults to HTTP `:80`; a bare-IP Host resolves the default tenant. **Not applied.**
- M0 foundation: schema+RLS, auth, settings/config, Cosmos seed, walking skeleton.
- M1a domain core: figures, permissions, full state machine (57 tests).
- **M1a-4 tickets API (#23)**: full command endpoints (raise, start/join/leave, pause/resume, transfer, update, machine-running/stopped, close, report, cancel/restore, correct, upgrade-kind) + `GET /state` and `GET /tickets/{id}`, over `transition()`. `FOR UPDATE` row locks, `Idempotency-Key` replay, figures recomputed/persisted. 20 integration tests; 83 total.
- Repo is still `argus` on GitHub (rename + OIDC `github_repo` var pending).

## In flight

- Nothing.

## Next

- **M1a-5 floor and desk** — plan written in `docs/slices/M1a-5.md`. Build in order:
  1. **M1a-5a** — scaffold (Tailwind + TanStack Query + typed api client, first commit), then the Floor face (SPEC 1.3).
  2. **M1a-5b** — Desk face (SPEC 1.4): Open board, ticket detail, state-dependent actions.
  3. **M1a-5c** (follow-up) — `GET /tickets` list endpoint + Mine/Team/My-complaints.
- Re-run `terraform validate/plan` before `apply` (terraform not installed on this machine; the optional-`domain` HCL change is unverified there).

## Known deferrals (M1a-4 out of scope, see the slice plan)

- `recordPastBreakdown`, breakdown-report rows + child tasks on close, PDF jobs, `correct` activeMin/waitMin overrides, the `/state` extra buckets, acknowledge/handback (M2).

## Blocked / questions for Nimish

- Domain: **uptimo.in** recommended (registration pending).
- Raise AWS monthly spend $50 → $150; confirm management-root MFA.
- After apply: set GitHub secrets `AWS_ROLE_ARN`; bootstrap `/opt/uptimo`; then rename GitHub repo `argus → uptimo` + OIDC var.
- Bhavin export/Worker (M1b gate); shifts; legacy code aliases.

## Parallel rule

One orchestrator session. Children get fresh contexts and disjoint files; contract-first; never two writers on one file.
