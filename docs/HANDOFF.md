# Where things stand

Under 50 lines. Rewrite the top part at the end of every session: live, in flight, next, blocked.

## Live

- Session 1 merged (#1), then the auth spike. No product code yet. Repo private, CI green, `pnpm verify` green locally.
- Auth spike done: **hand-rolled sessions chosen** (ADR 0003 accepted); better-auth rejected. Evidence in `docs/plan/spikes/auth.md`.
- 79 parity rows in `docs/spec/parity.yaml`; 34 spec tickets + 4 design tickets in `docs/plan/backlog.md`; 21 questions and 18 differences recorded.
- Anti-bloat mechanism live: `docs/LEAN.md`, `docs/QUALITY-BAR.md`, `.claude/skills/ponytail/`, file/function/dependency/PR-size/shortcut checks.
- `M0-0.2` done; `M0-0.1` in progress (CI not yet observed on a PR; Playwright/Testcontainers config lands with M0-0.3).

## In flight

- Nothing running. Next is M0-0.3 schema v1 + RLS, then M0-0.4 auth implementation. The figure strategy spike remains before M1b.

## Next

1. M0-0.3: schema v1 + RLS + generic isolation test + `app_router` functions (`tenant_by_slug`, `auth_lookup`).
2. M0-0.4 auth using ADR 0003; M0-0.5 settings; M0-0.6 seed + data-quality report; M0-0.7 infrastructure; M0-0.8 walking skeleton.
3. Design track D0.1 (audit/role journeys) can run in parallel; it touches no schema files.

## Decided

- Commercial: managed pilot; billing/self-serve deferred to after M6 (ADR 0004).
- Infrastructure: AWS-only, no Supabase/Vercel/Redis/NAT/ALB; RDS production, one Graviton EC2 per environment; ~$60–95/month both environments (ADR 0002, `docs/INFRASTRUCTURE.md`).
- Auth: **hand-rolled sessions final** (ADR 0003): Argon2id, opaque token hashed at rest, 30-day sliding, shared phones, per-device revoke; better-auth rejected.
- v1 schema: `tenant_id` only; no `plant`/settings scopes until M5.
- Figures: `handsOn: lead | union` strategy; Bhavin’s Worker source required before freezing.
- Lean: 400-line file, 60-line function, complexity 12, no new runtime dependency without an ADR; 9/10 quality scorecard at M1b/M5.

## Blocked / questions for Nimish

- Shifts: two windows (08:00–18:30, 18:29–05:00) or three shifts?
- Legacy codes: `MEC → M`, `NI/INT/FS/PP/UTI → MIS` (or inactive) — Bhavin to confirm.
- Data use/consent for staging/fixtures and phone/voice data.
- Product/repo name (Argus or Maintenance OS) and the human security reviewer.

## External inputs still missing

- Bhavin’s ticket export + Worker source (M1b hard gate); current platform HTML + Excel (M4a); PM tool (M4b).
- Consented phone numbers + voice notes (M3); Gujarati translations (M1b).
- AWS account/domain/secrets; Meta app/number/templates; Sarvam key.
