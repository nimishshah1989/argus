# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-26 ~14:55 IST · **By:** build session `d2fcfc9d…` (context full) · **Goal (Nimish, ADR 0055):** all screens live on the newest kit, nothing old remains · **Branch:** plan/handoff-s27

## State

- Merged this session (main ≥ 089ff752): #829 (#828 Board fix), #826 (#789 Settings machines), #830 (#816 /who), #831 (#812 OEM figure), #833 (#818 v1 analytics pages gone), #834 (#791 Settings people/logins), #835 (#813 OEM cause save), #836 + #837 (#817 /password, with error fix), #838 (#832 /who error fix), #839 (#792 Settings audit). Confirm staging `/api/v1/health` serves main.
- Nimish merges green PRs himself, often before review (#826 #830 #833 #834 #836 #837 #839). #839 got no review yet: run a post-merge critical review.
- **#840 (#814 OEM screen) open, head cdb83574, 3 red:** old e2e tests still expect v1 OEM: `e2e/gallery/v2-machines.spec.ts:100` expects "₹ 59,994 to claim"; `e2e/analytics-guide.spec.ts:10` expects `#guide-oem` "not in this build yet". Next: `loop plan` to update both on `plan/t814` (no rupees, ADR 0051; OEM now built), then merge the seed into the PR branch in a throwaway worktree, set PR body `Plan-base:` to the new seed head BEFORE pushing, review, merge.
- Not started: #815 (after #814), #793 then #794 (share Plant.tsx/registry.ts; after #839, now merged), then #819 last.
- Follow-ups for the planner: #826 coverage rows say "same" but per-segment machine count (Groups) and segment on each machine row were dropped; OEM figure returns null when young machines have no breakdowns; 29 Feb warranty date prints wrong.

## Next steps

1. Fix #840 seed as above → merge. 2. #815 and #793 in parallel (no shared files), then #794, then #819. 3. ADR 0055 items (Floor segment tiles; S28–S30 wireframes in the Shell for Nimish) via `loop plan`.

## Don't repeat (details in LESSONS.md)

- Builders: plain literal commands only (no `{a,b}`, loops, heredocs, `python3 -`, `cd &&`, `VAR=` prefix); `git rm`; one-line commits; `## Blocked` = exactly `None.`; prettier the handoff. Every ticket's Don't now says so; add it to new tickets.
- Never `#NNN` in comments of apps/web files (guard reads hex). New API route → `REPLY_SCHEMAS` + route count in `reply-contract.test.ts`.
- Seed fix on an open PR: planner pushes `plan/t<N>`; coordinator merges it into the PR branch in a scratch worktree, edits PR body `Plan-base:` first, then pushes (guard reads the body from the push event).
- Conflict in a test-data file: never `git checkout --theirs` blindly; check the other side equals main first.
- `loop finish` prints GREEN with checks pending: confirm with `gh pr checks`. Run local checks one ticket at a time.
- Rebuild after a seed fix: `git branch -f backup-t<N> <build branch>`, `loop prep <N> --fresh`, ticket Don't lists literal paths to `git checkout backup-t<N> -- …`.
