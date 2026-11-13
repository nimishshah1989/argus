# Staging: bring it up, load Cosmos, test the alarms, roll back

Terraform binary: `.tools/bin/terraform` on Nimish's Mac (the sandbox builder used `/tmp/tf/terraform`).
Not yet run on AWS: parts 1 and 2 were written without access to the account. Follow them in order and paste back what
each step asks for; the first run is also the test of this page. A step that fails: stop, paste the last 30 lines, do not retry blindly.

Every command is typed in Terminal on Nimish's Mac, from the `argus` folder, after:

```bash
git checkout main && git pull
export AWS_PROFILE=argus AWS_REGION=ap-south-1
```

## 1. First deploy checklist (once)

| #   | Do this (one command)                                                                                                                                                                                                                                                                                                                                                                                                                                     | Success looks like                                                                                                                                                                                                                                          | Paste back                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1   | `cd infra/terraform && ../../.tools/bin/terraform plan -out=staging.plan`                                                                                                                                                                                                                                                                                                                                                                                 | A last line `Plan: 7 to add, 1 to change, 0 to destroy` (backup bucket, longer backup window)                                                                                                                                                               | that line. **If it says any "to destroy", stop.** |
| 2   | `../../.tools/bin/terraform apply staging.plan`                                                                                                                                                                                                                                                                                                                                                                                                           | `Apply complete!`                                                                                                                                                                                                                                           | the `Apply complete!` line                        |
| 3   | `aws rds describe-db-instances --db-instance-identifier uptimo-postgres --query 'DBInstances[0].[BackupRetentionPeriod,PendingModifiedValues.BackupRetentionPeriod]' --output text`                                                                                                                                                                                                                                                                       | `7 14` (the 14-day window is booked and starts in the next maintenance window, no restart) or `14 None` (already in effect)                                                                                                                                 | the two values                                    |
| 4   | `aws rds create-db-snapshot --db-instance-identifier uptimo-postgres --db-snapshot-identifier uptimo-before-0009`                                                                                                                                                                                                                                                                                                                                         | a block of text ending `"Status": "creating"`                                                                                                                                                                                                               | nothing                                           |
| 5   | `aws rds wait db-snapshot-available --db-snapshot-identifier uptimo-before-0009`                                                                                                                                                                                                                                                                                                                                                                          | the command sits for 1 to 10 minutes, then returns to the prompt with no message                                                                                                                                                                            | the word "done" once the prompt is back           |
| 6   | `gh secret set AWS_ROLE_ARN --body "$(../../.tools/bin/terraform output -raw deploy_role_arn)"`                                                                                                                                                                                                                                                                                                                                                           | `✓ Set Actions secret AWS_ROLE_ARN`                                                                                                                                                                                                                         | that line                                         |
| 7   | `gh variable set BACKUP_BUCKET --body "$(../../.tools/bin/terraform output -raw backup_bucket)"` then `cd ../..`                                                                                                                                                                                                                                                                                                                                          | `✓ Created variable BACKUP_BUCKET`                                                                                                                                                                                                                          | that line                                         |
| 8   | `gh workflow run deploy.yml` then `gh run watch` (pick the `deploy` run with the arrow keys and Enter)                                                                                                                                                                                                                                                                                                                                                    | the run ends with a green tick; its log ends `deployed <a long code>`                                                                                                                                                                                       | the last line of the log, or the red error        |
| 9   | `curl -s "$(cd infra/terraform && ../../.tools/bin/terraform output -raw site_url)/api/v1/health"`                                                                                                                                                                                                                                                                                                                                                        | `{"status":"ok"}`                                                                                                                                                                                                                                           | what it printed                                   |
| 10  | `gh workflow run backup.yml` then `gh run watch`                                                                                                                                                                                                                                                                                                                                                                                                          | green tick with a `dump ok: s3://uptimo-…-backups/dumps/uptimo-….dump (… bytes)` line, **or red with `STOP: this login is subject to row security`: on RDS that is expected, not a fault (the master login cannot take a full dump). Carry on with part 2** | the last line of the log, either way              |
| 11  | `IID=$(cd infra/terraform && ../../.tools/bin/terraform output -raw server_instance_id); CID=$(aws ssm send-command --instance-ids "$IID" --document-name AWS-RunShellScript --parameters 'commands=["grep -c ROUTER_DATABASE_URL /opt/uptimo/migrate.env /opt/uptimo/app.env"]' --query Command.CommandId --output text); sleep 15; aws ssm get-command-invocation --command-id "$CID" --instance-id "$IID" --query StandardOutputContent --output text` | exactly two lines: `/opt/uptimo/migrate.env:1` and `/opt/uptimo/app.env:0`                                                                                                                                                                                  | the two lines                                     |
| 12  | In a browser: a free monitor (for example uptimerobot.com) on the `site_url` address plus `/api/v1/health`, every 5 minutes, alert to the `billing_email` address                                                                                                                                                                                                                                                                                         | the monitor shows "Up"                                                                                                                                                                                                                                      | "monitor set up"                                  |

Notes on the steps:

