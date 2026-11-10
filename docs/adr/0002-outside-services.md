# 0002 — Hosting and outside services

Date: 10 November 2026
Status: accepted

## Context

The pilot is one plant, about 15 users, 192 machines and 250 tickets a month. Data must stay in India. The founder is cost-sensitive and wants open-source and free tools wherever they are sound. The stack is already decided: TypeScript, Fastify, Postgres, a static React PWA.

## Decision

**All backend compute, data and files run in AWS Mumbai (ap-south-1). No Supabase, no Vercel, no managed auth, no Redis, no paid APM, no paid BI.**

- One EC2 per environment (Graviton t4g), Docker Compose, Caddy for TLS and static files.
- Production database: RDS Postgres db.t4g.micro with automated backups and PITR. Staging: Postgres in Docker (or a separate database on RDS).
- S3 for files and backups with versioning and lifecycle; SES for transactional email.
- SSM Parameter Store for secrets; CloudWatch for logs and alarms; Route 53 for DNS and health checks; GitHub Actions + GHCR for CI and images.
- No NAT Gateway, ALB, ECS/EKS, CloudFront, ElastiCache or Lambda in the pilot.
- Outside services only where there is no good local substitute: Meta WhatsApp Cloud API (M3), Sarvam speech-to-text (M3), browser push services (M1). An error tracker is optional; CloudWatch logs are the pilot default. Any LLM provider for M6 needs its own decision record.
- Open-source dependencies only under MIT, Apache-2.0, BSD, ISC, MPL-2.0 or OFL; no AGPL/GPL code; `THIRD_PARTY.md` is checked in CI.

## Why

- Supabase would add a managed layer we do not need: our schema, RLS, sessions and files are already designed, and a plain RDS keeps the data and the exit path ours.
- One small server plus Postgres is enough for the pilot. Managed containers, Redis, a load balancer and a NAT gateway add monthly cost and failure modes without a customer.
- The one paid managed service worth it is RDS: backups, PITR and patching are the difference between a bad day and a lost company.
- Caddy, Terraform, pg-boss, Playwright, ECharts and the rest are mature, permissively licensed and free. We choose a small set, not a pile.

## Consequences

- One EC2 is a single point of failure. We add a status-check recovery alarm, snapshots and a rebuild runbook; a warm standby is a later decision.
- Single-AZ RDS for the pilot; Multi-AZ is a later cost.
- We own more operations than a managed platform would: patching, backups, monitoring. The runbooks are part of M0.
- The cost is roughly $60–95/month for both environments, before WhatsApp and speech, which is below the earlier $110–150 estimate.
- Data stays in India for the backend. WhatsApp, Sarvam and browser push necessarily leave the region; each is documented and capped. An error tracker that stores data outside India needs PII scrubbing and a note.

## Rejected

- **Supabase / Vercel / Auth0:** unnecessary managed layers, per-seat or usage pricing, and lock-in.
- **Redis/ElastiCache:** pg-boss keeps the queue in Postgres.
- **NAT Gateway + private EC2:** ~$32/month plus complexity; public EC2 with a tight security group and private RDS is enough.
- **ALB/ECS/EKS:** orchestration for a handful of containers.
- **Multi-AZ RDS at launch:** doubles the database bill before a customer needs it.
- **Paid APM/BI/PDF/queue/feature flags:** no reader or no need at this scale.
