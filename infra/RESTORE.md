# Restore runbook

A backup you have not restored is a hope. Run this drill once before Nimish tests staging, then quarterly. Every
command below is run on Nimish's Mac (`export AWS_PROFILE=argus AWS_REGION=ap-south-1` first). The log of each run goes
in `docs/plan/restore-drill-log.md`. **Not yet run on AWS: written without access to the account, so the first run is
also the test of this page.** Where a step says "unverified", paste the exact output back if it differs.

## What is kept, and for how long

| Copy                        | Where                                                                                                 | How far back                              | Restores into                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------- |
| RDS automated backup (PITR) | RDS, `backup_retention_period` (14 after the next maintenance window; 7 until then)                   | any second in the last 14 days            | a new RDS server, minutes to hours |
| Weekly dump (`pg_dump -Fc`) | S3 `uptimo-…-backups`, `dumps/`                                                                       | 13 weeks, one per week (Mon 03:00 Mumbai) | any Postgres 16                    |
| Files (photos, PDFs)        | S3 `uptimo-…-files`, versioned                                                                        | every version                             | the same bucket                    |
| Uploaded logos (until S3)   | Docker volume `uptimo_files` on the server; nightly archive in S3 `uptimo-…-backups`, `files-volume/` | 13 weeks, one per night (02:00 Mumbai)    | the volume (Drill C)               |

**What counts as the backup:** point-in-time recovery plus RDS snapshots (one is taken before the first migration, one before the Cosmos
load, and `deploy.sh` takes `uptimo-pre-<tag>-<time>` before every deploy that migrates). The weekly dump is best effort: RDS's master login may be refused a full dump (section 0, step 4). If so, it is recorded in the
drill log and the dump is not relied on. GitHub pauses scheduled workflows in a repository with no activity for 60 days; the drill log
shows the date of the last dump.

## 0. Switch the weekly dump on (once, after Nimish applies the Terraform in `infra/terraform`)

1. `cd infra/terraform && ../../.tools/bin/terraform output -raw backup_bucket` prints the bucket name.
2. `gh variable set BACKUP_BUCKET --body "$(../../.tools/bin/terraform output -raw backup_bucket)"`
3. `gh workflow run backup.yml`, then `gh run watch`. Success ends with a line
   `dump ok: s3://uptimo-xxxx-backups/dumps/uptimo-<date>.dump (<bytes> bytes)`.
4. If it says `STOP: this login is subject to row security`, the weekly dump cannot work with the master login. **On RDS this is the likely
   result and is not a fault of the drill.** Write it in the drill log and carry on; send the line back.
   Measured on a plain Postgres 16 with a non-superuser owner: `pg_dump` fails with "query would be affected by row-level
   security policy", so the script stops instead of storing a partial file. **Unverified: whether RDS's master login is exempt.**
   The point-in-time restore (Drill A) does not depend on it. If the dump is blocked, the decision (for the orchestrator, not Nimish) is
   between a per-table `NO FORCE ROW LEVEL SECURITY` window during the dump, an RDS snapshot export to S3, or point-in-time only.

## 1. Drill A: restore the database to a point in time

