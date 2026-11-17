#!/bin/sh
# Which CI suites a pull request can exercise, from the paths it touches.
# Usage: bash tools/changed-areas.sh <changed path>...
# Prints one line, `server=false web=true gallery=false`. No arguments means nothing changed.
# The ci.yml `changes` job fails OPEN when the diff itself is unavailable, so this script stays dumb.
set -eu

server=false
web=false
gallery=false

for path in "$@"; do
  # A root manifest, lockfile or compiler config can break every suite, so it gates all three.
  # The no-slash guard keeps a nested config (apps/web/vite.config.ts) in its own suite.
  case "$path" in
    */*) ;;
    package.json | package-lock.json | pnpm-lock.yaml | tsconfig*.json | *.config.ts)
      server=true
      web=true
      gallery=true
      ;;
  esac
  case "$path" in
    apps/server/* | packages/* | tools/* | scripts/* | *.sql) server=true ;;
  esac
  case "$path" in
    apps/web/* | packages/shared/src/* | playwright.config.ts) web=true ;;
  esac
  case "$path" in
    apps/web/src/ui/* | apps/web/src/gallery/* | apps/web/src/patterns/* | apps/web/e2e/gallery/* | packages/shared/src/i18n/* | *__screenshots__/*) gallery=true ;;
  esac
done

printf 'server=%s web=%s gallery=%s\n' "$server" "$web" "$gallery"
