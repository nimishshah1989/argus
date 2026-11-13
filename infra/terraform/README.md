# Terraform — AWS Mumbai

Provisions staging in ap-south-1: VPC (public EC2, private RDS), EC2 t4g.medium, RDS Postgres 16, S3, images in ECR, logs, alarms and the GitHub deploy role. The state lives in the S3 bucket named in `main.tf`.

- `main.tf`: network, database, files bucket, server and its role, Elastic IP, DNS.
- `deploy.tf`: GitHub OIDC trust, the narrow deploy role, the two ECR repositories.
- `backup.tf`: the backup bucket (weekly dumps, 13 weeks) and the instance's right to add a dump to it. Point-in-time window: `backup_retention_period` in `main.tf`.
- `secrets.tf`: the database secret the instance reads at deploy time.
- `alarms.tf`: server log group, error-count alarm, email topic, and the us-east-1 uptime ping.

Steps to apply and test: `../STAGING.md`. The billing alarm is the account's existing `argus-monthly-cost` budget; Terraform does not create one.
