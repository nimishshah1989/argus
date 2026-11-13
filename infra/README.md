# Infrastructure

Terraform for AWS Mumbai (RDS, S3, IAM, Secrets Manager, EC2), Docker Compose with Caddy, deploy and rollback scripts, `.env.example`, restore runbook. Created in M0. Staging first; production only at the M1b gate.

The server and web images are built by CI, pushed to ECR (tag = commit SHA) and started on the instance over
SSM by `instance/deploy.sh`, which migrates first and rolls back by itself if the new release fails its health
check. `instance/refresh-env.sh` writes the database settings from Secrets Manager. Bring-up and alarm tests:
`STAGING.md`; what first boot does: `BOOTSTRAP.md`.
