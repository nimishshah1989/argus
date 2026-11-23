# HANDOFF

> **Read ADR 0012 first.** Nimish is away; the loop runs unattended. Plan decides §6 (ADR each) except answer-key changes, production, money, irreversible data steps. **ADR 0015:** M1 closed without G1.2a and Shift KPIs/Energy G1.4.

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-24 · **By:** Plan · **Model:** claude-opus-5-5
**Milestone:** M2 Finish the analytics redesign (building) · **Branch:** plan/handoff-m2-dc1-tf1

## State

- **#572 DC-1** → PR **#574**: seed `plan/t572` now has the ADR 0017 "unregistered machine" rule + visible test; rebuilt fresh (attempt 3 of 3). `loop finish 572` was running when the session ended: `loop ci 574`. Body = full template, Plan-base `6ef2bbee`. Green → reviewer → merge. Red or FAIL → `loop build 572 --rescue`.
- **#573 TF-1** → PR **#575**: api fixed (seed route count 152→154, merged into the PR branch from `/tmp`), Plan-base `a82a7a6f`. Last run: only **pr-meta red**, in the `pnpm quality:pr` step (parity passes now). Read that step's message, fix the body, push an empty commit, then reviewer.

## Next step

1. Finish #574 and #575 (above).
2. **DC-2:** route `/analytics/today/checklist` (`App.tsx:57`, `Analytics.tsx:17-25`) to a `ModelPage` (`live.tsx:102`, example :309-321; add `data-checklist` to `ModelKey`, `live-frame.tsx:144`); provider like `manpower/register.ts:12-18`; delete v1 `DataChecklist.tsx`, `checklist-view.ts` (+test), fix importers (`today-tabs.test.ts:7`, `shell-data.ts:43`, `e2e/analytics.spec.ts`). Drill: engine `drillIds` for `bd_*`/`ww` (`data-checklist.ts:226`) via `drillFor` (`rows-behind/drill.ts:11`); the model has no drill field yet. Copy #537's file list. batch1 MISSING rows `:103-130`.
3. **TF-2:** model has no note field; status words differ (web `todo/doing`, server `open/prog`); mutation pattern `why-why/record.ts:57-69`; v1 `TeamFocusPage.tsx` (importers `TodayRest.tsx`, `today-tabs.test.ts`); keep `team-focus-actions.ts`; `live.test.ts:41,81-82` asserts not routed.
4. Compare CMP-1..4.

## Blocked / open questions

- **G1.2a needs Nimish:** duplicate ticket column pinned by the frozen answer key (`workbook-export.json`).
- **Shift KPIs + Energy, Money Matters, Reports, Guide:** new wireframes need Nimish's sign-off.
- Compare "Spares cost ₹ 0" placeholder: product call. Nimish (old): branch protection; answer-key last digit; support tickets 0 downtime.

## Don't repeat

- Seed changed after a build: never git in `.loop/wt/<N>` (hook blocks you and the builder). Use `loop prep <N> --fresh` (then set `attempts` in `.git/loop/tickets/<N>.json` to the true count), or merge the seed into the PR branch from a `/tmp` worktree and set the body's `Plan-base` to the seed tip.
- `loop finish` overwrites the PR body after pushing: set the full body before it, restore it after.
- A seed that adds server routes must bump `reply-contract.test.ts`'s count.
- Ticket PR bodies: full template (copy #574), "No parity:", "Large PR:" if >800 lines; after `gh pr edit`, push an empty commit.
- Ticket PR red on loop-guard with main's files listed → `Plan-base` is stale. Never `gh pr update-branch`.
