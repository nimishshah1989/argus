#!/usr/bin/env bash
# Installs the OS font the gallery baselines are drawn with (D20): fonts-noto-core 20201225-2, the one version
# Ubuntu noble has ever shipped (no -updates or -security build), plus the fonts-noto-mono it depends on.
# Fetching the two pinned files and checking their SHA256 takes seconds; `apt-get update` took four minutes
# in CI. If a file cannot be fetched or does not match, it falls back to apt, which installs the same package.
# Usage (as root, in the Playwright image): bash tools/install-fonts.sh
set -euo pipefail

POOL=pool/main/f/fonts-noto
CORE=fonts-noto-core_20201225-2_all.deb
CORE_SHA=4fee136cb12fc197703a340e010478f780a41044339fcefbd78ed9aa96c8b617
MONO=fonts-noto-mono_20201225-2_all.deb
MONO_SHA=ce277a6e2fbbe7562206171e20e0493ac42c9c405758505cb42aaa01c982036c

fetch() { # file sha
  for mirror in http://azure.archive.ubuntu.com/ubuntu http://archive.ubuntu.com/ubuntu; do
    curl -fsS --retry 2 --max-time 120 -o "$dir/$1" "$mirror/$POOL/$1" || continue
    if echo "$2  $dir/$1" | sha256sum -c --quiet -; then return 0; fi
  done
  return 1
}

dir=$(mktemp -d)
if fetch "$MONO" "$MONO_SHA" && fetch "$CORE" "$CORE_SHA"; then
  dpkg -i "$dir/$MONO" "$dir/$CORE"
else
  echo "install-fonts: pinned download failed; falling back to apt" >&2
  apt-get update -o Acquire::Languages=none
  apt-get install -y --no-install-recommends fonts-noto-core
fi
rm -rf "$dir"
dpkg -l fonts-noto-core | tail -1
