#!/usr/bin/env bash
# The fast tests the stop hook runs before an agent may finish (Athena v3). The repository owns this file:
# the installer writes it once and never overwrites it. Keep it under a few minutes.
#
# Database-free suites only (pure domain rules, shared contracts, web logic, repo tools): about 2 seconds.
# The database tier (Testcontainers Postgres) and the browser E2E need Docker and run in CI on every PR.
set -euo pipefail
cd "$(dirname "$0")/../.."
pnpm exec vitest run packages/domain packages/shared apps/web/src tools
