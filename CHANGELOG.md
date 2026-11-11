# Changelog

All notable changes to this product. Format: Keep a Changelog. The build is pre-release: it runs
locally and in CI, but there is no staging or production deployment yet.

## Unreleased

### Added

- Day report PDF (#56): `GET /reports/day.pdf` renders a per-person day report (clipped work minutes, day total, pending-at-end) by day or shift, stored in the file store; role-gated, technicians own-only.
- Needs-report list (#54): a breakdown closed without a report appears on a 7-day needs-report list on the desk, scoped to the acting person (management sees all); the late report clears it.
- M1b actions (#52): desk Join/Leave (crew-aware; the lead counts as crew) and Cancel from working; floor Cancel-own for the caller's own not-started ticket.
- i18n layer (M5, #50): i18next + react-i18next with a 202-key English catalogue and a Gujarati placeholder that falls back to English; every web screen's copy extracted to translation keys; `i18next/no-literal-string` enforced so new hard-coded UI text fails CI.
- Web push (AC5c, #48): VAPID push subscribe/unsubscribe/key/test endpoints, a custom service
  worker with a push handler and tap-to-open, and the acting-person re-subscribe rule with a desk
  toggle.
- Offline outbox (AC5b, #47): closes and late reports made offline are queued in IndexedDB with
  their Idempotency-Key and chosen time, replayed in order on reconnect, and a `409` becomes a
  visible draft; reads fall back to the cached state/config with an offline banner.
- Process checks (M6/M7/M8/M10): Playwright e2e runs in the CI `checks` job; migration
  immutability and parity-update guards fail a PR that edits an existing migration or changes
  `apps/`/`packages/` without the ledger; the parity ledger is backfilled (13 done, 35
  in-progress, 3 external of 79); STATUS, README, HANDOFF and the PR template match the code.
- WhatsApp share text + PWA install/shell (AC5a, #40): one pure short/full share text with
  `wa.me` buttons on the sent screen and ticket detail; two installable manifests, icons and a
  service-worker app-shell precache.
- Breakdown PDF (AC3b, #37): `GET /tickets/{id}/pdf` renders an A4 breakdown report (platform-v1
  QR, embedded Gujarati fonts) via headless Chromium and stores it as a `file` row.
- Live board and kiosk (AC4, #36): `/desk/board` tiles every machine by segment and group with
  live status, counts, filters and a work-request footer; `?kiosk=1` for a wall screen, 30s refresh.
- Breakdown report form (AC3a, #35): close-with-report / late report capture the full report
  (category, maintenance code, spare, root cause, handover, done/supported people) with server
  defaults and show it on the ticket.
- End-to-end harness (M1a-e2e, #33): `pnpm test:e2e` boots the real stack (Postgres Testcontainer,
  migrated + seeded, API + Vite) and drives the floor raise and the full desk ticket lifecycle
  through a browser on desktop and phone; dev proxy Host and vitest timeouts fixed.
- Web polish (M1a-5d, #31): React `.tsx` files obey the same function/complexity/depth/param
  budgets as `.ts`; Floor/MachinePicker/ActionForm/TicketDetail split into small components;
  handed-over open tickets can be updated and the figures panel shows vendor, handover and
  follow-up minutes.
- Ticket lists (M1a-5c, #29): `GET /api/v1/tickets` — filterable by status/kind/machine/person/
  reporter/date, cursor-paginated with microsecond-precise keyset; desk Open/Mine/Team tabs and a
  floor My complaints list. 8 integration tests.
- Desk face (M1a-5b, #27): Open board (counts strip, team-now, Breakdowns/Tasks/Work lists),
  ticket detail with facts, live figures, timeline and people, and the state-dependent action set.
- Floor face (M1a-5a, #26): Tailwind design system + TanStack Query, a typed API client with
  per-request Idempotency-Key, and a three-tap report with search/chips/situations/confirmation.
- Tickets API (M1a-4, #23): every command over the domain state machine, `FOR UPDATE` row locks,
  `Idempotency-Key` replay, figures recomputed and persisted, `GET /state` and `/tickets/{id}`.
- Infrastructure, EIP-only (M1a-4, #22): run without a domain; optional Terraform `domain`, Caddy
  HTTP `:80`, and a bare-IP Host resolves the default tenant.
- State machine complete (M1a-3b, #18): join, leave, upgrade-kind, late-report, restore, correct,
  record-past-breakdown.
- Domain state machine (M1a-3, #17): raise, start, pause, resume, transfer, update,
  running/stopped, close, cancel as pure transitions with time clamping and permission gates.
- Domain permissions (M1a-2, #16): the §3 matrix as pure functions.
- Domain figures engine (M1a-1, #15): exact response, hands-on union, waiting/vendor, handover,
  downtime, follow-up, repair and per-person minutes with overrides.
- Walking skeleton (M0-0.8, #14): Vite + React web app (login, floor, desk), minimal ticket raise
  and open list.
- Infrastructure (M0-0.7, #13): Terraform for ap-south-1, Docker Compose + Caddy, server image,
  deploy/rollback script, restore runbook and deploy workflow. Apply is blocked on AWS credentials.
- Cosmos seed (M0-0.6, #12): `seed:cosmos` loads tenant zero from the discovery files with a
  committed seed report. 2 integration tests.
- Settings (M0-0.5, #11): `/config` with fingerprint and `?fp=` delta, `/settings`, list CRUD with
  flags, missing-translations list and translation upsert. 6 integration tests.
- Auth (M0-0.4, #9): Fastify `login/logout/me/change-password` and `/brand`, Argon2id, opaque
  bearer token hashed at rest, 30-day sliding sessions, shared-login acting person. 8 integration
  tests.
- Schema v1 (M0-0.3, #5, #7): 26 tables, forced RLS, composite tenant foreign keys, `app_router`
  functions, `withTenant()` and a two-tenant Testcontainers isolation suite.
- Repository bootstrap: discovery pack under `docs/discovery/`, live spec under `docs/spec/`,
  build layout under `apps/`, `packages/`, `infra/`.
- `docs/BUILD-PROTOCOL.md`, `docs/WORKFLOW.md`, `docs/SKILLS.md`, `docs/REVIEW-MECHANISMS.md`,
  `docs/ORCHESTRATION.md`, `docs/FRONTEND-STRATEGY.md`, `docs/INFRASTRUCTURE.md`, `docs/TESTING.md`.
- ADRs 0001 (stack), 0002 (hosting and outside services), 0003 (auth), 0004 (commercial layer
  deferred).
- `docs/spec/parity.yaml` with 79 rows and stable ids; the template `docs/plan/backlog.md`;
  `NEEDS.md`; `QUESTIONS.md` and `DIFFERENCES.md`.
- Root tooling: pnpm workspace, TypeScript, ESLint, Prettier, Vitest, Playwright/Testcontainers,
  parity/licence/migration checks, CI; anti-bloat mechanism (Ponytail skill, `docs/LEAN.md`,
  `docs/QUALITY-BAR.md`, file/function/dependency/PR-size/shortcut checks).

### Changed

- RLS on the real request path (C1, #42): migration `0002_app_api_role.sql` adds the least-privilege
  `app_api` login role; the server connects as it; `withTenant` fails fast without a tenant.
- Idempotency bound to command + login + request hash (M4, #44): replay only for the same request,
  422 `idempotency_key_reused` otherwise, 24h expiry.
- Correction audit + overrides (C3/M3, #43): `edit` events store from/to, admin-only with a 7-day
  window and time invariants; hands-on/waiting overrides; past breakdowns no longer invent hands-on
  time.
- Clocks on cancel/restore (C2/M1/M2, #41): self-started tickets go to in-progress; cancel stops
  downtime/waiting/handover clocks; restore resumes the waiting clock.
- Duplicate-machine raise race (#38): a concurrent same-key raise replays the committed result.
- Schema review fixes (#7): normalised report people, tenant-scoped push endpoints, restricted
  person deletion, append-only audit log, hot-path indexes and a non-negative downtime check.
- Infra gate fixes (#20): RDS multi-AZ subnets, EIP + Route 53 records, SSM deploy (no public SSH),
  real S3 backend with lockfile, single budget (account-managed), `terraform.tfvars`/state ignored.
- Auth: hand-rolled sessions chosen by the M0 spike (ADR 0003); better-auth removed from the spec
  and `THIRD_PARTY.md`.
- Commercial shape: managed pilot first; billing and self-serve deferred to after M6.
- Hosting: AWS-only, low-cost; no Supabase, Vercel, Redis, NAT, ALB, ECS or paid APM.
- Secrets: Secrets Manager in production, SSM Parameter Store in staging.
- Local S3: LocalStack or s3rver, not MinIO (AGPL).

### Not yet

- No staging deploy, no web push, no offline outbox, no day-report PDF, no import, no i18n, no
  analytics.
