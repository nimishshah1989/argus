# Uptimo — Maintenance OS

A maintenance operating system for Indian factories: a breakdown is reported in three taps or a voice note, becomes a ticket with a named owner, two clocks and an escalation path, is closed with a coded report and signed off by production, and feeds analytics that forecast the next breakdown.

## Start here

| Path                                                   | What it is                                                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| [CLAUDE.md](CLAUDE.md)                                 | How we build (pstack): the loop, the rules, who decides, memory                                      |
| [docs/LEAN.md](docs/LEAN.md)                           | The anti-bloat ladder, hard size/complexity/dependency budgets and lean review                       |
| [docs/QUALITY-BAR.md](docs/QUALITY-BAR.md)             | The 9/10 senior-engineer scorecard used at M1b/M5 and R3 gates                                       |
| [docs/FRONTEND-STRATEGY.md](docs/FRONTEND-STRATEGY.md) | The role-first frontend, design system, screens, quality bar and design process                      |
| [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md)       | AWS-only, low-cost infrastructure: services, monthly cost, open-source stack, no Supabase/NAT/ALB    |
| [docs/spec/SPEC.md](docs/spec/SPEC.md)                 | The build specification: stack, product, milestones, architecture, data, non-functional requirements |
| [docs/spec/DOMAIN.md](docs/spec/DOMAIN.md)             | Entities, ticket state machine, permissions, API contract, exact figure definitions                  |
| [docs/spec/PARITY.md](docs/spec/PARITY.md)             | Everything Bhavin's two tools do, and our stance on each row                                         |
| [docs/HANDOFF.md](docs/HANDOFF.md)                     | Where things stand right now: live, in flight, next, blocked                                         |
| [docs/plan/](docs/plan/)                               | Backlog, needs, status and milestone gate reports                                                    |
| [docs/adr/](docs/adr/)                                 | Decisions, one page each, with what was rejected and why                                             |
| [docs/slices/](docs/slices/)                           | One plan per build ticket: files, interfaces, fields, tests                                          |
| [docs/discovery/](docs/discovery/)                     | The frozen discovery pack: source of both existing tools, inventories, research, council reviews     |

## Status

The M0 foundation and the M1a ticket core are merged: schema v1 with forced RLS and a
least-privilege API role, auth, settings/config, the Cosmos seed, the pure domain (figures,
permissions, state machine), the full ticket command API with idempotency, the floor and desk
faces, ticket lists, and a real-stack Playwright harness. The breakdown report form + PDF, live
board/kiosk, WhatsApp share text and an installable PWA shell are also merged; the C1–C3/M1–M4
core-issue fixes are in. `pnpm verify` (143 tests) and `pnpm test:e2e` are green, and CI runs both.
The M1b remainder (offline outbox, push, day-report PDF, import, Gujarati strings, cutover) and
M2–M4 are next. Parity stands at 12 done / 34 in-progress / 29 todo / 3 external / 1 waived of 79
rows — see [docs/plan/STATUS.md](docs/plan/STATUS.md) and [docs/HANDOFF.md](docs/HANDOFF.md).

## Layout

```
apps/web            Vite + React PWA: floor, desk, ticket detail, live board
apps/server         Fastify API: auth, settings/config, tickets, reports, PDF
packages/domain     state machine, figures, severity, SLA maths, permissions (pure, tested)
packages/db         plain-SQL migrations with forced RLS, `withTenant()`, Cosmos seed, isolation test
packages/shared     Zod schemas, settings schema, share text, constants
packages/engine     analytics port (from M4); python/ sidecar beside it
docs/spec           live SPEC, DOMAIN, PARITY, parity.yaml, QUESTIONS, DIFFERENCES
docs/plan           backlog, NEEDS, STATUS, gates/M0.md ...
docs/adr            decisions
docs/slices         one plan per ticket
docs/discovery      the frozen pack (reference, never code to copy)
infra/              Terraform, Docker Compose, Caddyfile, deploy and rollback scripts
```

## Ground rules

1. Bhavin's two tools are the minimum product. Every "Keep" row in PARITY works before Cosmos switches over.
2. Every tenant table has `tenant_id` and row-level security from its first migration, with an isolation test.
3. Nothing plant-specific in code; it is configuration.
4. The platform's numbers on Cosmos's data at a frozen as-of date are the answer key; legacy mode reproduces them; differences are logged.
5. No DT means repaired outside production hours (zero lost hours); it is not "running with a problem".
6. No AGPL/GPL code copied; permissive licences only, listed in `THIRD_PARTY.md`.
7. Data stays in AWS Mumbai; audit log kept at least one year.
8. AI suggests, people confirm; numbers come from code; codes are selected, never generated.
