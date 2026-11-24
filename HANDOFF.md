# HANDOFF

> **24 Nov 10:15 — ADR 0023 Insight first (Nimish):** screens feel flat. Redraw S20–S26 under UX rules 60–67 before asking for approval; run **M2b Insight pass** (one ticket per live v2 screen) before the rest of M2. Reviewer fails any screen without takeaway + marked outlier + yardstick.

> **Read ADR 0012 first.** Nimish is away; the loop runs unattended. Plan decides (ADR each) except answer-key changes, production, money, irreversible data steps.

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-24 · **By:** Plan · **Model:** claude-opus-5-5
**Milestone:** M2b Insight pass (planning) · M3 G3.2 pulled forward (ADR 0024) · **Branch:** plan/handoff-m3-606

## State

- Merged: **#603** CMP-5 Compare live, v1 MachinesPage deleted (588 closed; Compare done in M2) · **#608** ADR 0024 (figures never computed in a read; tickets 606, 607 seeded) · **#605** wireframes S27–S30 (Floor, Desk, Ticket, Board; drafts, questions for Nimish in the PR body).
- **606** (M3-1 served-warm) → PR **#610**, CI RED: `api (2/5)`, `api (3/5)`, `static`, `pr-meta`. pr-meta = auto body; full body drafted at `/tmp/body606.md` (Plan-base `b06f1af6…`). api/static tails not read yet. Attempts used: 1.
- **607** (M3-2 load script) blocked by 606; seed `plan/t607` (merge main into it first).
- Helpers were still running at session end — look for their PRs: **M2b kit** (`plan/m2b-insight-kit`: PROJECT.md M2b milestone, kit `Takeaway` + expand row, `insight-coverage.test.ts`, then issues + seeds for Dashboard / Action Center / Breakdown Log) and **S20–S26 redraw** (`plan/wireframes-s20-s26-insight`). Check CI; merge if green and sane.

## Next step

1. `gh pr edit 610 --body-file /tmp/body606.md` (rebuild from #603's body shape if /tmp is gone) → read the api/static failures with `loop ci 610` → Don't + rebuild, or fix the seed → review → merge.
2. Merge the M2b kit PR, build the M2b tickets (ADR 0023: before the rest of M2), then 607.

## Blocked / open questions

- **Nimish:** approve S27–S30 (PR #605) and the redrawn S20–S26. M3 G3.1 needs his workbooks (N14, N17); §6 answer-key last digit and `support` downtime.
- Follow-ups (not ticketed): Compare has no unit test that a pick keeps `screen=compare` and replaces history; a hand-typed refused pair shows the last good pair under the refused URL.

## Don't repeat

- `loop finish` writes a body that fails pr-meta: write Q1–Q16 + Reasons (`No parity:`, `Tests removed:`, `Large PR:`) to `/tmp/body<PR>.md`, `gh pr edit`, then push an empty commit from a `git worktree add --detach /tmp/e<PR>` (commit/push in a separate Bash call: the main-branch hook blocks commits from the repo root).
- A screen PR must change `scope/<screen>.md` in its own diff (Q16); if main already has it, Plan adds a dated line on the seed.
- After main moves: merge main into the seed, the seed into the PR branch, set Plan-base to the new seed sha; else loop-guard flags HANDOFF.md/ADRs as builder changes.
- Check `ls docs/adr` on origin/main before numbering an ADR (0023 collided this session).
- **Never force-push.** "ticket N" in comments, never `#N`.
