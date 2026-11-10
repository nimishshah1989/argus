# Where things stand

Under 50 lines. Read first, rewrite at session end.

## Live (merged on main)

- **UPTIMO** (renamed, #19). M0-0.7 gate fixes (#20) and EIP-only run (#22): SSM deploy, 2-AZ RDS, EIP, S3, IAM/OIDC, Secrets Manager, budget. Terraform `domain` is optional; Caddy HTTP `:80`; a bare-IP Host resolves the default tenant. **Not applied.**
- M0 foundation: schema+RLS, auth, settings/config, Cosmos seed, walking skeleton.
- M1a domain core + **tickets API (#23)**: full commands, `FOR UPDATE` row locks, `Idempotency-Key` replay, figures, `/state`, `/tickets/{id}`. 20 integration tests.
- **M1a-5a floor (#26)**: Tailwind v4 + TanStack Query + typed API client; three-tap report (machine search + segment/group chips, situation, problem + quick chips, work request, confirmation).
- **M1a-5b desk (#27)**: Open board (counts, team-now, three kind lists), ticket detail (facts, figures, timeline, people), state-dependent actions per DOMAIN §2.
- Repo is still `argus` on GitHub (rename + OIDC `github_repo` var pending).

## In flight

- Nothing.

## Next

- **M1a-5c** — `GET /tickets` list endpoint + Mine/Team/My-complaints; small desk nits: offer `update` on a handed-over open ticket, show vendor/handover/follow-up minutes, share the work-role set with the domain.
- **Playwright E2E harness** (server + seed + browser) for M1a-5 cases 3–6 (SPEC 1.3/1.4 acceptance); `test:e2e` is wired but there is no harness yet.
- Then **M1b** (SPEC 1.6–1.12): report form + PDFs, live board, push, offline outbox, Gujarati strings, Bhavin's import, cutover.
- Re-run `terraform validate/plan` before `apply` (terraform not installed locally).

## Known deferrals (see slice plans)

- `recordPastBreakdown`, breakdown-report rows + child tasks on close, PDF jobs, `correct` activeMin/waitMin overrides, the `/state` extra buckets, acknowledge/handback (M2), i18n/Gujarati and the board kiosk (M1b).

## Blocked / questions for Nimish

- Domain: **uptimo.in** recommended (registration pending).
- Raise AWS monthly spend $50 → $150; confirm management-root MFA.
- After apply: set GitHub secrets `AWS_ROLE_ARN`; bootstrap `/opt/uptimo`; then rename GitHub repo `argus → uptimo` + OIDC var.
- Bhavin export/Worker (M1b gate); shifts; legacy code aliases.

## Parallel rule

One orchestrator session. Children get fresh contexts and disjoint files; contract-first; never two writers on one file.
