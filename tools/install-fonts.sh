#!/usr/bin/env bash
# Installs the OS font the gallery baselines are drawn with (D20): fonts-noto-core 20201225-2, the one version
# Ubuntu noble has ever shipped (no -updates or -security build), plus the fonts-noto-mono it depends on.
# Fetching the two pinned files and checking their SHA256 takes seconds; `apt-get update` took four minutes
# in CI. If a file cannot be fetched or does not match, it falls back to apt, which installs the same package.
# The two files are kept in $FONTS_DEB_DIR when it is set: CI restores that folder from the actions cache, so a
# warm run downloads nothing (the mirrors took 61 to 338 s from a runner), and the warm-fonts-cache workflow
# fills it. A file already there is used only if its SHA256 matches; a bad copy is fetched again.
# Usage (as root, in the Playwright image): bash tools/install-fonts.sh [--download-only]
set -euo pipefail

POOL=pool/main/f/fonts-noto
CORE=fonts-noto-core_20201225-2_all.deb
CORE_SHA=4fee136cb12fc197703a340e010478f780a41044339fcefbd78ed9aa96c8b617
MONO=fonts-noto-mono_20201225-2_all.deb
MONO_SHA=ce277a6e2fbbe7562206171e20e0493ac42c9c405758505cb42aaa01c982036c

dir=${FONTS_DEB_DIR:-$(mktemp -d)}
mkdir -p "$dir"

ok() { echo "$2  $dir/$1" | sha256sum -c --quiet - >/dev/null 2>&1; } # file sha

fetch() { # file sha: a verified copy, from the cache folder or the first mirror that answers in time
  ok "$1" "$2" && return 0
  for mirror in http://azure.archive.ubuntu.com/ubuntu http://archive.ubuntu.com/ubuntu; do
    curl -fsS --connect-timeout 5 --max-time 30 --retry 1 -o "$dir/$1" "$mirror/$POOL/$1" || continue
    ok "$1" "$2" && return 0
  done
  return 1
}

if fetch "$MONO" "$MONO_SHA" && fetch "$CORE" "$CORE_SHA"; then
  [ "${1:-}" = "--download-only" ] && exit 0
  dpkg -i "$dir/$MONO" "$dir/$CORE"
  [ -n "${FONTS_DEB_DIR:-}" ] || rm -rf "$dir"
else
  # A partial folder must not be saved as the cache: drop it so the cache step finds nothing to save.
  rm -rf "$dir"
  [ "${1:-}" = "--download-only" ] && exit 1
  echo "install-fonts: pinned download failed; falling back to apt" >&2
  apt-get update -o Acquire::Languages=none
  apt-get install -y --no-install-recommends fonts-noto-core
fi
dpkg -l fonts-noto-core | tail -1
