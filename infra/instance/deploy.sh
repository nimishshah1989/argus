#!/usr/bin/env bash
# deploy.sh deploy <tag> | rollback. Runs on the instance; CI ships it over SSM on every deploy.
set -euo pipefail
UPTIMO_DIR="${UPTIMO_DIR:-/opt/uptimo}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-60}"
DB_INSTANCE_ID="${DB_INSTANCE_ID:-uptimo-postgres}"
SNAPSHOT_WAIT="${SNAPSHOT_WAIT:-1200}" # seconds to wait for the snapshot before giving up
cd "$UPTIMO_DIR"
set -a; . ./.env; set +a

current="$(cat .current_tag 2>/dev/null || true)"
previous="$(cat .previous_tag 2>/dev/null || true)"

FILES_VOLUME="uptimo_files" # the same name as `files:` in docker-compose.yml; never remove it
up() { IMAGE_TAG="$1" docker compose up -d; }

healthy() {
  local tries=$((HEALTH_TIMEOUT / 2))
  [ "$tries" -ge 1 ] || tries=1
  for ((i = 1; i <= tries; i++)); do
    docker compose exec -T server wget -qO- http://localhost:3001/api/v1/health >/dev/null 2>&1 && return 0
    [ "$i" -lt "$tries" ] && sleep 2
  done
  return 1
}

# One real PDF made inside the running container (scripts/pdf-smoke.ts): no Chromium, no Gujarati font or a user
# that cannot run Chromium fails the release here, not on the first report somebody prints.
pdf_works() {
  local out
  if out="$(docker compose exec -T server node_modules/.bin/tsx scripts/pdf-smoke.ts 2>&1)"; then return 0; fi
  echo "PDF check failed: $(printf '%s' "$out" | tail -3)"
  return 1
}

# Before migrations that change the database: a snapshot you can restore (CLAUDE.md: back up first).
# Sets `snapshot` to its name, or leaves it empty when nothing was pending. Any answer that is not exactly
# "pending: 0" counts as pending, so a doubt is settled by taking the snapshot.
snapshot=""
snapshot_if_migrating() {
  local image="$1" tag="$2" out short
  if ! out="$(docker run --rm --env-file "$UPTIMO_DIR/migrate.env" "$image" \
    node_modules/.bin/tsx scripts/migrate.ts --pending)"; then
    echo "could not read the database's migration state; nothing changed; ${current:-nothing} still running"
    exit 1
  fi
  if printf '%s\n' "$out" | grep -qx 'pending: 0'; then return 0; fi
  short="${tag//[^A-Za-z0-9]/}"
  snapshot="uptimo-pre-${short:0:12}-$(date -u +%Y%m%d%H%M%S)"
  echo "migrations are pending; taking snapshot $snapshot of $DB_INSTANCE_ID first"
  if ! { aws rds create-db-snapshot --region "$AWS_REGION" --db-instance-identifier "$DB_INSTANCE_ID" \
      --db-snapshot-identifier "$snapshot" >/dev/null &&
    timeout "$SNAPSHOT_WAIT" aws rds wait db-snapshot-available --region "$AWS_REGION" \
      --db-snapshot-identifier "$snapshot"; }; then
    echo "snapshot $snapshot failed or timed out; nothing migrated; ${current:-nothing} still running"
    exit 1
  fi
}

# The disk holds a few large images (Chromium is in the server image). Before pulling a new release, drop every
# uptimo image except the running one and the rollback one, then dangling layers; nothing else is touched.
free_space() {
  local keep="$1"
  docker image ls --format '{{.Repository}}:{{.Tag}}' | grep -E '/uptimo-(server|web):' |
    grep -vE ":(${keep})$" | xargs -r docker image rm >/dev/null 2>&1 || true
  docker image prune -f >/dev/null 2>&1 || true
}

# The server runs as `node`; a fresh volume belongs to root, so hand it over before the release starts.
files_volume_ready() {
  if ! docker run --rm --user root -v "$FILES_VOLUME:/data/files" "$1" chown node:node /data/files; then
    echo "could not prepare the files volume $FILES_VOLUME; nothing replaced; ${current:-nothing} still running"
    exit 1
  fi
}

prepare() {
  "$UPTIMO_DIR/instance/refresh-env.sh"
  "$UPTIMO_DIR/instance/install-files-backup.sh"
  aws ecr get-login-password --region "$AWS_REGION" |
    docker login --username AWS --password-stdin "$ECR_REGISTRY"
}

deploy() {
  local tag="$1" image
  image="$ECR_REGISTRY/uptimo-server:$tag"
  prepare
  free_space "$(printf '%s|%s|%s' "${current:-none}" "${previous:-none}" "$tag")"
  IMAGE_TAG="$tag" docker compose pull
  snapshot_if_migrating "$image" "$tag"
  if ! docker run --rm --env-file "$UPTIMO_DIR/migrate.env" "$image" \
    node_modules/.bin/tsx scripts/migrate.ts; then
    echo "migration failed; ${current:-nothing} still running${snapshot:+; snapshot $snapshot was taken first}"
    exit 1
  fi
  files_volume_ready "$image"
  up "$tag" || true
  if healthy && pdf_works; then
    if [ -n "$current" ] && [ "$current" != "$tag" ]; then echo "$current" > .previous_tag; fi
    echo "$tag" > .current_tag
    echo "deployed $tag"
    return
  fi
  if [ -z "$current" ]; then
    echo "release check failed on the first deploy; nothing to roll back to"
    exit 1
  fi
  up "$current"
  echo "release check failed; rolled back to $current"
  if [ -n "$snapshot" ]; then
    echo "WARNING: the database was already migrated for $tag, so $current is running on the NEW schema."
    echo "That is safe only if the migration was additive (nothing dropped or renamed)."
    echo "Check the app now. To undo the data change, restore snapshot $snapshot (infra/RESTORE.md)."
  fi
  healthy || echo "WARNING: $current is not healthy either"
  exit 1
}

rollback() {
  prepare
  if [ -z "$previous" ]; then echo "no previous release"; exit 1; fi
  files_volume_ready "$ECR_REGISTRY/uptimo-server:$previous"
  up "$previous"
  healthy || { echo "health failed after rollback to $previous"; exit 1; }
  echo "$previous" > .current_tag
  echo "$current" > .previous_tag
  echo "rolled back to $previous"
}

case "${1:-}" in
  deploy) deploy "${2:?usage: deploy.sh deploy <tag> | rollback}" ;;
  rollback) rollback ;;
  *) echo "usage: deploy.sh deploy <tag> | rollback"; exit 1 ;;
esac
