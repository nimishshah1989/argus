# Uptimo — Maintenance OS

A maintenance operating system for Indian factories: a breakdown is reported in three taps or a voice note, becomes a ticket with a named owner, two clocks and an escalation path, is closed with a coded report and signed off by production, and feeds analytics that forecast the next breakdown.

## Start here

| Path                                                   | What it is                                                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| [docs/BUILD-PROTOCOL.md](docs/BUILD-PROTOCOL.md)       | How we build: roles, slicing, reviews, cadence, architecture, tables, tenancy, memory and skills     |
| [docs/REVIEW-MECHANISMS.md](docs/REVIEW-MECHANISMS.md) | The review ladder, risk tiers, proof for every backend capability, and CI gates                      |
| [docs/LEAN.md](docs/LEAN.md)                           | The anti-bloat ladder, hard size/complexity/dependency budgets and lean review                       |
| [docs/QUALITY-BAR.md](docs/QUALITY-BAR.md)             | The 9/10 senior-engineer scorecard used at M1b/M5 and R3 gates                                       |
| [docs/ORCHESTRATION.md](docs/ORCHESTRATION.md)         | Goal loop, graph loop, parallel workers and the orchestrator                                         |
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

Session 1 foundation is complete: workflow, skills, ADRs, 79-row parity ledger, 38-ticket backlog, questions/differences, the lean mechanism, root tooling and CI. No product code yet. `pnpm verify` is green locally. Next is the auth spike, then M0-0.3 schema v1 with RLS. See [docs/HANDOFF.md](docs/HANDOFF.md) and [docs/plan/STATUS.md](docs/plan/STATUS.md).

## Layout

```
apps/web            Vite + React PWA: floor, desk, board, analytics, settings
apps/server         Fastify API + pg-boss jobs (ROLE=api|worker|all)
packages/domain     state machine, figures, severity, SLA maths, permissions (pure, tested)
packages/db         Drizzle schema, SQL migrations with RLS, seeds, imports, isolation test
packages/shared     Zod schemas, settings schema, i18n messages, constants
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
