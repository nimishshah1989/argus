#!/usr/bin/env bash
# Installs (or refreshes) the nightly files-backup timer. deploy.sh runs it on every deploy and rollback; it is safe to repeat.
# user_data cannot do this: changing it would replace the instance.
set -euo pipefail
UPTIMO_DIR="${UPTIMO_DIR:-/opt/uptimo}"
SYSTEMD_DIR="${SYSTEMD_DIR:-/etc/systemd/system}"
for unit in uptimo-files-backup.service uptimo-files-backup.timer; do
  install -m 644 "$UPTIMO_DIR/instance/$unit" "$SYSTEMD_DIR/$unit"
done
systemctl daemon-reload
systemctl enable --now uptimo-files-backup.timer >/dev/null