1. Note the time: `date -u +%FT%TZ`. Write it in the log. No one should be using staging during the drill.
2. Count what staging holds now:

   ```bash
   IID=$(cd infra/terraform && ../../.tools/bin/terraform output -raw server_instance_id)
   run_on_instance() {
     CID=$(aws ssm send-command --instance-ids "$IID" --document-name AWS-RunShellScript \
       --parameters "commands=[\"$1\"]" --query Command.CommandId --output text)
     sleep 25
     aws ssm get-command-invocation --command-id "$CID" --instance-id "$IID" \
       --query '[Status,StandardOutputContent,StandardErrorContent]' --output text
   }
   run_on_instance "/opt/uptimo/instance/restore-check.sh" > counts-live.txt; cat counts-live.txt
   ```

   Success: `Success` then JSON with `"tickets": 275` for `cosmos` (after ticket 14's load) and the migration count.
   If `Status` is `InProgress`, wait a minute and run the `get-command-invocation` line again.

3. Restore to a new, separate server (the live one is not touched):

   ```bash
   RDS_SG=$(aws rds describe-db-instances --db-instance-identifier uptimo-postgres \
     --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' --output text)
   aws rds restore-db-instance-to-point-in-time \
     --source-db-instance-identifier uptimo-postgres \
     --target-db-instance-identifier uptimo-postgres-restore \
     --use-latest-restorable-time \
     --db-subnet-group-name uptimo-db-subnet \
     --vpc-security-group-ids "$RDS_SG" \
     --db-instance-class db.t4g.micro --no-publicly-accessible
   aws rds wait db-instance-available --db-instance-identifier uptimo-postgres-restore
   ```

   The wait ends by itself (10 to 30 minutes). Write the minutes it took in the log: that is how long a real recovery takes.

4. Count the restored copy the same way, using its address:

   ```bash
   HOST=$(aws rds describe-db-instances --db-instance-identifier uptimo-postgres-restore \
     --query 'DBInstances[0].Endpoint.Address' --output text)
   run_on_instance "/opt/uptimo/instance/restore-check.sh $HOST" > counts-restored.txt; cat counts-restored.txt
   ```

5. Compare: `diff <(tail -n +2 counts-live.txt) <(tail -n +2 counts-restored.txt) && echo SAME`.
   **Success is `SAME`.** The restore uses the latest restorable time, so a change made between steps 2 and 3 shows as a
   difference; if so, say what changed in the log and repeat from step 2.

6. Remove the drill copy (only this one, it has `-restore` in its name):

   ```bash
   aws rds delete-db-instance --db-instance-identifier uptimo-postgres-restore --skip-final-snapshot
   ```

7. Fill in the log row (`docs/plan/restore-drill-log.md`) and paste both count files under it.

## 2. Drill B: restore the weekly dump into a scratch database (no AWS database involved)

Runs on the instance in a throwaway container that is removed at the end. It needs the bucket name and at least one dump
(section 0, step 3).

```bash
BUCKET=$(cd infra/terraform && ../../.tools/bin/terraform output -raw backup_bucket)
run_on_instance "BACKUP_BUCKET=$BUCKET /opt/uptimo/instance/dump-restore-drill.sh" | tee counts-dump.txt
```

Success: `Success`, then `RESTORED dumps/uptimo-<date>.dump`, then the same kind of count JSON as Drill A. The counts equal the
live ones as of the dump's date (a week old at most): compare the ticket count first. `STOP: the restore had errors` means a
real problem: paste the lines under it back. (`pg_restore` prints harmless `already exists` notes for the default schema;
the script ignores those and nothing else.) The drill takes 1 to 3 minutes; if `Status` is `InProgress`, run the
`get-command-invocation` line from Drill A step 2 again.

## 3. Drill C: restore the files volume

Uploaded company logos live on the server's disk, in the Docker volume `uptimo_files` (mounted at `FILES_DIR=/data/files`), until the S3
adapter exists. A redeploy keeps the volume. A timer on the instance (`uptimo-files-backup.timer`, every night at 02:00 Mumbai) archives it
to `s3://uptimo-…-backups/files-volume/files-<date>.tar.gz`. Use `run_on_instance` from Drill A step 2.

1. Check the timer is armed and see its last run:

   ```bash
   run_on_instance "systemctl list-timers uptimo-files-backup.timer --no-pager; systemctl status uptimo-files-backup.service --no-pager | head -12"
   ```

   Success: the timer shows a `NEXT` time tonight; the service shows `Deactivated successfully` (or "inactive (dead)") and no `failed`.

2. Take a backup now rather than wait for the night, and look at it:

   ```bash
   run_on_instance "systemctl start uptimo-files-backup.service && journalctl -u uptimo-files-backup.service -n 3 --no-pager"
   BUCKET=$(cd infra/terraform && ../../.tools/bin/terraform output -raw backup_bucket)
   aws s3 ls "s3://$BUCKET/files-volume/"
   ```

   Success: a line `files backup ok: s3://uptimo-…-backups/files-volume/files-<date>.tar.gz (<bytes> bytes)`, and the same file in the listing.
   `STOP:` means nothing was uploaded; paste the line back.

3. Restore the newest archive into a throwaway volume and compare it with the live one (the live volume is not touched):

   ```bash
   run_on_instance "/opt/uptimo/instance/files-restore.sh drill" | tee files-drill.txt
   ```

   Success: `RESTORED files-volume/files-<date>.tar.gz: <n> files`, then `SAME as the live volume`. `DIFFERENT` is not a failure when a logo was
   uploaded after the archive was taken; the lines under it show which. Repeat step 2 and 3 to be sure. The throwaway volume is removed at
   the end. (Takes under a minute; if `Status` is `InProgress`, run the `get-command-invocation` line of Drill A step 2 again.)
   Before the first upload, the volume is empty: `0 files` and `SAME` is the right answer.

4. The redeploy check, once: upload a logo in the app, run `gh workflow run deploy.yml`, wait for the green tick, open the same logo again.
   Success: it is still there. (Before this change a redeploy lost it.)

A real loss of the volume (not a drill): stop the server, restore into the live volume, start it again. A specific night: add its key
(`files-volume/files-<date>.tar.gz`) after `live`.

```bash
run_on_instance "cd /opt/uptimo && docker compose stop server && /opt/uptimo/instance/files-restore.sh live"
run_on_instance "cd /opt/uptimo && set -a && . ./.env && set +a && IMAGE_TAG=\$(cat .current_tag) docker compose up -d server"
```

Success: `RESTORED … into uptimo_files: <n> files`, then the logos show in the app. The restore adds and overwrites files; it does not remove a
file the archive lacks. If the volume itself is gone (`docker volume ls` shows no `uptimo_files`), the next deploy recreates it empty first.

## 4. A real loss (not a drill)

1. Stop the server so nothing writes: `run_on_instance "cd /opt/uptimo && docker compose stop server"`.
2. Restore to a new server exactly as Drill A step 3, choosing the time just before the damage: replace
   `--use-latest-restorable-time` with `--restore-time 2026-12-01T09:30:00Z` (UTC).
3. Check it with Drill A step 4. If good, tell the orchestrator: pointing staging at the new server means changing
   `DATABASE_URL` and `MIGRATION_DATABASE_URL` in the secret `uptimo/staging` (hosts only), then `gh workflow run deploy.yml`.
4. Keep the damaged server until the restored one has been used for a day; delete it only with Nimish's go.

## 5. S3 object restore

Versioning is on, so a deleted or overwritten file is recovered by copying its previous version:

```bash
aws s3api list-object-versions --bucket <files bucket> --prefix <key>
aws s3api get-object --bucket <files bucket> --key <key> --version-id <id> /tmp/restored
```

## 6. Drill log

`docs/plan/restore-drill-log.md`: date, who, what was restored, counts compared, minutes taken, result. Empty until the first real run.
