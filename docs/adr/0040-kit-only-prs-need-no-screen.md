# ADR 0040: Kit-only PRs say `Screens: none`

Date: 25 Nov 2026 · Decided by: coordinator request (unattended planner session); reverses nothing Nimish decided

## Decision

`loop-guard` (`.github/loop/check_pr.py`, rule 4) accepts `Screens: none` or `Screens: none (kit only)` when **every** file the PR changes is under:

- `apps/web/src/ui/` (the kit, its visible tests and its `holdout/` tests),
- `changes/` (changelog fragments),
- `docs/loop/handoff/` (the ticket handoff).

If any changed file is outside those folders, `Screens: none` fails with the first such path, and the PR must list approved screen ids as before.

Unchanged: a listed screen id must be in `design/approved.json` with a matching wireframe hash; a missing `Screens:` line still does not block (ADR 0038); protected files, existing tests, raw styles and brand rules are untouched.

## Why

Kit tickets (#684–#704, ADR 0036/0039) change shared components that no screen renders yet, so no wireframe approval applies. The guard read `none (kit only)` as a screen id and failed it as unapproved, which blocked every kit PR (#736, #737, #738, #739). Builders then wrote a made-up screen id (e.g. `S01-dashboard` on #731) to pass, which makes the approval record lie.

## Assumption (unattended)

"Tests of those" means test files of the kit, which already live under `apps/web/src/ui/`. A test elsewhere (e.g. `apps/web/e2e/`) takes the PR out of `none`. Widen the list here if a kit ticket legitimately needs one.

## Proof

Run locally against the real branches: #736 and #738 pass with `Screens: none (kit only)` and with `Screens: none`; #736 plus one line in `apps/web/src/screens/v2/age/View.tsx` fails with "`Screens: none` but apps/web/src/screens/v2/age/View.tsx is outside the kit"; an unapproved id (`S99-fake`) still fails.
