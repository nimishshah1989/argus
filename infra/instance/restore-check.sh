#!/usr/bin/env bash
# restore-check.sh [host]: per-customer record counts of the live database, or of a restored copy at [host].
# Runs on the instance with the release that is running. Read-only. Prints counts, never a value.
set -euo pipefail
UPTIMO_DIR="${UPTIMO_DIR:-/opt/uptimo}"
cd "$UPTIMO_DIR"
set -a; . ./.env; set +a
"$UPTIMO_DIR/instance/refresh-env.sh" >/dev/null
set -a; . ./migrate.env; set +a
if [ -n "${1:-}" ]; then
  # Same login and database name, another server: swap only the host (and port) after the `@`.
  MIGRATION_DATABASE_URL="$(sed -E "s#@[^/]+/#@$1:5432/#" <<<"$MIGRATION_DATABASE_URL")"
  export MIGRATION_DATABASE_URL
fi
docker run --rm -e MIGRATION_DATABASE_URL "$ECR_REGISTRY/uptimo-server:$(cat .current_tag)" \
  node_modules/.bin/tsx scripts/restore-check.ts
