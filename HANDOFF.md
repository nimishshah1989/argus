# HANDOFF

> **24 Nov — ADR 0024:** M3 G3.2 (figures never computed in a read) pulled forward while wireframes wait; tickets 606 (serve kept + warm job) and 607 (load script, blocked by 606) seeded.

> **24 Nov 10:15 — ADR 0023 Insight first (Nimish):** screens feel flat — plain monochrome number tables. Do NOT ask Nimish to approve S20–S26 as drawn: **redraw them under UX rules 60–67** and put them back for approval. After Compare goes live, run **M2b Insight pass** (one ticket per live v2 screen) before the rest of M2. Reviewer fails any screen without takeaway + marked outlier + yardstick.

> **24 Nov — M2b kit (ADR 0023):** PROJECT.md has M2b; `ui/v2/takeaway.tsx` (Takeaway, ExpandRow), `screens/v2/insight.ts` and `insight-coverage.test.ts` (NOT_YET shrinks per ticket; `model.takeaways` keyed by section id). First tickets: Dashboard, Action Center, Breakdown Log.

> **24 Nov — ADR 0016 (Nimish: yes to all):** Breakdown Log Excel keeps both ticket columns, screen + CSV show one (G1.2a unblocked); draft Shift KPIs + Energy wireframes for his approval; answer key stays frozen; budget 150k; helpers = `helper` (Sonnet), never general-purpose.

> **Read ADR 0012 first.** Nimish is away; the loop runs unattended. Plan decides §6 (ADR each) except answer-key changes, production, money, irreversible data steps.

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-24 · **By:** Plan · **Model:** claude-opus-5-5
**Milestone:** M2 Finish the analytics redesign (building) · **Branch:** plan/handoff-m2-cmp5

## State

- Merged this session: **#598** TF-4 (ticket 594, Team Focus "I'll take it" edges) · **#600** CMP-2 `GET /analytics/compare` (585) · **#601** CMP-4 live Compare adapter (587; review 1 FAIL fixed: MTTR/MTBF dash only on the zero-breakdown side).
- **CMP-5 ticket 588** (Compare goes live, v1 MachinesPage deleted): built; attempts used 2 of 3, both Plan's fault (outdated `data.test.ts`, fixed on seed `3cd3e5fb`) + unformatted handoff. Attempt 3 build ran (`loop build 588` done) — **next: `loop finish 588`**, not yet run. Seed already drops v1 Compare assertions from `live.test.ts` and `e2e/analytics-compare.spec.ts` → PR body needs a `Tests removed:` line.
- Reviewer follow-ups (non-blocking, not ticketed): 585 — unknown query key answers 422 with field `asOf`; no visible 403 test. 587 — no assert that both sides' marks are `same` when one count is 0. 594 — `assignHandlers` test checks only that handlers exist, not the saved owner.

## Next step

1. `loop finish 588` → write the PR body from `/tmp/body601.md`'s shape (Q1–Q16, Coverage, `No parity:`/`Large PR:`/`Tests removed:` lines, Plan-base = `3cd3e5fb…`) → review → merge → tick Compare in PROJECT.md M2.
2. Then the next M2 tickets (`loop status`, open issues labelled M2). S20–S26 still wait for Nimish.

## Blocked / open questions

- **Nimish:** approve wireframes S20–S26 (PR #596 lists his questions). ADR 0019 extra drill on Data Checklist; Compare spares ₹0 frozen; ADR 0020 §5–6 "later" Team Focus items.

## Don't repeat

- `loop finish` overwrites the PR body each run and its body always fails pr-meta: write the full quality body (Q1–Q16, What changed / How to try / What must be decided, Coverage, Reasons) to `/tmp/body<PR>.md`, `gh pr edit --body-file`, then an empty commit from a `/tmp/e<PR>` worktree pushed to the PR branch. PR size counts the seed: add `Large PR:` when >800. A seed that changes an assertion needs `Tests removed: <reason>`.
- Plan-base in the body must be the **current** seed sha, or loop-guard counts seed files as builder changes.
- Orchestrator can't touch `.loop/wt/<N>` except exactly `cd .loop/wt/<N> && git fetch -q origin plan/t<N> && git merge -q --no-edit origin/plan/t<N>` (its own call). Don't rerun `loop finish` just to read errors: it burns an attempt; read `.git/loop/tickets/<N>.json` notes.
- Format files in `/tmp` seed worktrees with `/Users/nimishshah/argus/node_modules/.bin/prettier` run from inside the worktree (repo-root prettier ignores /tmp paths).
- `e2e/who-is-acting.spec.ts:41` flaked once on PR 601 (passed on rerun of the failed job).
- After every merge to main, refresh each open seed (`git -C /tmp/t<N> merge origin/main`, push). **Never force-push.** "ticket N" in comments, never `#N`.
