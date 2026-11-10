#!/usr/bin/env bash
# deploy.sh staging | production <tag> | rollback <tag>
set -euo pipefail

ACTION="${1:-}"
TAG="${2:-}"
IMAGE="ghcr.io/nimishshah1989/argus-server"
REMOTE_HOST="${REMOTE_HOST:-}"
REMOTE_DIR="${REMOTE_DIR:-/opt/argus}"

usage() { echo "usage: deploy.sh staging | production <tag> | rollback <tag>"; exit 1; }

build_push() {
  local version="$1" ref="$2"
  docker build -f infra/server.Dockerfile -t "${IMAGE}:${version}" .
  docker tag "${IMAGE}:${version}" "${IMAGE}:${ref}"
  docker push "${IMAGE}:${version}" "${IMAGE}:${ref}"
}

remote_up() {
  local ref="$1"
  [ -n "$REMOTE_HOST" ] || { echo "REMOTE_HOST is required to deploy"; exit 1; }
  ssh "$REMOTE_HOST" "cd ${REMOTE_DIR} && docker pull ${IMAGE}:${ref} && docker compose up -d server caddy"
}

case "$ACTION" in
  staging)
    build_push "staging-$(git rev-parse --short HEAD)" staging
    remote_up staging
    ;;
  production)
    [ -n "$TAG" ] || usage
    docker pull "${IMAGE}:${TAG}"
    docker tag "${IMAGE}:${TAG}" "${IMAGE}:production"
    docker push "${IMAGE}:production"
    remote_up production
    ;;
  rollback)
    TAG="${TAG:-previous}"
    remote_up "$TAG"
    ;;
  *) usage ;;
esac
