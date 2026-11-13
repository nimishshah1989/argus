#!/usr/bin/env bash
# dump-restore-drill.sh: Drill B. Restores the newest weekly dump into a throwaway Postgres on this instance and counts
# it with the running release. Touches no AWS database. Needs BACKUP_BUCKET. Everything it starts is removed at the end.
set -euo pipefail
UPTIMO_DIR="${UPTIMO_DIR:-/opt/uptimo}"
: "${BACKUP_BUCKET:?BACKUP_BUCKET is required}"
cd "$UPTIMO_DIR"
set -a; . ./.env; set +a
work="$(mktemp -d)"
scratch="scratch-pg-$$"
trap 'docker rm -f "$scratch" >/dev/null 2>&1 || true; rm -rf "$work"' EXIT

key="$(aws s3api list-objects-v2 --bucket "$BACKUP_BUCKET" --prefix dumps/ \
  --query 'sort_by(Contents,&LastModified)[-1].Key' --output text)"
if [ -z "$key" ] || [ "$key" = "None" ]; then echo "STOP: no dump in s3://$BACKUP_BUCKET/dumps/"; exit 1; fi
aws s3 cp "s3://$BACKUP_BUCKET/$key" "$work/restore.dump" --only-show-errors

docker run -d --name "$scratch" -e POSTGRES_PASSWORD=scratch -v "$work:/in:ro" postgres:16-alpine >/dev/null
for _ in $(seq 1 30); do docker exec "$scratch" pg_isready -U postgres -q && break; sleep 2; done
# pg_restore exits 1 for harmless notes such as "schema public already exists"; any other error stops the drill.
docker exec "$scratch" pg_restore -U postgres -d postgres --no-owner --no-privileges /in/restore.dump \
  2> "$work/errors" || true
if grep -i 'error' "$work/errors" | grep -vi 'already exists' | grep -q .; then
  grep -i 'error' "$work/errors" | grep -vi 'already exists' | head -5
  echo "STOP: the restore had errors"
  exit 1
fi
echo "RESTORED $key"
docker run --rm --network "container:$scratch" \
  -e MIGRATION_DATABASE_URL=postgresql://postgres:scratch@localhost:5432/postgres \
  "$ECR_REGISTRY/uptimo-server:$(cat .current_tag)" node_modules/.bin/tsx scripts/restore-check.ts
