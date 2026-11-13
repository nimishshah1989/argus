#!/usr/bin/env bash
# dump.sh: the weekly logical backup. Runs on the instance; the backup workflow ships it over SSM.
# Needs BACKUP_BUCKET (Terraform output backup_bucket). Never prints a credential.
set -euo pipefail
UPTIMO_DIR="${UPTIMO_DIR:-/opt/uptimo}"
: "${BACKUP_BUCKET:?BACKUP_BUCKET is required}"
cd "$UPTIMO_DIR"
set -a; . ./.env; set +a
"$UPTIMO_DIR/instance/refresh-env.sh" >/dev/null
set -a; . ./migrate.env; set +a

# libpq does not know node-pg's `sslmode=no-verify`: drop the query string and ask for SSL.
export DBURL="${MIGRATION_DATABASE_URL%%\?*}"
stamp="$(date -u +%Y-%m-%dT%H%MZ)"
name="uptimo-$stamp.dump"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
# -e DBURL (no value) passes it from the environment, so the password never shows in the process list.
pg() { docker run --rm --user "$(id -u):$(id -g)" -e PGSSLMODE=require -e DBURL -v "$work:/out" postgres:16-alpine "$@"; }

# Row security applies to a table owner that is neither superuser nor BYPASSRLS, and pg_dump would then write
# empty tables. Stop instead of storing a backup that looks complete and is not.
ok="$(pg sh -c 'psql "$DBURL" -Atc "select rolsuper or rolbypassrls from pg_roles where rolname = current_user"')"
if [ "$ok" != "t" ]; then
  echo "STOP: this login is subject to row security; a dump from it would be incomplete. Nothing was uploaded. The point-in-time restore (infra/RESTORE.md, Drill A) does not depend on this."
  exit 1
fi

pg sh -c "pg_dump \"\$DBURL\" -Fc -f /out/$name"
# The archive must be readable and hold the ticket table, or it is not a backup.
pg sh -c "pg_restore -l /out/$name" | grep -q "TABLE DATA public ticket " || { echo "STOP: the dump has no ticket data"; exit 1; }

size="$(stat -c %s "$work/$name")"
aws s3 cp "$work/$name" "s3://$BACKUP_BUCKET/dumps/$name" --only-show-errors
remote="$(aws s3api head-object --bucket "$BACKUP_BUCKET" --key "dumps/$name" --query ContentLength --output text)"
[ "$remote" = "$size" ] || { echo "STOP: uploaded $remote bytes, dump is $size bytes"; exit 1; }
echo "dump ok: s3://$BACKUP_BUCKET/dumps/$name ($size bytes)"