- **Step 1** also creates the weekly backup bucket and books a 14-day point-in-time window (it was 7). RDS makes that change in its next
  maintenance window; nothing restarts, and until then the window is 7 days (step 3 shows both numbers).
- **Step 10 and the backups:** the backup that matters is **point-in-time recovery plus RDS snapshots** (the first snapshot is step 4).
  The weekly dump is a bonus that RDS may refuse; if it does, the run goes red once a week and nothing else is affected. GitHub also pauses
  scheduled workflows in a repository with no activity for 60 days, so check the date of the last dump in `docs/plan/restore-drill-log.md` now and then.
- **Step 4** is the safe point before the first migration. Migration 0009 re-checks every key on the history tables and takes
  short exclusive locks. On staging's first deploy the database is empty, so this is instant and the "maintenance window" is any
  time nobody is testing. On the production cutover (ticket 28) it is a real window.
- **Step 8** the first deploy may stop at "migration failed" if RDS refuses something the tests could not try (master-user roles, the job
  queue, `pgcrypto`). Nothing is replaced when that happens; paste the log and the orchestrator fixes it. The linux/arm64 image build
  runs under emulation; the job limit is 30 minutes.
- **Step 11** proves the operator password (`ROUTER_DATABASE_URL`) sits in `migrate.env` only, a file the server never reads
  (`infra/docker-compose.yml` hands the server `app.env` alone).
- **Step 9** if HTTPS has no answer after 10 minutes, see "If HTTPS does not come up" below.

## 2. Load Cosmos's real plant and 275 tickets (once, after part 1 is green)

Two commands, in this order: `pnpm seed:cosmos` (the plant, machines, 26 people with logins) then `pnpm import:bhavin` (the tickets).
Both run on the Mac against staging's database through a tunnel; the database is not reachable from the internet and the real
files stay on the Mac. You need Node 24, `pnpm`, `jq` and the AWS Session Manager plugin
(`brew install --cask session-manager-plugin`; unverified on this Mac).

**Terminal 1** (leave it open the whole time; it prints "Waiting for connections"):

```bash
IID=$(cd infra/terraform && ../../.tools/bin/terraform output -raw server_instance_id)
DBHOST=$(aws rds describe-db-instances --db-instance-identifier uptimo-postgres --query 'DBInstances[0].Endpoint.Address' --output text)
aws ssm start-session --target "$IID" --document-name AWS-StartPortForwardingSessionToRemoteHost   --parameters "{\"host\":[\"$DBHOST\"],\"portNumber\":[\"5432\"],\"localPortNumber\":[\"15432\"]}"
```

**Terminal 2**, from the `argus` folder:

```bash
pnpm install
SECRET=$(aws secretsmanager get-secret-value --secret-id uptimo/staging --query SecretString --output text)
export OWNER_URL=$(jq -r .MIGRATION_DATABASE_URL <<<"$SECRET" | sed -E 's#@[^/]+/#@localhost:15432/#')
export APP_URL=$(jq -r .DATABASE_URL <<<"$SECRET" | sed -E 's#@[^/]+/#@localhost:15432/#')
aws rds create-db-snapshot --db-instance-identifier uptimo-postgres --db-snapshot-identifier uptimo-before-cosmos-load
aws rds wait db-snapshot-available --db-snapshot-identifier uptimo-before-cosmos-load
```

Then the two loads. First choose the first-sign-in password for all 26 people; the prompt does not echo what you type, and it
never lands in the shell history, the repo or a chat:

```bash
read -s -p "First sign-in password: " SEED_INITIAL_PASSWORD; export SEED_INITIAL_PASSWORD; echo
APP_ENV=staging DATABASE_URL="$OWNER_URL" SEED_PEOPLE_FILE=docs/discovery/real-2026-11-13/live/users.json pnpm seed:cosmos
git checkout docs/plan/seed-report.md
APP_ENV=staging DATABASE_URL="$APP_URL" pnpm import:bhavin docs/discovery/real-2026-11-13/live/tickets-export.json --tenant cosmos
```

What success looks like:

- The seed prints `machines: 192`, `people: 27`, `logins: 26`. (The `git checkout` line throws away the report file it rewrote.)
- The import prints one line of JSON containing `"status":"done"`, `"tickets":275`, `"imported":275`, `"skipped":0` and `"unexplained":0`.
  It also prints `pendingPeople`: how many names in Bhavin's tickets matched nobody on the people list (see below). Paste back the whole line.
- Checked on a copy of the real files the same way (local database): 275 tickets, 889 events, 250 work segments, 115 reports, `unexplained: 0`, 9 pending people with
  `users.json` as the people list. About 31 appear when Bhavin's short names ("Asha K") meet a list of full names; the exact number does not matter.
- On a phone: open `site_url`, sign in as an admin from the people list with the password you chose, and the desk Open list shows the tickets.

Running either command a second time is safe: the import skips what it already holds, and the seed **refuses** (`seed: Cosmos already
holds 275 tickets, 1 import batch, 2 audit rows; nothing was changed`) instead of wiping the plant. It refuses when Cosmos holds any ticket, any import
batch (an undone one is the proof of the undo) or any audit line, and whatever status Cosmos has. The seed also refuses on staging without `SEED_PEOPLE_FILE`, so the
fake test people can never be loaded here.

