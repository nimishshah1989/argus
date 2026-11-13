# Staging: bring it up, test the alarms, roll back

Terraform binary: `.tools/bin/terraform` on Nimish's Mac (the sandbox builder used `/tmp/tf/terraform`).

## Bring it up (Nimish's Mac, once)

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
