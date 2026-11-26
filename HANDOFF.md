# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-26 ~17:30 IST · **By:** planner (ADR 0055 point 2: S28–S30 in the Shell) · **Goal (Nimish, ADR 0055):** all screens live on the newest kit, nothing old remains · **Branch:** plan/s28-s30-shell-wireframes

## State

- Merged this session (main ≥ 089ff752): #829 (#828 Board fix), #826 (#789 Settings machines), #830 (#816 /who), #831 (#812 OEM figure), #833 (#818 v1 analytics pages gone), #834 (#791 Settings people/logins), #835 (#813 OEM cause save), #836 + #837 (#817 /password, with error fix), #838 (#832 /who error fix), #839 (#792 Settings audit). Confirm staging `/api/v1/health` serves main.
- Nimish merges green PRs himself, often before review (#826 #830 #833 #834 #836 #837 #839). #839 got no review yet: run a post-merge critical review.
- #840 (#814 OEM screen) merged as ab9788c2; #843 (#793) merged. Review follow-ups done: `plan/t815` rebased on main (head 858637e6) with 3 more red tests (Cause column for every reader, `v2m.oem.empty`, no "suggest" words), and ticket #815 updated (budget files<=8 lines<=240). The owner range test now allows 812 only as the named `oem-analytics` exception. COVERAGE.md has an S18 section.
- **Nimish's written yes needed:** S18 shows no rupees (lost output, amount to claim): ADR 0051 A5 is Assumed. Until he says yes, that row stays DROPPED in COVERAGE.md.
- Not started: #815 (ready: `loop prep 815`), #794 (share Plant.tsx/registry.ts; after #839, now merged), then #819 last.
- Follow-ups for the planner: #826 coverage rows say "same" but per-segment machine count (Groups) and segment on each machine row were dropped; OEM figure returns null when young machines have no breakdowns; 29 Feb warranty date prints wrong.

## Next steps

1. Build #815 from the new seed. 2. #794, then #819. Ask Nimish for his yes on S18 rupees. 3. Nimish: `loop approve S28-desk`, `S29-ticket`, `S30-board` (redrawn in the v2 Shell, ADR 0056; old approvals void; every approved and #803 item is in each Coverage table). Then `loop plan` the build tickets (Shell move + #803). Floor segment tiles (ADR 0055 point 1) still to plan.

## Don't repeat (details in LESSONS.md)

- Builders: plain literal commands only (no `{a,b}`, loops, heredocs, `python3 -`, `cd &&`, `VAR=` prefix); `git rm`; one-line commits; `## Blocked` = exactly `None.`; prettier the handoff. Every ticket's Don't now says so; add it to new tickets.
- Never `#NNN` in comments of apps/web files (guard reads hex). New API route → `REPLY_SCHEMAS` + route count in `reply-contract.test.ts`.
- Seed fix on an open PR: planner pushes `plan/t<N>`; coordinator merges it into the PR branch in a scratch worktree, edits PR body `Plan-base:` first, then pushes (guard reads the body from the push event).
- Conflict in a test-data file: never `git checkout --theirs` blindly; check the other side equals main first.
- `loop finish` prints GREEN with checks pending: confirm with `gh pr checks`. Run local checks one ticket at a time.
- Rebuild after a seed fix: `git branch -f backup-t<N> <build branch>`, `loop prep <N> --fresh`, ticket Don't lists literal paths to `git checkout backup-t<N> -- …`.
