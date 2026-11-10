# Restore runbook

A backup you have not restored is a hope. This drill runs in M0 and quarterly.

## 1. RDS point-in-time restore

```bash
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier argus-postgres \
  --target-db-instance-identifier argus-postgres-restore \
  --use-latest-restorable-time \
  --db-subnet-group-name argus-db-subnet \
  --vpc-security-group-ids sg-XXXX
```

Wait for `available`, then update `DATABASE_URL` on staging to the restore endpoint and run `pnpm test` against it (read-only smoke: counts match).

## 2. S3 object restore

Versioning is on, so a deleted object is recovered by copying its previous version:

```bash
aws s3api list-object-versions --bucket <bucket> --prefix <key>
aws s3api get-object --bucket <bucket> --key <key> --version-id <id> /tmp/restored
```

## 3. Logical dump (weekly)

```bash
pg_dump "$DATABASE_URL" -Fc -f "backup-$(date +%F).dump"
aws s3 cp "backup-$(date +%F).dump" "s3://<bucket>/backups/"
```

## 4. Drill log

Record each run here: date, who, what was restored, checks run, result.

- (pending first execution — requires the AWS account)
