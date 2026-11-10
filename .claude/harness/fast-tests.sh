#!/usr/bin/env bash
# The fast tests the stop hook runs before an agent may finish (Athena v3). The repository owns this file:
# the installer writes it once and never overwrites it. Keep it under a few minutes.
set -euo pipefail
cd "$(dirname "$0")/../.."
echo "No fast tests configured yet: edit .claude/harness/fast-tests.sh" >&2
