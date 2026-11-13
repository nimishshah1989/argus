#!/usr/bin/env bash
# deploy.sh deploy <tag> | rollback. Runs on the instance; CI ships it over SSM on every deploy.
set -euo pipefail
UPTIMO_DIR="${UPTIMO_DIR:-/opt/uptimo}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-60}"
cd "$UPTIMO_DIR"
set -a; . ./.env; set +a

current="$(cat .current_tag 2>/dev/null || true)"
previous="$(cat .previous_tag 2>/dev/null || true)"

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

prepare() {
  "$UPTIMO_DIR/instance/refresh-env.sh"
  aws ecr get-login-password --region "$AWS_REGION" |
    docker login --username AWS --password-stdin "$ECR_REGISTRY"
}

deploy() {
  local tag="$1"
  prepare
  IMAGE_TAG="$tag" docker compose pull
  if ! docker run --rm --env-file "$UPTIMO_DIR/migrate.env" "$ECR_REGISTRY/uptimo-server:$tag" \
    node_modules/.bin/tsx scripts/migrate.ts; then
    echo "migration failed; ${current:-nothing} still running"
    exit 1
  fi
  up "$tag" || true
  if healthy; then
    if [ -n "$current" ] && [ "$current" != "$tag" ]; then echo "$current" > .previous_tag; fi
    echo "$tag" > .current_tag
    echo "deployed $tag"
    return
  fi
  if [ -n "$current" ]; then
    up "$current"
    echo "health failed; rolled back to $current"
  else
    echo "health failed on the first deploy; nothing to roll back to"
  fi
  exit 1
}

rollback() {
  prepare
  if [ -z "$previous" ]; then echo "no previous release"; exit 1; fi
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