To take the load back out (the whole batch, one command; needs the `batchId` from the import line):

```bash
ROUTER_DATABASE_URL="$OWNER_URL" APP_ENV=staging pnpm import:undo <batchId> --tenant cosmos --operator nimish
```

**The pending people.** Names in Bhavin's tickets that match nobody on the people list become "pending" people (a person row marked
pending, kind production), so no ticket loses its name. **No screen or command merges them yet:** the people screen is ticket 21, and
merging touches ticket history, which the database now protects, so it needs its own design (decision for Nimish at the gate).
Until then they stay as short names on old tickets and do not block anything you try on the phone. Do not edit them in the database by hand.

Terraform binary: `.tools/bin/terraform` on Nimish's Mac (the sandbox builder used `/tmp/tf/terraform`).

## Bring it up from nothing (Nimish's Mac, once; already done for staging, kept for a rebuild)

1. `export AWS_PROFILE=argus`, then `cd infra/terraform`, then `cp terraform.tfvars.example terraform.tfvars`.
   Set `billing_email`; keep `domain = ""` and `github_repo = "argus"`.
2. `../../.tools/bin/terraform init`, then `../../.tools/bin/terraform plan -out=staging.plan`. Send the
   `Plan: N to add, ...` line to the orchestrator and wait. Then `../../.tools/bin/terraform apply staging.plan`.
3. Confirm the two "AWS Notification - Subscription Confirmation" emails (one from ap-south-1, one from us-east-1).
4. `gh secret set AWS_ROLE_ARN --body "$(../../.tools/bin/terraform output -raw deploy_role_arn)"`
5. Send back `server_public_ip` and `site_url`.
6. Start the first deploy: `gh workflow run deploy.yml`, watch it with `gh run watch`, then open `site_url` and
   `site_url/api/v1/health` (expect `{"status":"ok"}`).

The first deploy stops at "migration failed" until the RDS migration fix lands (a separate ticket); nothing is
replaced when that happens. The linux/arm64 image build runs under QEMU; its time is unmeasured (job limit 30 minutes).

## Test the alarms

- **Error alarm** (email "ALARM: uptimo-server-errors"):
  `aws logs create-log-stream --log-group-name /uptimo/staging/server --log-stream-name alarm-test`, then
  `aws logs put-log-events` with five `{"level":50,"msg":"alarm test"}` events on that stream. Or
  `aws cloudwatch set-alarm-state --alarm-name uptimo-server-errors --state-value ALARM --state-reason test`.
- **Uptime** (email "ALARM: uptimo-uptime", from us-east-1):
  `aws cloudwatch set-alarm-state --region us-east-1 --alarm-name uptimo-uptime --state-value ALARM --state-reason test`.
  The real test: `aws ssm send-command --instance-ids <id> --document-name AWS-RunShellScript --parameters 'commands=["cd /opt/uptimo && docker compose stop server"]'`,
  wait 3 minutes for the email, then restore with `gh workflow run deploy.yml -f action=deploy -f tag=<current sha>`.
- **Billing**: `aws budgets describe-budget --account-id <id> --budget-name argus-monthly-cost` and
  `aws budgets describe-notifications-for-budget ...`. AWS Budgets cannot be fired on demand, so this alarm is
  checked to exist, not fire-tested. It is the existing USD 150 budget; there is no second one.

If `plan` is denied in us-east-1 (the organisation policy), set `external_uptime_ping = false` and tell the
orchestrator. Point a free outside pinger at `site_url/api/v1/health` instead.

## Roll back

`gh workflow run deploy.yml -f action=rollback` returns to the previous release. No migration runs.

## Check the access is narrow

- `aws iam get-role --role-name uptimo-deploy`: the trust names only `ref:refs/heads/main`.
- `aws iam get-role-policy --role-name uptimo-server --policy-name uptimo-server`.
- `aws ec2 describe-instances --filters Name=tag:Name,Values=uptimo-server --query 'Reservations[].Instances[].MetadataOptions'`:
  `HttpTokens` is `required` and `HttpPutResponseHopLimit` is `1`.

## If HTTPS does not come up

If `docker compose logs caddy` shows an ACME error 10 minutes after the first deploy, set `enable_https = false`
in `terraform.tfvars`, then `plan` and `apply`. Staging then serves plain HTTP. Certificate issuance for
`sslip.io` names is unverified.

## Troubleshooting

- InsufficientInstanceCapacity: set `server_az_suffix = "c"` (or b), then plan and apply.

## Old audit lines (not before November 2029)

Audit lines older than 3 years are removed by one operator command; nothing can be that old before then. The two proof lines
(`person.erase`, `tenant.offboard`) are never removed. It runs on the owner login (`MIGRATION_DATABASE_URL`, the same one the
migrations use), through the tunnel of part 2. Without `--confirm` it only counts:

```bash
MIGRATION_DATABASE_URL="$OWNER_URL" pnpm audit:purge --operator nimish
MIGRATION_DATABASE_URL="$OWNER_URL" pnpm audit:purge --operator nimish --confirm
```
