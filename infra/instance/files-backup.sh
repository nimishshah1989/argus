#!/usr/bin/env bash
# files-backup.sh: nightly archive of the uploaded-files volume to s3://<backup bucket>/files-volume/. Run by the
# uptimo-files-backup timer. The bucket comes from BACKUP_BUCKET, else from the secret. Never prints a credential.
set -euo pipefail
UPTIMO_DIR="${UPTIMO_DIR:-/opt/uptimo}"
FILES_VOLUME="${FILES_VOLUME:-uptimo_files}"
cd "$UPTIMO_DIR"
set -a; . ./.env; set +a
if [ ! -s .current_tag ]; then echo "STOP: nothing is deployed yet, so there is no volume to back up"; exit 1; fi
bucket="${BACKUP_BUCKET:-$(aws secretsmanager get-secret-value --secret-id "$SECRET_ID" --region "$AWS_REGION" \
  --query SecretString --output text | jq -er .BACKUP_BUCKET)}"
[ -n "$bucket" ] || { echo "STOP: no backup bucket (run terraform apply: the secret carries BACKUP_BUCKET)"; exit 1; }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
name="files-$(date -u +%Y-%m-%dT%H%MZ).tar.gz"
# The server image already holds tar. The volume is mounted read-only, so a backup cannot change a file.
docker run --rm -v "$FILES_VOLUME:/data/files:ro" "$ECR_REGISTRY/uptimo-server:$(cat .current_tag)" \
  tar czf - -C /data/files . > "$work/$name"
tar tzf "$work/$name" >/dev/null || { echo "STOP: the archive cannot be read back; nothing uploaded"; exit 1; }

size="$(stat -c %s "$work/$name")"
aws s3 cp "$work/$name" "s3://$bucket/files-volume/$name" --only-show-errors
remote="$(aws s3api head-object --bucket "$bucket" --key "files-volume/$name" --query ContentLength --output text)"
[ "$remote" = "$size" ] || { echo "STOP: uploaded $remote bytes, archive is $size bytes"; exit 1; }
echo "files backup ok: s3://$bucket/files-volume/$name ($size bytes)"
