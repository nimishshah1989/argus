## What changed and why

<!-- One or two sentences; link the slice or issue. -->

## How to try it

<!-- The preview URL, or the command and path to open. -->

## What must be decided

<!-- Anything the reviewer or Nimish must rule on; write None when nothing. -->

## Quality attributes

<!-- One line per id from docs/QUALITY-ATTRIBUTES.md, appending pass, n/a — reason, or fail — finding N. -->

Q1 Behaviour tested
Q2 Test integrity
Q3 Tenancy sealed
Q4 Auth and permission
Q5 Data safety
Q6 Lean budgets
Q7 Design lock
Q8 Accessibility
Q9 Internationalisation
Q10 Determinism
Q11 Operability
Q12 Evidence and memory
Q13 No secrets or real data
Q14 Honest review

## Verification

- [ ] `pnpm precheck` green before the push
- [ ] `pnpm verify` green
- [ ] `pnpm test:e2e` green when a screen or server route changed
- [ ] `docs/spec/parity.yaml` updated for every `apps/` or `packages/` change (or the `no-parity`
      label, or a `No parity: <reason>` line below)
- [ ] `docs/HANDOFF.md` updated when a shipped slice changes what the product does
- [ ] New migration file (never edit a merged one); `tenant_id` + RLS in the same file
- [ ] Screen PRs: a side-by-side screenshot of the built screen at 360 px next to its mockup PNG (`docs/design/mockups/slice-1/`), and a list of deliberate differences under Reasons
- [ ] PR under 800 changed lines (or the `size:large` label, or a `Large PR: <reason>` line below)

## Reasons

<!-- Over 800 lines, or apps/ or packages/ without the parity ledger? Add a line below, for example:
Large PR: ports the whole gallery suite
No parity: test-only change to the harness
(at least 10 characters; the examples stay inside this comment so they never count). -->
