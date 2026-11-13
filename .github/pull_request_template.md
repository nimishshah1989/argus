## What changed and why

<!-- One or two sentences; link the slice or issue. -->

## Verification

- [ ] `pnpm verify` green
- [ ] `pnpm test:e2e` green when a screen or server route changed
- [ ] `docs/spec/parity.yaml` updated for every `apps/` or `packages/` change (or the `no-parity`
      label plus the reason below)
- [ ] `docs/HANDOFF.md` updated when a shipped slice changes what the product does
- [ ] New migration file (never edit a merged one); `tenant_id` + RLS in the same file
- [ ] PR under 800 changed lines, or the `size:large` label plus the reason below

## Label reasons

<!-- Fill in when using size:large or no-parity. -->
