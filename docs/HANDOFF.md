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
- **E2E harness (#33)**: `pnpm test:e2e` boots the real stack (Postgres Testcontainer → migrate → seed → API → Vite) and drives the floor raise + the full desk lifecycle, Open/Mine/Team and My complaints; also fixed the dev proxy Host and raised the vitest timeout for Testcontainers.
- **Breakdown report form (#35, AC3a)**: close-with-report / late report accept a validated breakdown report, stored with its done/supported people and returned on `/tickets/:id`; desk gets the pre-filled form and a report card.
- **Live board + kiosk (#36, AC4)**: `/desk/board` reads config+state into segment/group tiles, counts, filters, work footer; `?kiosk=1` hides nav; 30s refresh.
- **Breakdown PDF (#37, AC3b)**: `GET /tickets/:id/pdf` renders an A4 report (platform-v1 QR, embedded Gujarati system fonts) via headless Chromium, stores a `file` row through an S3-shaped local adapter. CI installs Chromium.
- **Flaky-raise fix (#38)**: concurrent same-`Idempotency-Key` raises replay the committed result instead of a spurious 409.
- Repo is still `argus` on GitHub (rename + OIDC `github_repo` var pending).

## In flight

- Nothing.

## Next

- **AC5** — M1b web push + offline outbox (service worker, 409 drafts) + WhatsApp share text (SPEC 1.8/1.9).
- Then **M1b remaining**: PWA manifests/install (1.9), import (1.10, external), Gujarati strings (1.11, external), cutover (1.12).
- **Follow-ups**: implement `GET /files/{id}` (the PDF is stored but not yet streamed); cache PDFs (each GET re-renders); bundle Noto Sans Gujarati in the deploy image; split `api.ts` types; add the board's cancelled-24h tile status; floor cancel-own + desk join/leave E2E steps; wire Playwright into CI.
- Re-run `terraform validate/plan` before `apply` (terraform not installed locally).

## Known deferrals (see slice plans)

- `recordPastBreakdown`, breakdown-report rows + child tasks on close, PDF jobs, `correct` activeMin/waitMin overrides, the `/state` extra buckets, acknowledge/handback (M2), i18n/Gujarati and the board kiosk (M1b).

## Models

- The Bedrock plugin (`@deepseek-ai/dsh-llm-pi-ai`, 40+ providers) is installed and active, and `~/.dsh/profiles/desktop/cordis.patch.yml` configures `amazon-bedrock` with `apiKeyEnv: AMAZON_BEDROCK_API_KEY` (valid; credential stored). It is **blocked only by the session's model-selection policy** ("not allowed for this Session"): add the provider + model IDs in GUI **Settings → Models**. Suggested: `anthropic.claude-fable-5-1` (architecture), `anthropic.claude-sonnet-5-5` (review), `anthropic.claude-haiku-5-5` (build).

## Blocked / questions for Nimish

- Domain: **uptimo.in** recommended (registration pending).
- Raise AWS monthly spend $50 → $150; confirm management-root MFA.
- After apply: set GitHub secrets `AWS_ROLE_ARN`; bootstrap `/opt/uptimo`; then rename GitHub repo `argus → uptimo` + OIDC var.
- Bhavin export/Worker (M1b gate); shifts; legacy code aliases.

## Parallel rule

One orchestrator session. Children get fresh contexts and disjoint files; contract-first; never two writers on one file.
