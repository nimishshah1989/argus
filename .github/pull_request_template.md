## What changed and why

<!-- One or two sentences; link the slice or issue. -->

## Verification

- [ ] `pnpm precheck` green before the push
- [ ] `pnpm verify` green
- [ ] `pnpm test:e2e` green when a screen or server route changed
- [ ] `docs/spec/parity.yaml` updated for every `apps/` or `packages/` change (or the `no-parity`
      label, or a `No parity: <reason>` line below)
- [ ] `docs/HANDOFF.md` updated when a shipped slice changes what the product does
- [ ] New migration file (never edit a merged one); `tenant_id` + RLS in the same file
- [ ] PR under 800 changed lines (or the `size:large` label, or a `Large PR: <reason>` line below)

## Reasons

<!-- Over 800 lines, or apps/ or packages/ without the parity ledger? Add a line below, for example:
Large PR: ports the whole gallery suite
No parity: test-only change to the harness
(at least 10 characters; the examples stay inside this comment so they never count). -->
