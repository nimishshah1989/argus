#!/usr/bin/env bash
# history-load.sh [--legacy]: ticket 69d. Runs on the instance; .github/workflows/history-load.yml ships it over SSM.
# 1. An RDS snapshot of the database; if it fails or times out, nothing is loaded.
# 2. Inside the running release's server image: the analytics.data-from date (ADR 0027) and the 2026 breakdown log
#    (apps/server/src/seed/history-load.ts; the importer skips what it holds, so a re-run adds nothing).
# 3. With --legacy: the 2022-2025 workbooks from s3://$FILES_BUCKET/legacy/ through tools/load-legacy.ts, from a temp
#    folder that is removed whatever happens. Staging only. Prints counts, batch ids and the snapshot name, never row text.
set -euo pipefail
UPTIMO_DIR="${UPTIMO_DIR:-/opt/uptimo}"
DB_INSTANCE_ID="${DB_INSTANCE_ID:-uptimo-postgres}"
SNAPSHOT_WAIT="${SNAPSHOT_WAIT:-1200}"
TENANT="${TENANT:-cosmos}"
DATA_FROM="${DATA_FROM:-2026-01-01}"
legacy=false
case "${1:-}" in
  --legacy) legacy=true ;;
  '') ;;
  *) echo "usage: history-load.sh [--legacy]"; exit 1 ;;
esac
cd "$UPTIMO_DIR"
set -a; . ./.env; set +a
"$UPTIMO_DIR/instance/refresh-env.sh" >/dev/null
grep -qx 'APP_ENV=staging' app.env || { echo "STOP: this is not staging; nothing changed"; exit 1; }
tag="$(cat .current_tag 2>/dev/null || true)"
[ -n "$tag" ] || { echo "STOP: no running release; nothing changed"; exit 1; }
image="$ECR_REGISTRY/uptimo-server:$tag"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
if [ "$legacy" = true ]; then
  : "${FILES_BUCKET:?FILES_BUCKET is required for --legacy}"
  mkdir -p "$work/legacy"
  aws s3 cp --recursive "s3://$FILES_BUCKET/legacy/" "$work/legacy" --only-show-errors
  count="$(find "$work/legacy" -name "*.xlsx" | wc -l | tr -d " ")"
  [ "$count" -gt 0 ] || { echo "STOP: no .xlsx under s3://$FILES_BUCKET/legacy/; nothing changed"; exit 1; }
  echo "legacy workbooks: $count"
  # The image runs as its own non-root user: it must be able to read the copied files.
  chmod -R a+rX "$work"
fi

snapshot="uptimo-pre-history-$(date -u +%Y%m%d%H%M%S)"
echo "taking snapshot $snapshot of $DB_INSTANCE_ID first"
if ! { aws rds create-db-snapshot --region "$AWS_REGION" --db-instance-identifier "$DB_INSTANCE_ID" \
    --db-snapshot-identifier "$snapshot" >/dev/null &&
  timeout "$SNAPSHOT_WAIT" aws rds wait db-snapshot-available --region "$AWS_REGION" \
    --db-snapshot-identifier "$snapshot"; }; then
  echo "STOP: snapshot $snapshot failed or timed out; nothing loaded"
  exit 1
fi
echo "backup: snapshot $snapshot is available"

run() { docker run --rm --env-file "$UPTIMO_DIR/app.env" -v "$work:/data:ro" "$image" "$@"; }
run node_modules/.bin/tsx apps/server/src/seed/history-load.ts --tenant "$TENANT" --data-from "$DATA_FROM"
if [ "$legacy" = true ]; then
  run node_modules/.bin/tsx tools/load-legacy.ts --data /data/legacy --tenant "$TENANT" --allow-remote
fi
echo "history load ok with $tag; to take it back: import:undo <batchId> per batch, or restore $snapshot (infra/RESTORE.md)"
