# Infrastructure — AWS only, low cost, open source first

Decision: **all backend compute, data and files live in AWS Mumbai (ap-south-1). No Supabase, no Vercel, no managed auth, no Redis, no paid BI, no paid PDF service, no paid queue.** The product is a small number of boring open-source parts on one server plus a managed Postgres.

The one managed service worth paying for is **RDS Postgres**. Data loss is existential; a self-hosted database on the same box saves about $15–20 a month and costs backups, point-in-time recovery and sleep. Staging can self-host; production should not.

## 1. The shape

```
Route 53 (DNS) ──► Elastic IP ──► EC2 t4g.medium (Mumbai)
                                   ├─ Caddy (TLS, static web, reverse proxy)
                                   ├─ Docker: server (Fastify + pg-boss, ROLE=all)
                                   └─ Playwright/Chromium for PDFs (same image, concurrency 1)
                                          │
                                          ├─► RDS Postgres db.t4g.micro (private subnet)
                                          ├─► S3 (PDFs, photos, voice notes, backups; versioned)
                                          ├─► SES (email)
                                          ├─► SSM Parameter Store (secrets, free)
                                          └─► CloudWatch (logs, alarms, 7-day retention)

GitHub Actions ──OIDC──► AWS (no long-lived keys) ──► GHCR image ──► EC2 docker compose pull/up
```

No NAT Gateway, no Application Load Balancer, no ECS/EKS, no CloudFront initially, no ElastiCache, no Lambda. Each of those is a real monthly bill or a new failure mode for a pilot with 15 users.

## 2. What runs, and what it costs

Ranges are **approximate, on-demand, ap-south-1, and must be verified on the AWS Pricing Calculator** before the M0 gate. They are deliberately conservative.

| Piece                 | Choice                                                                               | Why                                                                                                 | Approx / month                      |
| --------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Compute (production)  | EC2 **t4g.medium** (2 vCPU, 4 GB, Graviton)                                          | One box runs Caddy, the server and the job queue; 4 GB is the minimum for Chromium PDFs             | $25–35                              |
| Compute (staging)     | EC2 **t4g.small** (2 vCPU, 2 GB)                                                     | Staging is low traffic; no PDF load most days                                                       | $12–18                              |
| Database (production) | RDS **db.t4g.micro**, 20 GB gp3, 7-day automated backups                             | Managed backups, PITR, patching; the one thing not worth self-hosting                               | $15–20                              |
| Database (staging)    | Postgres 16 in Docker on the staging EC2, or a second database on the production RDS | Disposable; saves the second RDS                                                                    | $0–15                               |
| Files                 | S3 Standard, versioning, lifecycle (voice notes 90 days)                             | Pennies at pilot volume                                                                             | $1–3                                |
| Email                 | SES                                                                                  | Transactional only; starts in sandbox                                                               | <$1                                 |
| DNS                   | Route 53 hosted zone + health check                                                  | AWS-only; free health-check alerting via SNS email                                                  | $1                                  |
| Logs / alarms         | CloudWatch, 7-day retention, a few alarms                                            | Enough for a pilot; no paid APM                                                                     | $2–5                                |
| Secrets               | Secrets Manager (production) / SSM Parameter Store (staging)                         | Secrets Manager is $0.40/secret and gives rotation/audit; SSM standard is free and fine for staging | $0–3                                |
| Container registry    | GitHub Container Registry                                                            | Free for this size; avoids ECR                                                                      | $0                                  |
| CI                    | GitHub Actions (Linux)                                                               | Within the free minutes for a private repo of this size                                             | $0                                  |
| TLS                   | Caddy + Let's Encrypt                                                                | Free, automatic                                                                                     | $0                                  |
| Uptime                | Route 53 health check → SNS email                                                    | AWS-only, no external monitor needed                                                                | <$1                                 |
| **Subtotal**          |                                                                                      |                                                                                                     | **≈ $55–85 for both environments**  |
| Domain                | Registrar                                                                            | Needed for the app, SES and Meta                                                                    | ~$10–15 / year                      |
| WhatsApp              | Meta Cloud API                                                                       | Per utility message; caps enforced                                                                  | variable                            |
| Speech                | Sarvam                                                                               | Per minute; daily cap                                                                               | variable                            |
| **Total**             |                                                                                      |                                                                                                     | **≈ $60–95 / month before credits** |

That is below the spec’s $110–150 estimate because we removed NAT, ALB, a second RDS in staging, paid observability and paid auth. If you run **one environment only** until cutover, it is roughly **$50–70/month**.

