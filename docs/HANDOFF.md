# Where things stand

Under 50 lines. Rewrite the top part at the end of every session: live, in flight, next, blocked.

## Live

- Repo `nimishshah1989/argus` is **private** and restructured: `docs/spec/` is the live spec, `docs/discovery/` is the frozen pack, `apps/`, `packages/`, `infra/` are placeholders, `docs/plan|adr|slices/` are ready.
- No product code, no CI, no `package.json` yet. This is the foundation, not the build.

## In flight

- Build-readiness review: `docs/discovery/review/04-build-readiness-review.md`.
- Working agreement: `docs/BUILD-PROTOCOL.md`; review ladder: `docs/REVIEW-MECHANISMS.md`; goal/graph and parallel policy: `docs/ORCHESTRATION.md`.

## Next

1. Session 1 (no product code): `docs/WORKFLOW.md`, `docs/SKILLS.md`, ADR 0001–0003, `docs/spec/parity.yaml`, `docs/plan/backlog.md`, `NEEDS.md`, `QUESTIONS.md`, `DIFFERENCES.md`, CI, `docs/TESTING.md`.
2. Four one-week spikes: auth (better-auth vs custom), RLS + generic isolation test, `handsOn: lead|union` figures, two PWA manifests.
3. M0: schema v1 + `seed:cosmos` + seed/data-quality report; brand/login/config; floor raise → desk Open on local Docker Compose.
4. Frontend: design audit, role journeys, design tokens + component library, clickable prototypes, then screens in vertical slices. Arrange 3–5 operator/technician usability sessions at Cosmos.

## Decided

- Commercial shape: managed pilot for Cosmos; billing, self-serve signup, plan enforcement and invoices are **deferred to after M6** (ADR 0004). Tenant setup is manual until then.
- Stack: own TypeScript monorepo per `docs/spec/SPEC.md` §0/§5; no Atlas fork, no Next.js, no microservices.
- v1 schema: `tenant_id` only, no `plant` and no settings scopes until M5.
- Auth: one design; the M0 spike chooses hand-rolled sessions or better-auth, recorded as ADR 0003.
- Figures: `handsOn: lead|union` strategy; Bhavin's Worker source required before freezing.

## Blocked / questions for Nimish

- Shifts: two windows (08:00–18:30, 18:29–05:00) or three shifts? The report form lists 3, the live config has 2.
- Legacy codes: approve `MEC → M`, `NI/INT/FS/PP/UTI → MIS` (or inactive), for Bhavin to confirm?
- Data use/consent: may Cosmos real data be used in staging/fixtures; what DPA/consent text for phone numbers and voice notes?
- Name/owner: Argus or Maintenance OS; and who is the human senior engineer who signs off tenant isolation before cutover and plant two?

## External inputs still missing

- Bhavin's live ticket export and Worker source (hard gate for M1b).
- Current platform HTML + latest Excel export; the PM tool (M4).
- Consented staff phone numbers and 50–100 Gujarati voice notes (M3).
- AWS account + domain + GitHub secrets; Meta developer app/number/templates; Sarvam key (M0/M3).
