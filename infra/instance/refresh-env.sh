#!/usr/bin/env bash
# Writes app.env and migrate.env from the Secrets Manager secret. Never prints a value.
set -euo pipefail
UPTIMO_DIR="${UPTIMO_DIR:-/opt/uptimo}"
cd "$UPTIMO_DIR"
set -a; . ./.env; set +a

secret="$(aws secretsmanager get-secret-value --secret-id "$SECRET_ID" --region "$AWS_REGION" \
  --query SecretString --output text)"
umask 077
jq -r '"DATABASE_URL=" + .DATABASE_URL' <<<"$secret" > app.env
jq -r '"MIGRATION_DATABASE_URL=" + .MIGRATION_DATABASE_URL, "APP_API_PASSWORD=" + .APP_API_PASSWORD' \
  <<<"$secret" > migrate.env
echo "env refreshed"