**Absolute minimum (not recommended for production):** one t4g.small, self-hosted Postgres, no RDS — about **$15–25/month**. You lose managed backups, PITR and patching, and you will spend the difference in risk and time. Use this only for a temporary staging box.

**Free tier / credits:** do not architect on the free tier; it changes and it is time-limited. Apply for AWS Activate credits if eligible; treat them as a discount, not a plan.

## 3. What we deliberately do not buy

| Not used                       | Why                                                                                                                         | What we use instead                                           |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Supabase                       | Managed Postgres + auth + storage + functions we do not need; per-seat auth and vendor lock-in; our RLS and schema are ours | RDS Postgres + our own sessions + S3                          |
| Vercel / Netlify               | The web app is static; one more vendor and bill                                                                             | Caddy on the same EC2                                         |
| Auth0 / Clerk / Firebase Auth  | Per-user pricing for 15–250 users; our shared-phone model is custom                                                         | Hand-rolled sessions or better-auth                           |
| Redis / ElastiCache            | pg-boss keeps the queue in Postgres                                                                                         | pg-boss                                                       |
| NAT Gateway                    | ~$32/month before traffic; unnecessary with a public subnet for EC2 and a private subnet for RDS                            | Internet Gateway + security groups + S3 gateway endpoint      |
| Application Load Balancer      | One EC2; Caddy terminates TLS and proxies                                                                                   | Caddy                                                         |
| ECS / EKS / Fargate            | Orchestration for a handful of containers                                                                                   | Docker Compose                                                |
| CloudFront                     | Adds a vendor and a bill; Caddy serves static files close to the plant                                                      | Caddy; add CloudFront only if traffic or geography demands it |
| Datadog / New Relic / paid APM | Cost with no reader at this scale                                                                                           | CloudWatch + JSON logs + health checks                        |
| Paid BI / dashboards           | The analytics engine is ours                                                                                                | Postgres + ECharts                                            |
| Paid PDF / document service    | Chromium shapes Indic scripts correctly                                                                                     | Playwright                                                    |
| Paid feature flags             | One small settings table                                                                                                    | `setting`                                                     |
| Paid import / CSV tooling      | SheetJS CE + PapaParse + Fuse                                                                                               | open source                                                   |
| Paid queue / scheduler         | pg-boss                                                                                                                     | open source                                                   |
| Paid forms / admin UI          | shadcn/ui + react-hook-form + Zod                                                                                           | open source                                                   |

## 4. The open-source stack

| Layer         | Open source                                                                                                | Licence                    |
| ------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------- |
| OS            | Ubuntu 24.04 LTS or Amazon Linux 2023                                                                      | free                       |
| Runtime       | Node 24 LTS, pnpm                                                                                          | MIT / free                 |
| Server        | Fastify, Zod, pg-boss, Pino                                                                                | MIT / Apache-2.0           |
| Database      | PostgreSQL 16/17, Drizzle ORM                                                                              | PostgreSQL / Apache-2.0    |
| Web           | Vite, React, TanStack Query/Table, Tailwind, shadcn/ui, Radix, Lucide, ECharts, FullCalendar, vis-timeline | MIT / Apache-2.0           |
| PWA / offline | vite-plugin-pwa, Workbox, idb, web-push                                                                    | MIT / MPL-2.0              |
| PDF           | Playwright, Chromium, Noto Sans Gujarati/Devanagari                                                        | Apache-2.0 / OFL           |
| Import        | SheetJS CE 0.20 (pinned from cdn.sheetjs.com), PapaParse, Fuse.js                                          | Apache-2.0 / MIT           |
| Auth          | our sessions, or better-auth                                                                               | MIT                        |
| Tests         | Vitest, Testcontainers, Playwright, axe                                                                    | MIT / Apache-2.0           |
| Infra         | Terraform, Docker Compose, Caddy, LocalStack or s3rver (local S3, permissive)                              | MPL-2.0 / Apache-2.0 / MIT |
| CI / registry | GitHub Actions, GHCR                                                                                       | free tier                  |

**The discipline:** every dependency is a maintenance and security surface. We choose a small, boring, permissively licensed set; one tool per job; no duplicate frameworks; no AGPL/GPL code. `THIRD_PARTY.md` lists every dependency with its licence and is checked in CI. “Free” is not the only criterion — a free tool that duplicates another, or is unmaintained, costs more than it saves.

## 5. Environments

