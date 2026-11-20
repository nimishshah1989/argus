#!/usr/bin/env bash
# Runs inside the pinned Playwright image (see `gallery:update:docker`): copies the repo to
# /work, installs, and rewrites the gallery baselines into the mounted /out. The host's
# node_modules is never touched.
set -euo pipefail

mkdir /work
tar -C /src --exclude=node_modules --exclude=.git -cf - . | tar -C /work -xf -
cd /work
bash tools/install-fonts.sh
npm i -g pnpm@10.30.3
pnpm install --frozen-lockfile
pnpm gallery:update
cp apps/web/e2e/gallery/__screenshots__/*.png /out/
