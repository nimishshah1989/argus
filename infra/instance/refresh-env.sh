#!/usr/bin/env bash
# Writes app.env and migrate.env from the Secrets Manager secret. Never prints a value.
set -euo pipefail
UPTIMO_DIR="${UPTIMO_DIR:-/opt/uptimo}"
cd "$UPTIMO_DIR"
set -a; . ./.env; set +a

secret="$(aws secretsmanager get-secret-value --secret-id "$SECRET_ID" --region "$AWS_REGION" \
  --query SecretString --output text)"
umask 077
jq -er '"DATABASE_URL=" + .DATABASE_URL,
  (["APP_ENV","ANTHROPIC_API_KEY","AI_MODEL","AI_PRICE_INPUT_USD_PER_MTOK","AI_PRICE_OUTPUT_USD_PER_MTOK","AI_MAX_OUTPUT_TOKENS","AI_DEFAULT_MONTHLY_CAP_USD"][]
   as $k | select(has($k) and .[$k] != "") | "\($k)=\(.[$k])")' <<<"$secret" > app.env
# The environment name comes from the secret, else from its id: only ".../staging" is staging.
if ! jq -e 'has("APP_ENV") and .APP_ENV != ""' <<<"$secret" >/dev/null; then
  case "$SECRET_ID" in */staging) echo "APP_ENV=staging" ;; *) echo "APP_ENV=production" ;; esac >> app.env
fi
# ROUTER_DATABASE_URL (import undo, D24) is an operator credential: migrate.env only, never app.env. On RDS the
# master login is the member of app_router, so it is the same login as MIGRATION_DATABASE_URL.
jq -er '"MIGRATION_DATABASE_URL=" + .MIGRATION_DATABASE_URL, "ROUTER_DATABASE_URL=" + .MIGRATION_DATABASE_URL,
  "APP_API_PASSWORD=" + .APP_API_PASSWORD' \
  <<<"$secret" > migrate.env
echo "env refreshed"
