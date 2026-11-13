# 13 — Staging live

Issue: [#80](https://github.com/nimishshah1989/argus/issues/80) · Milestone M0 · Blocked by: 01 · External: AWS
apply by Nimish (N7) · Branch `claude/t13-staging-live`. One PR, labels `size:large` (infra, scripts and tests
together pass 800 lines; reason: one slice cannot deploy without all of them) and `no-parity` (no parity row
changes). The PR body says `Refs #80`, not `Closes #80`: half the proof happens only after Nimish runs the apply.

## 1. Goal

Every merge to `main` reaches staging by itself, a bad release can be rolled back with one button in GitHub,
and if staging breaks, costs too much or starts throwing errors, someone gets an email.

## 2. Decisions (technical; the orchestrator's design, plus rulings marked **new**)

1. **Health route** stays `GET /api/v1/health` (Caddy proxies `/api/*`; the e2e stack waits on it). The
   ticket's "/health" means this route.
2. **`bindLog` takes the reply too (new).** In Fastify 5.12.8 `reply.log` is a separate reference set when the
   reply is created (`fastify/lib/reply.js:77`), and the "request completed" line is written with
   `reply.log` (`lib/log-controller.js:68`). Rebinding only `request.log` would leave that line without
   `tenantId`. So `bindLog(request, reply, fields)` rebinds both.
3. **Request id label (new).** Fastify 5.12.8 marks the top-level `requestIdLogLabel` option deprecated. Use
   `logController: new LogController({ requestIdLogLabel: 'requestId' })` (`LogController` is exported by
   `fastify`). `requestIdHeader` stays at Fastify's default `false`, so a caller cannot choose the id.
4. **Error handler logs through the reply (new).** `app.setErrorHandler` today calls `app.log.error(error)`,
   which carries no `requestId` or `tenantId`. It becomes `reply.log.error({ err: error }, 'unhandled error')`.
   This is the line the error-count alarm counts (`level` 50).
5. **Health lives in a new `apps/server/src/health.ts`** with `registerHealth`, matching the other
   `register*` files, so `buildApp` stays under 60 lines and ticket 02 can move it as one file.
6. **Elastic IP without a cycle (new).** `user_data` needs the site address, which needs the Elastic IP, which
   today names the instance. `aws_eip.server` loses its `instance` argument and a new
   `aws_eip_association.server` joins them.
7. **`user_data_replace_on_change = true` (new).** Nothing is applied yet (setup note), so this is free now;
   later a change to the site address rebuilds the instance, which holds no data (Postgres is RDS; Caddy
   re-issues its certificate).
8. **Migrations run with `node_modules/.bin/tsx scripts/migrate.ts` (new)**, not `pnpm migrate`, so the
   container never asks corepack to download pnpm at run time. The server image already has dev dependencies
   (`pnpm install` without `--prod`).
9. **SSM wait is a polling loop (new).** `aws ssm wait command-executed` gives up after about 100 seconds;
   pull + migrate + 60 s health can take longer. The workflow polls `get-command-invocation` every 5 s for up
   to 15 minutes.
10. **Re-deploying an existing tag (new).** ECR tags are immutable. The workflow builds only when the tag is
    the commit SHA and ECR does not already hold it; an explicit `tag` input that ECR does not hold fails
    with "image <tag> not in ECR".
11. **The web image is built from a named build context (new).** `.dockerignore` excludes `apps/web/dist`, so
    the web image is built with `--build-context dist=apps/web/dist` and context `infra/`.
12. **`billing_email` becomes required (new):** a `validation` block rejects `""`. It is Caddy's ACME email and
    both alarm subscriptions, so "when set" branches are dropped.
13. **Cut:** `APP_ENV` in `/opt/uptimo/.env` (nothing reads it). `dns_name` output (replaced by `site_url`).
    `infra/deploy.sh` (ssh-based, GHCR). `SITE_ADDRESS` default in compose (always set by `.env`).

## 3. Files

### Server (goal 1 health, goal 2 logs)

| File                               | Change                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/server/src/logging.ts`       | **create.** `loggerOptions`, `bindLog` (section 4).                                                                                                                                                                                                                                                                                                         |
| `apps/server/src/health.ts`        | **create.** `registerHealth`.                                                                                                                                                                                                                                                                                                                               |
| `apps/server/src/app.ts`           | **modify.** Fastify options (logger, `genReqId`, `logController`); `onSend` hook sets `x-request-id`; replace the inline health route with `registerHealth(app, config)`; error handler logs via `reply.log.error`. If `buildApp` passes 60 lines, move the Fastify options into a `const serverOptions = (config: AppConfig) => ({...})` in the same file. |
| `apps/server/src/config.ts`        | **modify.** `AppConfig.logger?: FastifyServerOptions['logger']` (was `boolean`).                                                                                                                                                                                                                                                                            |
| `apps/server/src/index.ts`         | **modify.** `logger: loggerOptions()` (was `true`).                                                                                                                                                                                                                                                                                                         |
| `apps/server/src/auth.ts`          | **modify, two lines.** In `requireAuth` after `found`: `bindLog(request, reply, { tenantId: found.tenant_id, loginId: found.login_id })`. In `login` after `tenant` resolves: `bindLog(request, reply, { tenantId: tenant.id })`.                                                                                                                           |
| `apps/server/test/health.test.ts`  | **create.** Tests 1 to 3.                                                                                                                                                                                                                                                                                                                                   |
| `apps/server/test/logging.test.ts` | **create.** Tests 4 to 7.                                                                                                                                                                                                                                                                                                                                   |

### Deploy and rollback (goal 1)

| File                            | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/deploy.yml`  | **rewrite** (section 4.3).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `infra/instance/deploy.sh`      | **create**, executable. `deploy <tag>` and `rollback`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `infra/instance/refresh-env.sh` | **create**, executable. Writes `app.env` and `migrate.env` from the secret.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `infra/web.Dockerfile`          | **create.** `FROM caddy:2-alpine`; `COPY Caddyfile /etc/caddy/Caddyfile`; `COPY --from=dist . /srv/web`.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `infra/docker-compose.yml`      | **modify.** `server.image: ${ECR_REGISTRY}/uptimo-server:${IMAGE_TAG}` (drop `build:`), `env_file: app.env`, `environment: { PORT: '3001', NODE_ENV: production }`, `logging: { driver: awslogs, options: { awslogs-region: ${AWS_REGION}, awslogs-group: ${LOG_GROUP}, tag: '{{.Name}}' } }`. `caddy.image: ${ECR_REGISTRY}/uptimo-web:${IMAGE_TAG}`, `environment: { SITE_ADDRESS: ${SITE_ADDRESS}, ACME_EMAIL: ${ACME_EMAIL} }`, drop the `Caddyfile` and `apps/web/dist` bind mounts, keep `caddy_data`/`caddy_config`. |
| `infra/Caddyfile`               | **modify.** `email {$ACME_EMAIL}`; header comment says the site address comes from Terraform.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `infra/deploy.sh`               | **delete.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `tools/staging-deploy.test.ts`  | **create.** Tests 8 to 12.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

### Terraform (goals 1 and 2)

| File                                       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `infra/terraform/main.tf`                  | **modify.** Variables: `github_repo` default `"argus"`; new `enable_https` (bool, `true`), `external_uptime_ping` (bool, `true`), `error_alarm_threshold` (number, `5`); `billing_email` validation (non-empty). Locals `site_host` and `site_address` (section 5). `aws_iam_role_policy.server`: remove `ssm:GetParameter*` and `secretsmanager` on `*`; add `secretsmanager:GetSecretValue` on `aws_secretsmanager_secret.app.arn`; `ecr:GetAuthorizationToken` on `*`; `ecr:BatchGetImage`, `ecr:GetDownloadUrlForLayer`, `ecr:BatchCheckLayerAvailability` on the two repo ARNs; `logs:CreateLogStream`, `logs:PutLogEvents`, `logs:DescribeLogStreams` on `"${aws_cloudwatch_log_group.server.arn}:*"`; S3 statements unchanged. `aws_instance.server`: new `user_data` (section 4.5), `user_data_replace_on_change = true`, `metadata_options { http_tokens = "required" }`. `aws_eip.server`: drop `instance`; add `aws_eip_association.server`. Move the OIDC provider, deploy role and policy to `deploy.tf` and the secret to `secrets.tf` (same addresses, so no `moved` block). Outputs: add `site_url`, `alert_topic_arn`; delete `dns_name`; keep the rest. |
| `infra/terraform/deploy.tf`                | **create.** `aws_iam_openid_connect_provider.github` (moved as is); `aws_iam_role.deploy` (trust narrowed); `aws_iam_role_policy.deploy` (narrowed); `aws_ecr_repository.server` / `.web` (`${var.app}-server`, `${var.app}-web`, `image_tag_mutability = "IMMUTABLE"`); `aws_ecr_lifecycle_policy.server` / `.web` (keep last 10 images).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `infra/terraform/secrets.tf`               | **create.** `random_password.app_api` (32, `special = false`); `aws_secretsmanager_secret.app` (name `"${var.app}/staging"`); `aws_secretsmanager_secret_version.app` (JSON, section 5).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `infra/terraform/alarms.tf`                | **create.** `provider "aws" { alias = "us_east_1", region = "us-east-1" }`; log group, metric filter, error alarm, SNS topic and email subscription (ap-south-1); Route 53 health check, us-east-1 SNS topic, subscription and alarm (all `count = var.external_uptime_ping ? 1 : 0`); a comment that the billing alarm is the existing `argus-monthly-cost` budget and Terraform must not create another.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `infra/terraform/terraform.tfvars.example` | **modify.** `domain = ""`, `billing_email = "you@example.com"`, `github_repo = "argus"`, commented `enable_https`, `external_uptime_ping`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `infra/terraform/README.md`                | **modify.** Remove the ₹30,000 budget line, the "uncomment backend" note and the "broad deploy role" note; describe the four files in one line each; point to `infra/STAGING.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

### Docs and bookkeeping

| File                             | Change                                                                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `infra/STAGING.md`               | **create.** Nimish's Mac steps, alarm test signals, rollback (section 4.6).                                                                                         |
| `infra/BOOTSTRAP.md`             | **rewrite**, short: what `user_data` does automatically and how to inspect it (`aws ssm start-session`, `cat /var/log/cloud-init-output.log`, `ls -l /opt/uptimo`). |
| `infra/README.md`                | **modify.** One paragraph: ECR images, SSM deploy, `instance/` scripts, links to `STAGING.md` and `BOOTSTRAP.md`.                                                   |
| `changes/80-staging-live.md`     | **create.** Changelog fragment (bullets like `changes/76-green-fast-main.md`).                                                                                      |
| `docs/plan/MILESTONES.md`        | **modify** row 13 only: status `blocked: needs apply`, PR `#<pr>`.                                                                                                  |
| `docs/slices/13-staging-live.md` | this plan; section 9 filled by the builder.                                                                                                                         |

No other file changes. Not touched: `infra/server.Dockerfile`, `infra/.env.example`, `infra/RESTORE.md`,
`apps/web/e2e/stack.ts`, `ci.yml`.

## 4. Interfaces

### 4.1 Server

```ts
// apps/server/src/logging.ts
import type { FastifyReply, FastifyRequest, FastifyServerOptions } from 'fastify';
export type LoggerOptions = Exclude<FastifyServerOptions['logger'], boolean | undefined>;
export function loggerOptions(stream?: { write(line: string): void }): LoggerOptions;
export function bindLog(
  request: FastifyRequest,
  reply: FastifyReply,
  fields: Record<string, string>,
): void;
```

`loggerOptions` returns: level `info`; `stream` when given; `redact: { paths, censor: '[redacted]' }` where
`paths` = `body`, `*.body`, `req.headers.authorization`, `req.headers.cookie`, and for each of `name`, `phone`,
`username`, `password`, `token`, `endpoint`, `text`, `problem` both `<key>` and `*.<key>`;
`serializers.req = (req) => ({ method: req.method, url: req.url.split('?')[0] })` (no `remoteAddress`,
`remotePort`, `hostname`, `ip`, headers). `bindLog` sets `request.log = request.log.child(fields)` and
`reply.log = request.log`.

```ts
// apps/server/src/health.ts
export function registerHealth(app: FastifyInstance, config: AppConfig): void;
```

`GET /api/v1/health`, route `config: { rateLimit: false }`, no auth. Two checks run in parallel, each wrapped
by a local `within(check: Promise<unknown>, ms = 2000): Promise<boolean>` (resolves `false` on rejection or
after `ms`; the timer is cleared/unref'd): db = `config.pool.query('SELECT 1')`; queue =
`config.jobBoss?.getQueue('sla.timer')` resolving non-null (undefined `jobBoss` = `false`).

| Case         | Status | Body                                                                                                                  |
| ------------ | ------ | --------------------------------------------------------------------------------------------------------------------- |
| both true    | 200    | `{ "status": "ok" }`                                                                                                  |
| either false | 503    | `{ "status": "down", "db": boolean, "queue": boolean }`, and `request.log.warn({ db, queue }, 'health check failed')` |

No error text ever goes in the body.

```ts
// apps/server/src/app.ts — inside buildApp
Fastify({
  logger: config.logger ?? false,
  genReqId: () => randomUUID(), // node:crypto
  logController: new LogController({ requestIdLogLabel: 'requestId' }),
});
app.addHook('onSend', async (request, reply) => {
  reply.header('x-request-id', request.id);
});
```

`AppConfig.logger?: FastifyServerOptions['logger']` (`apps/server/src/config.ts`).
Every response carries header `x-request-id: <uuid>`.

### 4.2 On-instance scripts (shipped by CI on every deploy)

`infra/instance/deploy.sh deploy <tag> | rollback` — bash, `set -euo pipefail`.
Environment overrides (for tests): `UPTIMO_DIR` (default `/opt/uptimo`), `HEALTH_TIMEOUT` seconds (default
`60`; one probe every 2 s, at least one probe). Reads `$UPTIMO_DIR/.env` (`set -a; . .env`). State files
`$UPTIMO_DIR/.current_tag`, `$UPTIMO_DIR/.previous_tag`.

`deploy <tag>`, in this order:

1. `$UPTIMO_DIR/instance/refresh-env.sh`.
2. `aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY"`.
3. `IMAGE_TAG=<tag> docker compose pull`.
4. `docker run --rm --env-file "$UPTIMO_DIR/migrate.env" "$ECR_REGISTRY/uptimo-server:<tag>" node_modules/.bin/tsx scripts/migrate.ts`. Failure: print `migration failed; <current> still running`, exit 1, nothing else changes.
5. `IMAGE_TAG=<tag> docker compose up -d`.
6. Health probe: `docker compose exec -T server wget -qO- http://localhost:3001/api/v1/health`.
7. Healthy: if `.current_tag` exists and differs from `<tag>`, copy it to `.previous_tag`; write `<tag>` to `.current_tag`; print `deployed <tag>`; exit 0.
8. Unhealthy: if `.current_tag` exists, `IMAGE_TAG=<current> docker compose up -d` and print `health failed; rolled back to <current>`; exit 1 in both cases. State files unchanged.

`rollback`: steps 1, 2; no `.previous_tag` → print `no previous release`, exit 1; `IMAGE_TAG=<previous> docker
compose up -d`; health probe; healthy → swap the contents of `.current_tag` and `.previous_tag`, print
`rolled back to <previous>`, exit 0; unhealthy → exit 1. No migration runs.

`infra/instance/refresh-env.sh` — no arguments; env `UPTIMO_DIR`; reads `SECRET_ID`, `AWS_REGION` from `.env`.
Runs `aws secretsmanager get-secret-value --secret-id "$SECRET_ID" --region "$AWS_REGION" --query SecretString --output text`,
parses with `jq`, writes with `umask 077`: `app.env` = `DATABASE_URL=…`; `migrate.env` =
`MIGRATION_DATABASE_URL=…` and `APP_API_PASSWORD=…`. Prints only `env refreshed`. Never echoes a value.

### 4.3 Workflow `.github/workflows/deploy.yml`

- `on: push: branches: [main]` and `workflow_dispatch` inputs `action` (`type: choice`, options `deploy`,
  `rollback`, default `deploy`) and `tag` (`type: string`, default `''`). No `tags` trigger.
- `permissions: { id-token: write, contents: read }`; `concurrency: { group: deploy, cancel-in-progress: false }`.
- One job `staging`: `if: github.ref == 'refs/heads/main'`, `runs-on: ubuntu-latest`, `timeout-minutes: 30`,
  job `env`: `ACTION: ${{ inputs.action || 'deploy' }}`, `TAG: ${{ inputs.tag || github.sha }}`,
  `AWS_ROLE_ARN: ${{ secrets.AWS_ROLE_ARN }}`, `APP: uptimo`.
- Step `gate` (id `gate`): if `AWS_ROLE_ARN` is empty, print `staging not provisioned yet` and set output
  `ready=false`; else `ready=true`. Every later step has `if: steps.gate.outputs.ready == 'true'` (a step
  cannot end the job green early, so the gate is an output).
- Then: checkout; `pnpm/action-setup@v4` (10.30.3); `setup-node@v4` (24, pnpm cache);
  `aws-actions/configure-aws-credentials@v4` (role `AWS_ROLE_ARN`, `ap-south-1`);
  `aws-actions/amazon-ecr-login@v2` (id `ecr`).
- Step `exists` (deploy only): `aws ecr describe-images` for `TAG` in both repos → output `build=true` only if
  either is missing and `TAG == github.sha`; missing and `TAG != github.sha` → fail `image <tag> not in ECR`.
- Build steps (`if: … && env.ACTION == 'deploy' && steps.exists.outputs.build == 'true'`):
  `pnpm install --frozen-lockfile`; `pnpm build:web`; `docker/setup-qemu-action@v3`;
  `docker/setup-buildx-action@v3`;
  `docker buildx build --platform linux/arm64 -f infra/server.Dockerfile -t $REG/uptimo-server:$TAG --push .`;
  `docker buildx build --platform linux/arm64 -f infra/web.Dockerfile --build-context dist=apps/web/dist -t $REG/uptimo-web:$TAG --push infra`
  (`REG` = `steps.ecr.outputs.registry`).
- Step `ssm`: instance id from `aws ec2 describe-instances` (tag `Name=uptimo-server`, state `running`; none →
  fail `no running uptimo-server instance`); payload `tar czf - -C infra docker-compose.yml instance | base64 -w0`;
  `jq -n` writes `params.json` = `{ "commands": ["mkdir -p /opt/uptimo && echo <payload> | base64 -d | tar xz -C /opt/uptimo && chmod +x /opt/uptimo/instance/*.sh && /opt/uptimo/instance/deploy.sh <deploy TAG | rollback>"], "executionTimeout": ["900"] }`;
  `aws ssm send-command --document-name AWS-RunShellScript --parameters file://params.json`; poll
  `get-command-invocation` every 5 s up to 15 min until the status is not `Pending`, `InProgress` or `Delayed`;
  print `StandardOutputContent` and `StandardErrorContent`; exit 1 unless `Success`.

### 4.4 Terraform

Variables: section 3. Outputs added: `site_url` = `"${var.enable_https ? "https" : "http"}://${local.site_host}"`,
`alert_topic_arn` = `aws_sns_topic.alerts.arn`.

Deploy role trust: `StringEquals` on `token.actions.githubusercontent.com:sub` =
`repo:${var.github_org}/${var.github_repo}:ref:refs/heads/main` and
`token.actions.githubusercontent.com:aud` = `sts.amazonaws.com`. Policy, and nothing else:
`ec2:DescribeInstances` on `*`; `ssm:SendCommand` on `arn:aws:ssm:${var.region}::document/AWS-RunShellScript`
and `aws_instance.server.arn`; `ssm:GetCommandInvocation` on `*`; `ecr:GetAuthorizationToken` on `*`;
`ecr:BatchCheckLayerAvailability`, `ecr:InitiateLayerUpload`, `ecr:UploadLayerPart`,
`ecr:CompleteLayerUpload`, `ecr:PutImage`, `ecr:BatchGetImage`, `ecr:DescribeImages` on the two repo ARNs.

`alarms.tf` resources: `aws_cloudwatch_log_group.server` (`/${var.app}/staging/server`, 30 days);
`aws_cloudwatch_log_metric_filter.server_errors` (pattern `{ $.level >= 50 }`, metric `ServerErrors`,
namespace `Uptimo`, value `1`); `aws_cloudwatch_metric_alarm.server_errors` (Sum, period 300, 1 period,
`GreaterThanOrEqualToThreshold` `var.error_alarm_threshold`, `treat_missing_data = "notBreaching"`, alarm
action `aws_sns_topic.alerts.arn`); `aws_sns_topic.alerts` (`${var.app}-alerts`) +
`aws_sns_topic_subscription.alerts_email`; counted: `aws_route53_health_check.site` (type `HTTPS`/443 if
`enable_https` else `HTTP`/80, `fqdn = local.site_host`, `ip_address = aws_eip.server.public_ip`,
`resource_path = "/api/v1/health"`, `enable_sni = var.enable_https`, `failure_threshold = 3`,
`request_interval = 30`), `aws_sns_topic.uptime` (us-east-1, `${var.app}-uptime`) + email subscription,
`aws_cloudwatch_metric_alarm.uptime` (us-east-1, `AWS/Route53` `HealthCheckStatus`, dimension
`HealthCheckId`, Minimum, period 60, 2 periods, `LessThanThreshold` 1, action the uptime topic).

### 4.5 First boot (`user_data`, no secrets)

`dnf install -y docker jq`; `systemctl enable --now docker`; install the Docker Compose v2 CLI plugin
(`docker-compose-linux-aarch64` from the docker/compose GitHub release, to
`/usr/local/lib/docker/cli-plugins/docker-compose`, mode 755). The builder pins the newest v2 release listed
on the docker/compose releases page on build day and writes the version and URL into section 9 ("verify the
version URL in current docs"). `mkdir -p /opt/uptimo`; write `/opt/uptimo/.env` (section 5); `usermod -aG
docker ec2-user`.

### 4.6 `infra/STAGING.md` contents

1. Before: `export AWS_PROFILE=argus`; `cd infra/terraform`; `cp terraform.tfvars.example terraform.tfvars`, set
   `billing_email`, keep `domain = ""` and `github_repo = "argus"`.
2. `../../.tools/bin/terraform init`; `… plan -out=staging.plan` — send the `Plan: N to add, …` line to the
   orchestrator and wait; `… apply staging.plan`.
3. Confirm the two "AWS Notification – Subscription Confirmation" emails (one from ap-south-1, one from
   us-east-1).
4. `gh secret set AWS_ROLE_ARN --body "$(../../.tools/bin/terraform output -raw deploy_role_arn)"`.
5. Send back `server_public_ip` and `site_url`.
6. Start the first deploy: `gh workflow run deploy.yml`; watch `gh run watch`; open `site_url`, then
   `site_url/api/v1/health` (expect `{"status":"ok"}`).
7. Test signals, one block each, saying what email should arrive:
   - Error alarm: `aws logs create-log-stream` (`alarm-test`) then `aws logs put-log-events` with five
     `{"level":50,"msg":"alarm test"}` lines; or `aws cloudwatch set-alarm-state --alarm-name uptimo-server-errors --state-value ALARM --state-reason test`.
   - Uptime: `aws cloudwatch set-alarm-state --region us-east-1 --alarm-name uptimo-uptime …`; the real test is
     `aws ssm send-command … "cd /opt/uptimo && docker compose stop server"`, wait 3 minutes for the email,
     then `gh workflow run deploy.yml -f action=deploy -f tag=<current sha>` to restore.
   - Billing: `aws budgets describe-budget --account-id <id> --budget-name argus-monthly-cost` and
     `describe-notifications-for-budget`. Stated plainly: AWS Budgets cannot be fired on demand, so this
     alarm is checked to exist, not fire-tested.
8. Rollback: `gh workflow run deploy.yml -f action=rollback`.
9. Checks that the access is narrow: `aws iam get-role --role-name uptimo-deploy` (trust names only
   `ref:refs/heads/main`); `aws iam get-role-policy --role-name uptimo-server --policy-name uptimo-server`.
10. If `plan` is denied in `us-east-1`: set `external_uptime_ping = false` and tell the orchestrator (see
    Questions).
11. If HTTPS does not come up within 10 minutes of the first deploy (`docker compose logs caddy` shows an ACME
    error): set `enable_https = false`, `plan`, `apply`; staging then serves plain HTTP.

## 5. Data

No database change: no table, column, migration or npm dependency.

| Field                                                                                                                          | Type                                                                                      | Where                                        | Use                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| secret `uptimo/staging` key `DATABASE_URL`                                                                                     | string, `postgresql://app_api:<app_api pw>@<rds endpoint>/uptimo?sslmode=no-verify`       | Secrets Manager, written by Terraform        | server, via `app.env`                                                                                                      |
| key `MIGRATION_DATABASE_URL`                                                                                                   | string, master user `uptimo`, `random_password.db`, same host and `sslmode`               | same                                         | migrations, via `migrate.env`                                                                                              |
| key `APP_API_PASSWORD`                                                                                                         | string, `random_password.app_api` (32, alphanumeric)                                      | same                                         | `scripts/migrate.ts` sets the `app_api` login password                                                                     |
| `/opt/uptimo/.env`: `ECR_REGISTRY`, `SITE_ADDRESS`, `ACME_EMAIL`, `AWS_REGION`, `LOG_GROUP`, `SECRET_ID`                       | strings, no secrets                                                                       | instance, from `user_data`                   | compose interpolation, scripts                                                                                             |
| `/opt/uptimo/app.env`, `/opt/uptimo/migrate.env`                                                                               | `KEY=value` lines, mode 600                                                               | instance, rewritten every deploy             | containers                                                                                                                 |
| `/opt/uptimo/.current_tag`, `.previous_tag`                                                                                    | git SHA                                                                                   | instance                                     | deploy and rollback                                                                                                        |
| `IMAGE_TAG`                                                                                                                    | git SHA                                                                                   | shell env of `deploy.sh`                     | compose image tag                                                                                                          |
| `local.site_host`                                                                                                              | `domain != "" ? "cosmos.staging.${domain}" : "cosmos.${replace(eip, ".", "-")}.sslip.io"` | Terraform                                    | Caddy site, health check, `site_url`; the `cosmos.` label resolves the tenant through `tenantSlugFromHost`, no code change |
| `local.site_address`                                                                                                           | `enable_https ? site_host : ":80"`                                                        | Terraform → `.env`                           | Caddy                                                                                                                      |
| log fields `requestId` (uuid), `tenantId` (uuid), `loginId` (uuid), `req.method`, `req.url` (path only), `level` (pino number) | JSON                                                                                      | stdout → CloudWatch `/uptimo/staging/server` | debugging; `level >= 50` counted by the alarm                                                                              |
| `x-request-id`                                                                                                                 | response header, uuid                                                                     | every response                               | support                                                                                                                    |
| health body                                                                                                                    | `{status}` or `{status, db, queue}`                                                       | `GET /api/v1/health`                         | uptime ping, deploy probe                                                                                                  |

Secret values live in the Terraform state (the encrypted, versioned S3 state bucket), as `random_password.db`
already does. No real personal data anywhere: tests use `Ravi Test`, `ravi-test`, fake ids, the e2e password
pattern.

## 6. Test cases

All tests are written first and fail before the change. Server tests use `startTestDb()` from
`apps/server/test/harness.ts`. Log capture: `const lines: string[] = []`, `buildApp({ pool: db.app,
rateLimitMax: 100000, logger: loggerOptions({ write: (l) => lines.push(l) }) })`, then
`lines.map(JSON.parse)`.

### Health (`apps/server/test/health.test.ts`, goal 1)

1. **`health answers 200 when the database and queue are up`.** Given an app built on the test database.
   When `GET /api/v1/health` with no auth. Then 200 and the body equals `{ status: 'ok' }`.
2. **`health answers 503 when the database is down`.** Given a second app built with a fresh `Pool` to the
   test database that has been `end()`ed, and `jobBoss` taken from test 1's config. When `GET
/api/v1/health`. Then 503 and the body equals exactly `{ status: 'down', db: false, queue: true }`.
3. **`health answers 503 when the queue is down`.** Given an app built with `pool: db.app` and
   `jobBoss: { getQueue: () => Promise.reject(new Error('queue gone')) } as unknown as PgBoss`. When `GET
/api/v1/health`. Then 503, body equals exactly `{ status: 'down', db: true, queue: false }`, and the
   body does not contain `queue gone`.

### Logs (`apps/server/test/logging.test.ts`, goal 2)

Seed (admin pool): tenant `cosmos`, one person, one personal login `ravi-test` with an argon2 hash of a fake
password, one session row whose `token_hash = hashToken(FAKE_TOKEN)`.

4. **`every request is logged with a request id and no client address`.** Given the capturing app. When
   `GET /api/v1/health?probe=1`. Then the response has `x-request-id` (uuid); every captured line for it has
   `requestId` equal to that header; the "incoming request" line has `req` equal to
   `{ method: 'GET', url: '/api/v1/health' }`; and no captured line contains `remoteAddress`, `remotePort`,
   `"ip"`, `hostname` or `x-forwarded-for`.
5. **`an authenticated request is logged with its tenant and login`.** Given the seeded session. When `GET
/api/v1/auth/me` with `Host: cosmos.localhost` and `Authorization: Bearer <FAKE_TOKEN>`. Then 200 and the
   "request completed" line carries `tenantId` and `loginId` equal to the seeded ids.
6. **`names, credentials and bodies are redacted`.** Given the capturing app. When
   `app.log.info({ body: { name: 'Ravi Test' } })`, `app.log.info({ person: { name: 'Ravi Test', phone: '9000000000' } })`,
   `GET /api/v1/auth/me` with `Authorization: Bearer <FAKE_TOKEN>`, and `POST /api/v1/auth/login` on
   `cosmos.localhost` with `{ username: 'ravi-test', password: 'wrong-password' }`. Then the joined output
   contains none of `Ravi Test`, `9000000000`, `ravi-test`, `wrong-password`, `FAKE_TOKEN`'s value; it
   contains `[redacted]`; and the login's "request completed" line carries `tenantId`.
7. **`an unhandled error is logged at level 50 with its request id`.** Given the capturing app with a
   test-only route `GET /boom` that throws `new Error('boom')`, added before the first inject. When `GET
/boom`. Then 500 with `{ error: { code: 'internal' … } }` (the existing `apiError` shape), and one line has
   `level: 50` and `requestId` equal to the `x-request-id` header.

### Deploy and secrets (`tools/staging-deploy.test.ts`, goals 1 and 2)

Shell tests run the real scripts against a temp `UPTIMO_DIR` holding `instance/deploy.sh` (copied), a stub
`instance/refresh-env.sh` (writes empty `app.env`/`migrate.env`), an empty `docker-compose.yml`, and `.env`
with fake values (`ECR_REGISTRY=registry.test`, `AWS_REGION=ap-south-1`, `SECRET_ID=uptimo/staging`). `PATH` is
prefixed with a stub dir: `aws` and `docker` append `IMAGE_TAG=$IMAGE_TAG $*` to `calls.log`; the
`docker compose exec … wget` stub exits 1 when the `IMAGE_TAG` of the last `up -d` equals `$BAD_TAG`, else 0. `HEALTH_TIMEOUT=2`.

8. **`deploy workflow runs on merges to main and offers rollback`.** Given `.github/workflows/deploy.yml`
   parsed with `yaml`. Then `on.push.branches` is `['main']` and there is no `tags` trigger;
   `workflow_dispatch.inputs.action.options` is `['deploy', 'rollback']`; `concurrency` is
   `{ group: 'deploy', 'cancel-in-progress': false }`; the job `if` is `github.ref == 'refs/heads/main'`;
   the first step sets `ready` and prints `staging not provisioned yet`; every `docker buildx build` step's
   `if` includes `env.ACTION == 'deploy'`; and the base64 of `tar czf` of `infra/docker-compose.yml` +
   `infra/instance` is under half the Run Command parameter limit (the builder looks the limit up in the AWS
   Systems Manager docs and writes it, with the link, as a constant comment in the test).
9. **`deploy migrates before starting the new release and records it`.** Given `.current_tag` = `aaa`. When
   `deploy.sh deploy bbb`. Then exit 0; in `calls.log` the `run --rm --env-file …/migrate.env
registry.test/uptimo-server:bbb … scripts/migrate.ts` line comes before `IMAGE_TAG=bbb compose up -d`;
   `.current_tag` = `bbb`, `.previous_tag` = `aaa`.
10. **`a release that fails its health check is rolled back automatically`.** Given `.current_tag` = `aaa`,
    `BAD_TAG=bbb`. When `deploy.sh deploy bbb`. Then exit code non-zero; output contains `rolled back to
aaa`; the last `compose up -d` line has `IMAGE_TAG=aaa`; `.current_tag` still `aaa`.
11. **`rollback returns to the previous release without migrating`.** Given `.current_tag` = `bbb`,
    `.previous_tag` = `aaa`. When `deploy.sh rollback`. Then exit 0; the last `compose up -d` has
    `IMAGE_TAG=aaa`; no `migrate.ts` line; `.current_tag` = `aaa`, `.previous_tag` = `bbb`. And with no
    `.previous_tag`, `deploy.sh rollback` exits non-zero with `no previous release`.
12. **`env files come from the secret store and are private`.** Given the real `refresh-env.sh` and an `aws`
    stub that prints a fake secret JSON (`DATABASE_URL`, `MIGRATION_DATABASE_URL`, `APP_API_PASSWORD`, all
    fake). When it runs. Then `app.env` holds only `DATABASE_URL=…`, `migrate.env` holds
    `MIGRATION_DATABASE_URL=…` and `APP_API_PASSWORD=…`, both files have mode `0600`, the `aws` call names
    `--secret-id uptimo/staging`, and stdout/stderr contain none of the fake values.

### Sandbox checks (builder runs; output pasted in section 9; not in CI)

13. `/tmp/tf/terraform -chdir=infra/terraform fmt -check` exits 0.
14. `/tmp/tf/terraform -chdir=infra/terraform init -backend=false` then `validate` exits 0.
15. `pnpm verify` green (format, lint, typecheck, whole suite, build, docs, PII, lean audit).

### Tasks (in order)

1. Tests 1 to 3 red → `health.ts`, `app.ts` → green.
2. Tests 4 to 7 red → `logging.ts`, `app.ts`, `config.ts`, `index.ts`, `auth.ts` → green.
3. Tests 9 to 12 red → `infra/instance/*`, compose, Caddyfile, `web.Dockerfile`, delete `infra/deploy.sh` → green.
4. Test 8 red → `deploy.yml` → green.
5. Terraform files → checks 13, 14.
6. Docs, changelog fragment, MILESTONES row → check 15.

## 7. Goal part, proof, when proven

| Goal part                              | Proof                                                         | When                                                  |
| -------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------- |
| `/health` 503 when db or queue is down | Tests 1–3                                                     | CI                                                    |
| Merge to `main` deploys staging        | Test 8 (workflow shape), 9 (order), check 14                  | CI; **real run after apply** (STAGING step 6)         |
| Rollback runs from CI                  | Tests 10, 11; `gh workflow run deploy.yml -f action=rollback` | logic in CI; **real run after apply**                 |
| Secrets come from the secret store     | Test 12; check 14; IAM check (STAGING step 9)                 | script in CI; **store and access after apply**        |
| Logs carry tenant and request ids      | Tests 4, 5, 7                                                 | CI; CloudWatch lines after apply                      |
| Logged body with a name is redacted    | Test 6                                                        | CI                                                    |
| Error-count alarm exists and fires     | Check 14; STAGING step 7                                      | **after apply**                                       |
| External uptime ping exists and fires  | Check 14; STAGING step 7                                      | **after apply**, and only if us-east-1 is allowed     |
| ₹30,000 billing alarm                  | Existing budget `argus-monthly-cost` (USD 150, stricter)      | **exists after `describe-budget`; never fire-tested** |
| HTTPS on the staging URL               | —                                                             | **after apply** (sslip.io issuance unverified)        |

## 8. Out of scope and regression risk

Out of scope: production and the tag trigger (later ticket); the "failed deploy" alarm (a failed job emails
through GitHub today); timer-lag alarm (M2); error count per `module` (needs `defineModule`, ticket 02);
backups, restore drill, seed and import (ticket 14); VAPID keys, push on staging; S3 file storage on the
server; PDF rendering on staging; `trustProxy` and per-route limits (ticket 26); a CI job for `terraform
validate`; renaming the `argus-*` AWS bootstrap names; buying a domain.

Regression risk:

- **Migrations on RDS (highest).** They have only ever run as a container superuser. RDS's master user is not
  a superuser; `0001` creates `app_router … BYPASSRLS` and does `ALTER FUNCTION … OWNER TO app_router`, which
  PostgreSQL 16 may refuse to a non-superuser. If so, the first deploy stops at step 4 with "migration
  failed" and nothing is replaced; the fix is a migration change through the architect and schema-reviewer.
- Server log shape changes (`requestId` replaces `reqId`; `req` loses `hostname`/`remoteAddress`); no test or
  tool reads logs today.
- `x-request-id` is a new header on every response; harmless to the web app.
- `infra/docker-compose.yml` no longer builds locally; nothing in the repo uses it locally.
- A rollback across a migration needs expand-and-contract migrations (ARCHITECTURE §7); none exists yet.
- Moving Terraform blocks between files keeps addresses; `plan` must show no destroy of the OIDC provider or
  deploy role. Nothing is applied yet, so the plan should be all "add".

## 9. Evidence (filled by the builder)

- Tests 1-7 (server) written first: `logging.test.ts` failed on the missing `logging.js`, `health.test.ts` failed (200 instead of 503, and the `rateLimitMax: 1` guard). Green after `logging.ts`, `health.ts`, `app.ts`, `config.ts`, `index.ts`, `auth.ts`. Tests 8-12: all failed with a missing `infra/instance/*.sh` / `deploy.yml` shape, then green. The orchestrator's snapshot commit 11e4366 holds the first versions of tests 1-7.
- Check 13: `/tmp/tf/terraform fmt -check` exit 0. Check 14: `init -backend=false` then `validate`: "Success! The configuration is valid."
- Compose plugin pinned in `user_data`: v5.7.1 (newest stable on the docker/compose releases page, 11 Nov 2026; "v2" in section 4.5 is the plugin API, the project is now at 5.x), URL `https://github.com/docker/compose/releases/download/v5.7.1/docker-compose-linux-aarch64` (asset exists; its checksum is not verified in `user_data`).
- Run Command limit in test 8: 64 KB, `MaxDocumentSizeExceeded` on https://docs.aws.amazon.com/systems-manager/latest/APIReference/API_SendCommand.html (no separate parameter limit is documented).
- Ruling 1 check (Testcontainer, `postgres:16-alpine`, non-superuser login with CREATEROLE and CREATEDB owning the database): `0001_schema_v1.sql` fails at `CREATE ROLE app_router NOLOGIN BYPASSRLS` ("permission denied to create role"); with `app_router` pre-created and granted, it fails at `ALTER ROLE app_router BYPASSRLS` ("permission denied to alter role"). `rds_superuser` was not available locally.

## 10. Open items and questions

For Nimish (product, plain English):

1. **Cost alarm.** The ticket says alert at ₹30,000 a month. Your account already has a budget that emails
   you at about ₹6,500 (50%) and ₹13,000 (100% and forecast), i.e. USD 150. This plan keeps that one instead of
   adding a second. Is the lower limit fine?
2. **Staging address.** Without a domain, staging lives at an address like
   `cosmos.13-234-1-2.sslip.io`. Is that acceptable until you buy a domain?

For the orchestrator (technical): 3. **Architecture text.** ARCHITECTURE §7 says `packages: write` (GHCR) and "SSM on staging". This plan uses ECR
and Secrets Manager. Confirm this needs only a decision note (D19) and not an architect + reviewer pass. 4. **us-east-1 and the SCP.** The org SCP once allowed only ap-southeast-2; ap-south-1 was added. The uptime
alarm must live in us-east-1. If `plan` is denied there, the choices are: add us-east-1 to the SCP, or set
`external_uptime_ping = false` and use a free outside pinger on `site_url/api/v1/health`. If the provider
alias alone breaks `plan` even with the ping off, the alias must go too. 5. **Billing test signal.** Add a CloudWatch `EstimatedCharges` alarm (needs us-east-1 and "receive billing
alerts" turned on) so the cost alarm can be fire-tested with `set-alarm-state`? Not in this plan. 6. **sslip.io and HTTPS.** sslip.io is not on the Public Suffix List, so it shares Let's Encrypt's per-domain
rate limit with everyone; its README only thanks Let's Encrypt for raising limits. Issuance is unverified;
fallback `enable_https = false` (plain HTTP). 7. **`sslmode=no-verify`.** RDS forces TLS but the server image lacks the RDS CA, so the connection is
encrypted but the server's certificate is not checked. Accepted for staging; adding the RDS CA bundle is
a later hardening ticket. 8. **VAPID keys** are not generated; push stays off on staging until they are supplied as a separate secret. 9. **PDF rendering** needs Chromium, which the alpine server image does not contain; PDF reports fail on
staging until a later ticket. 10. **No data until ticket 14.** Staging starts empty; login works only after 08's seed and 09's import. 11. **Terraform in CI.** `fmt`/`validate` run only in the builder's sandbox. Add a `terraform` job to
`ci.yml` (outside this slice's write area)?

## 11. Rulings and amendments (orchestrator, 13 Nov; these override sections above)

1. **Migrations:** do NOT change migrations, roles or `scripts/migrate.ts`. The RDS-master (non-superuser) problem is a separate ticket through architect + schema-reviewer. Ticket 13 row is `blocked: needs apply + migration fix`. Before the PR, verify the claim once in a Testcontainer with a non-superuser CREATEROLE login (note: `rds_superuser` is not available locally) and put the exact failing statements in the PR body.
2. **Billing:** keep the existing USD 150 budget as the billing alarm; no `EstimatedCharges` alarm, no second budget. STAGING.md says it is not fire-tested. The PR proposes one-line wording for ticket 13 goal 2; the orchestrator amends MILESTONES.
3. **Architecture:** add `docs/decisions/D19-ecr-and-secrets-manager.md` (GHCR to ECR, SSM to Secrets Manager; what was rejected and why) and amend ARCHITECTURE §7 (Deploy workflow, Secrets rows) in this PR. No architect pass.
4. **Uptime ping:** gated by `external_uptime_ping`; STAGING.md documents the free external pinger fallback if us-east-1 is denied by the org SCP.
5. **Self-fixes (approved):** `http_put_response_hop_limit = 1` in `metadata_options` (add to STAGING checks); `base: { pid: process.pid }` in `loggerOptions` (no `hostname`); health test 1 is a regression guard that also asserts the 200 survives `rateLimitMax: 1` after a prior request; `deploy.sh` runs compose from `/opt/uptimo` (`cd`), prints a clear message when a first deploy is unhealthy with no `.current_tag`; `.env` values use `split("/", aws_ecr_repository.server.repository_url)[0]`, `aws_cloudwatch_log_group.server.name`, `aws_secretsmanager_secret.app.name`; `billing_email` loses its `default = ""`; Terraform binary is `.tools/bin/terraform` for Nimish and `/tmp/tf/terraform` in the sandbox (say so); add `ecr:GetDownloadUrlForLayer` on the two repos; the workflow job timeout stays 30 min and STAGING states the arm64 QEMU build time is unmeasured.
6. **Regression guard and order:** existing suites that guard this change are `apps/server/test/auth.test.ts`, every `buildApp({ ..., logger: false })` caller (the `logger` type widening must keep them compiling) and the web e2e stack (`apps/web/e2e/stack.ts` waits on `/api/v1/health`). Merge order: 13 first; ticket 02 merges `main` in afterwards (never rebase).
7. **Reviewer-approved addition:** the workflow gate rejects any `tag` outside `[A-Za-z0-9._-]` because the tag is pasted into a root shell command on the instance (command injection guard).
