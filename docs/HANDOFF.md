# Where things stand

Under 50 lines. Read first, rewrite at session end.

## Live (merged on main)

- **UPTIMO** (renamed, #19). M0-0.7 gate fixes (#20) and EIP-only run (#22): SSM deploy, 2-AZ RDS, EIP, S3, IAM/OIDC, Secrets Manager, budget. Terraform `domain` is optional; Caddy HTTP `:80`; a bare-IP Host resolves the default tenant. **Not applied.**
- M0 foundation: schema+RLS, auth, settings/config, Cosmos seed, walking skeleton.
- M1a domain core + **tickets API (#23)**: full commands, `FOR UPDATE` row locks, `Idempotency-Key` replay, figures, `/state`, `/tickets/{id}`. 20 integration tests.
- **M1a-5a floor (#26)**: Tailwind v4 + TanStack Query + typed API client; three-tap report.
- **M1a-5b desk (#27)**: Open board (counts, team-now, three kind lists), ticket detail (facts, figures, timeline, people), state-dependent actions.
- **M1a-5c lists (#29)**: `GET /tickets` (filterable, cursor-paginated, µs-precise cursor); desk Open/Mine/Team tabs; floor My complaints. 91 tests total.
- **M1a-5d web polish (#31)**: `.tsx` function/complexity/depth/param budgets now enforced; Floor/MachinePicker/ActionForm/TicketDetail split into small components; desk nits (Update on handed-over open, vendor/handover/follow-up minutes).
- Repo is still `argus` on GitHub (rename + OIDC `github_repo` var pending).

## In flight

- Nothing.

## Next

- **Playwright E2E harness** (server + seed + browser) for the floor→desk flows (SPEC 1.3/1.4); `test:e2e` is wired but there is no harness yet.
- Then **M1b** (SPEC 1.6–1.12): report form + PDFs, live board, push, offline outbox, Gujarati strings, Bhavin's import, cutover.
- Re-run `terraform validate/plan` before `apply` (terraform not installed locally).

## Known deferrals (see slice plans)

- `recordPastBreakdown`, breakdown-report rows + child tasks on close, PDF jobs, `correct` activeMin/waitMin overrides, the `/state` extra buckets, acknowledge/handback (M2), i18n/Gujarati and the board kiosk (M1b).

## Models

- Bedrock is configured in `~/.dsh/profiles/desktop/cordis.patch.yml` (`amazon-bedrock`, `apiKeyEnv: AMAZON_BEDROCK_API_KEY`). It loads only at harness startup — **restarting the app should make its models appear**; then check `list_subagent_models` and wire model-per-task routing (strong model for plan/review, cheap model for build).

## Blocked / questions for Nimish

- Domain: **uptimo.in** recommended (registration pending).
- Raise AWS monthly spend $50 → $150; confirm management-root MFA.
- After apply: set GitHub secrets `AWS_ROLE_ARN`; bootstrap `/opt/uptimo`; then rename GitHub repo `argus → uptimo` + OIDC var.
- Bhavin export/Worker (M1b gate); shifts; legacy code aliases.

## Parallel rule

One orchestrator session. Children get fresh contexts and disjoint files; contract-first; never two writers on one file.
