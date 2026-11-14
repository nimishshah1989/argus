# D26: a high-severity advisory in a production dependency fails CI

Date: 14 November 2026 · Status: accepted (ticket 26 goal 1, "M1 server leftovers")

## Decision

- The `static` job runs `pnpm audit:deps` (`pnpm audit --audit-level high --prod`). A high or critical advisory in a
  production dependency fails the build. Dev-only advisories do not. It adds no dependency; `pnpm verify` runs it too.
- **Proof, 14 November 2026:** on main as it stood, the command exited 1 on a real advisory (below). With the exception
  below it exits 0. Removing the exception from `package.json` makes it fail again.
- The check asks the npm registry, so a registry outage fails the job. A rerun is the answer; do not skip the step.

## The one exception, and when it ends

`GHSA-mrhx-c7xc-m3w5`: zod can exhaust memory while validating oversized constrained collections. Affected versions are
`<4.6.6`, which includes the 3.25.76 we run; there is no patched 3.x release. It is listed in `package.json`
(`pnpm.auditConfig.ignoreGhsas`) and is the only entry.

- **Why it is acceptable for now:** a request body is capped by Fastify's body limit (1 MiB by default; the logo route sets its
  own for a file), so a validated array cannot be arbitrarily large. A caller must also be signed in for every route
  except sign-in, whose body is three short strings.
- **What ends it:** moving `packages/shared` and `apps/server` to zod 4 (>= 4.6.6). That is a major version with schema
  changes across the shared contracts, so it is its own ticket, not a side effect of this one. Remove the entry when it lands.
- **Cost if wrong:** a signed-in caller who finds a route that validates a large constrained collection could make the API
  process use a lot of memory until it is restarted.

## Rejected

- **Failing on the zod advisory today:** every PR would be red until a zod 4 migration, and the check would be switched off
  to get work done, which is worse than a named, dated exception.
- **`--audit-level moderate`:** it would add noise from advisories with no reachable path; high is the bar the plan set.
- **A third-party scanner:** a new dependency for what `pnpm audit` already does.