| Environment | Where                                                                     | Database                                           | Purpose                                                     |
| ----------- | ------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------- |
| Local       | Docker Compose on the Mac: Postgres 16, LocalStack or s3rver, server, web | container                                          | Development and tests; no cloud cost                        |
| Staging     | EC2 t4g.small + Caddy + Docker Compose; `cosmos.staging.<domain>`         | Postgres container (or a separate database on RDS) | Every merge to `main` deploys here; you test here           |
| Production  | EC2 t4g.medium + Caddy + Docker Compose; `cosmos.<domain>`                | RDS db.t4g.micro                                   | Only a tagged release after a gate; deploys 05:00–08:00 IST |

Production and staging never share a database or a secret. Staging holds a seeded copy or synthetic data; real Cosmos data is only used if you explicitly approve it and access is restricted.

## 6. Reliability and security at low cost

- **One EC2 is a single point of failure.** Use a CloudWatch status-check alarm with the EC2 **recover** action (free-ish), automated AMI/snapshot, and a documented rebuild. 99.5% is a target, not a guarantee; revisit a warm standby at cutover or plant two.
- **RDS single-AZ** for the pilot, with 7-day automated backups, PITR and a weekly logical dump to S3. Multi-AZ roughly doubles the database bill; add it when a plant’s uptime contract demands it.
- **No public SSH.** Use **SSM Session Manager** (free) with IAM; the security group allows 443 only. No bastion.
- **RDS private**, no public endpoint; security group allows the EC2 only.
- **No NAT Gateway.** EC2 in a public subnet with an Elastic IP and a tight security group; RDS in a private subnet; S3 gateway endpoint (free).
- **TLS everywhere** via Caddy/Let’s Encrypt; HSTS; no http.
- **Per-address rate limits** (sign-in 60 a minute, company name and logo 300) key on the address the server reads from Caddy's `X-Forwarded-For`. They assume Caddy is the only proxy in front: a CDN or load balancer in front would make every visitor one address, so add it only together with its own trusted-proxy setting.
- **Secrets** in Secrets Manager (production) or SSM Parameter Store SecureString (staging), never in git; IAM least privilege; GitHub OIDC, no long-lived AWS keys.
- **Encryption at rest** on RDS and S3; versioning on S3; lifecycle for voice notes.
- **Backups and restore**: RDS PITR, weekly dump, S3 versioning, a restore drill executed in M0 and quarterly. A backup you have not restored is a hope.
- **Cost guardrails**: AWS Budgets alarm at ₹30,000 (or lower), per-channel caps for WhatsApp/Sarvam, CloudWatch log retention 7 days, S3 lifecycle, no idle resources, one environment until cutover if needed.
- **Observability**: JSON logs with tenant and request ids; `/health`; Route 53 health check; a failed-jobs page; a timer-lag alarm (M2). No paid APM.

## 7. Setup checklist (you create, I wire)

| #   | Item                                                           | Notes                                                          |
| --- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | AWS account, ap-south-1, MFA, root not used for daily work     | Enable Budgets and a billing alarm immediately                 |
| 2   | IAM role for GitHub Actions (OIDC)                             | No access keys; trust only this repo                           |
| 3   | Domain + Route 53 hosted zone                                  | `cosmos.<domain>`, `cosmos.staging.<domain>`                   |
| 4   | SES identity + production access                               | Starts in sandbox; request when email goes live                |
| 5   | S3 bucket names / Terraform state bucket                       | Versioning, block public access, encryption                    |
| 6   | Secrets Manager secret (production) / SSM parameters (staging) | DB password, session secret, VAPID keys, WhatsApp/Sarvam later |
| 7   | Meta developer app + test number; Sarvam key                   | Needed at M3, not M0                                           |
| 8   | Local: Docker Desktop running, Terraform installed             | Docker is installed but not running; Terraform is missing      |

I write the Terraform, Compose, Caddyfile, deploy/rollback scripts and the runbooks. You create the account, the domain and the payment method.

## 8. When the cost will move

- WhatsApp and Sarvam usage; caps keep it bounded.
- PDF volume; Chromium memory is the reason for 4 GB.
- Log volume; 7-day retention.
- Data transfer; small at pilot scale.
- Multi-AZ, a second environment, a warm standby, CloudFront — only when a gate or a customer demands it.
- AWS price changes; re-check at each gate, not from memory.

## 9. The one-sentence version

AWS Mumbai, one small Graviton server per environment, Caddy, Docker Compose, RDS Postgres for production, S3, SES, SSM, CloudWatch, GitHub Actions — no Supabase, no Redis, no Vercel, no NAT, no ALB, no Kubernetes — roughly **$60–95 a month** for both environments, before WhatsApp and speech.
