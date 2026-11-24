# HANDOFF

> **24 Nov 19:30 — main fix:** #633 and #637 each added `classifyLegacy` to tools/import-legacy.ts; merged together main failed typecheck. Duplicate import removed. Auto-merger merges green PRs that each pass alone; watch for this.

> **24 Nov 19:15 — ADR 0035 (Nimish yes):** a screen PR may write its own coverage table; loop-guard exempts `docs/design/v2/scope/<screen>.md`.

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-24 · **By:** Plan · **Model:** Opus 5.5
**Milestone:** M2b screens lane · **Branch:** plan/screens-batch2-tickets

## State

- Screens batch 2 seeded (ADR 0035 + addendum). #653 (kit yardstick words) and #677 (S22 model/skeleton) merged.
- Insight tickets, all independent, seeds `plan/t<N>` pushed, red only on missing takeaways/yardsticks, tsc 0 errors: #654 #655 #656 #657 #658 #660 #661 #662 #663 #664 #665 #666 #667 #668 #669 #670 #671 #672 #673 #674 #675 #676.
- S22 Money Matters: #644 adapter and #678 View build in parallel; #679 go-live after both.
- Every seed (batch 1 and 2) merges cleanly with main; no two batch-2 tickets list the same file.

## Next step

Coordinator: `loop build` each batch-2 ticket (any order, in parallel), plus #644 and #678; #679 last. Close superseded #613 #614 #615.

## Blocked / open questions

- Nimish: written yes for S22's unbuilt "vs the 320 days before" yardstick (needed before #679 merges).
- Nimish: yes/no on #651 (ADR 0032 §1); answer key's shift 3 vs the 2-shift decision.
- Plan, after the batch merges: sweep finished screens from `NOT_YET` into `SECTIONS`; decide "—"/date tiles (ADR 0035 addendum §3); shared chart-takeaway slot in `PageBody` (§1).
- Unverified: #679's rewritten e2e specs (`openMoney`, shell spec) were not run.

## Don't repeat

- Batch tickets must not edit `insight-coverage.test.ts` or shared catalogues (ADR 0035).
- The main checkout is shared with other sessions: commit from a temp worktree.
- A PR body edit doesn't rerun pr-meta: push a commit after editing. Body must follow the PR template.
