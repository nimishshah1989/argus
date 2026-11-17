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
  case "$path" in
    apps/server/* | packages/* | tools/* | scripts/* | *.sql) server=true ;;
  esac
  case "$path" in
    apps/web/* | packages/shared/src/i18n/* | packages/shared/src/* | playwright.config.ts) web=true ;;
  esac
  case "$path" in
    apps/web/src/ui/* | apps/web/src/gallery/* | apps/web/e2e/gallery/* | *__screenshots__/*) gallery=true ;;
  esac
done

printf 'server=%s web=%s gallery=%s\n' "$server" "$web" "$gallery"
