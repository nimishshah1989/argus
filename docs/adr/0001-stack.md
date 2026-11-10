# 0001 — Stack

Date: 10 November 2026
Status: accepted

## Context

We are building a maintenance operating system for Indian factories, starting with Cosmos (about 150–192 machines, 15 maintenance users, about 250 tickets a month). Bhavin’s v3 ticket app and his single-file analytics platform are the parity floor. The earlier Atlas fork was rejected. The founder is non-technical; agents write and review the code, so the stack must be boring, typed, well documented, and easy for an agent to verify.

## Decision

**One TypeScript monorepo, one server process, one static web app, one Postgres, one S3 bucket, hosted in AWS Mumbai.**

| Layer     | Choice                                                                                  |
| --------- | --------------------------------------------------------------------------------------- |
| Runtime   | Node LTS, TypeScript strict, pnpm workspaces                                            |
| Server    | Fastify + Zod; pg-boss in the same process (`ROLE=api                                   | worker | all`); Pino |
| Database  | PostgreSQL 16+ on RDS; Drizzle ORM; SQL migrations with RLS                             |
| Web       | Vite + React + React Router + TanStack Query/Table + Tailwind + shadcn/ui; ECharts; PWA |
| PDFs      | Playwright + Chromium + Noto Gujarati/Devanagari                                        |
| Files     | S3 with versioning                                                                      |
| Jobs      | pg-boss delayed jobs; no Redis                                                          |
| Auth      | one design, decided by the M0 spike (ADR 0003)                                          |
| Infra     | AWS ap-south-1; EC2 + Docker Compose + Caddy; Terraform; GitHub Actions                 |
| Analytics | `packages/engine`, legacy profile first; Python sidecar only from M4 if needed          |

## Why

- **One language** for the ticket app, the analytics port and the web app; the analytics engine was always going to be TypeScript.
- **Boring parts**: Fastify, Postgres, React and Vite are mature, documented and easy for an agent to verify against current docs. No Next.js churn, no microservices, no Redis.
- **The domain is ours**, not an AGPL fork’s: Bhavin’s ticket model (shared phones, pause/resume, crews, handover, downtime) fits our schema; re-expressing it in Atlas would lose fidelity and time.
- **RLS in Postgres** is the strongest isolation at this scale; one shared schema is cheaper than database-per-tenant.
- **Playwright/Chromium** is the only reliable route for Gujarati/Devanagari PDFs.
- **AWS Mumbai** keeps the data in India; one small server is enough for a pilot.

## Rejected

- **Atlas CMMS fork** — AGPL, Java/Spring, React Native and React; would lose Bhavin’s model and add a licence boundary. Read-only reference.
- **Next.js** — fast-moving, server rendering buys nothing behind a login, and the PWA/offline story churns; Vite is simpler.
- **Microservices / Kubernetes / Redis** — no load for them; pg-boss and one process are enough.
- **Supabase / Vercel / Auth0** — managed layers and lock-in we do not need; see ADR 0002.
- **Separate mobile app** — the PWA serves the floor and needs no app store.

## Consequences

- We own the domain layer, the schema and the ops runbooks. That is the work.
- `ROLE=api|worker` is a flag, so splitting the worker later is mechanical.
- The Python sidecar is deferred until the analytics models outgrow TypeScript.
- Library versions move; every session checks the current docs before using an API.
