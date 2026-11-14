#!/usr/bin/env bash
# files-restore.sh drill | live [key]: Drill C. Unpacks a files-volume archive (default: the newest) from the backup bucket.
#   drill  restores into a throwaway volume, compares its file list with the live volume, removes it. Touches nothing live.
#   live   restores into the live volume. Stop the server first; this REPLACES what the volume holds.
# BACKUP_BUCKET is optional (read from the secret as files-backup.sh does).
set -euo pipefail
UPTIMO_DIR="${UPTIMO_DIR:-/opt/uptimo}"
FILES_VOLUME="${FILES_VOLUME:-uptimo_files}"
mode="${1:?usage: files-restore.sh drill|live [key]}"
cd "$UPTIMO_DIR"
set -a; . ./.env; set +a
image="$ECR_REGISTRY/uptimo-server:$(cat .current_tag)"
bucket="${BACKUP_BUCKET:-$(aws secretsmanager get-secret-value --secret-id "$SECRET_ID" --region "$AWS_REGION" \
  --query SecretString --output text | jq -er .BACKUP_BUCKET)}"
key="${2:-$(aws s3api list-objects-v2 --bucket "$bucket" --prefix files-volume/ \
  --query 'sort_by(Contents,&LastModified)[-1].Key' --output text)}"
if [ -z "$key" ] || [ "$key" = "None" ]; then echo "STOP: no archive in s3://$bucket/files-volume/"; exit 1; fi

work="$(mktemp -d)"
scratch="uptimo_files_drill"
trap 'rm -rf "$work"; docker volume rm "$scratch" >/dev/null 2>&1 || true' EXIT
aws s3 cp "s3://$bucket/$key" "$work/files.tar.gz" --only-show-errors
tar tzf "$work/files.tar.gz" >/dev/null || { echo "STOP: the archive cannot be read"; exit 1; }

# One line per file: size and path, so the two sides compare in full, not just by count.
listing() { docker run --rm -v "$1:/data/files:ro" "$image" sh -c 'cd /data/files && find . -type f -exec wc -c {} + | grep -v " total$" | sort -k2'; }
unpack() {
  docker run --rm --user root -v "$1:/data/files" -v "$work:/in:ro" "$image" \
    sh -c 'tar xzf /in/files.tar.gz -C /data/files && chown -R node:node /data/files'
}

case "$mode" in
  drill)
    docker volume rm "$scratch" >/dev/null 2>&1 || true
    unpack "$scratch"
    restored="$(listing "$scratch")"
    live="$(listing "$FILES_VOLUME")"
    echo "RESTORED $key: $(printf '%s' "$restored" | grep -c .) files"
    if [ "$restored" = "$live" ]; then echo "SAME as the live volume"; else
      echo "DIFFERENT from the live volume (files added or removed since the archive; diff follows)"
      diff <(printf '%s\n' "$live") <(printf '%s\n' "$restored") || true
    fi ;;
  live)
    unpack "$FILES_VOLUME"
    echo "RESTORED $key into $FILES_VOLUME: $(listing "$FILES_VOLUME" | grep -c .) files" ;;
  *) echo "usage: files-restore.sh drill|live [key]"; exit 1 ;;
esac
