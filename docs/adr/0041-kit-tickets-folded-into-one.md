# ADR 0041: The remaining ADR 0036 kit tickets are one ticket, one PR

Date: 25 Nov 2026 · Decided by: Nimish ("yes", 25 Nov 2026)

## Decision

#687, #688, #689, #692, #695, #696, #700, #704, #705 and #732 are built as **one** ticket on one seed branch, giving one PR. Screens adopt the kit in parallel batches; another session owns `apps/web/src/screens/v2/**`. The combined ticket therefore stays inside `apps/web/src/ui/**`, its tests, `packages/shared/src/xlsx.ts` (#732), `changes/` and `docs/`. Already merged: #686, #690, #691, #693, #694, #697, #698, #699. #685 (PR #739) and #701 (PR #731) belong to another session and are not folded in.

- **Seed:** `plan/kit-combined`, to be renamed `plan/t<N>` once the issue exists. It merges `plan/t687`, `t688`, `t689`, `t692`, `t695`, `t696`, `t700` and `t704`. Conflicts were only `HANDOFF.md` and the `ranked-bars.tsx` skeleton; main's version was kept for both, because #694 is already merged. The seed then adds skeletons and tests for #705 and #732.
- **Budget:** the sum of the folded budgets: `files<=26 lines<=1070`. #732 had no budget and is set to files 2, lines 80.
- **Screens:** `none (kit only)`, per ADR 0040.

## Changes to the folded tickets (unattended assumptions)

1. **#687 rule 1 wins over the compare holdout.** In `screens/v2/compare/holdout/tables-edges.test.ts`, the case "uses the words it is handed" asks for the search word once per table (6 or more). Under ADR 0036 R13 a table with fewer than 10 rows has no search box, so this test failed PR #726. Its first assertion (the count is at least `items.length`) is dropped. The second one stays: the word is never drawn when it was not handed in.
2. **#689 moves into the kit.** `printedTable` lives in `screens/v2/printed-page/`, which another session owns. Instead, `splitTotal(rows)` in `ui/v2/domain/printed-table.tsx` takes out the total rows, and `PrintedDataTable` draws the last one as the footer. The takeaway is computed over the remaining rows only. The `PrintedTable.total` field is dropped. Tests are in `ui/v2/domain/total-footer.test.ts` and `ui/v2/domain/holdout/total-footer-edges.test.ts`.
3. **#705:** The kit cannot know each entity's route, so each drawer takes an optional `full?: { href, label }` prop. The link is drawn once, just above the source line, and screens pass it during adoption. Drawers today show at most 2 figures, so `DetailFigures` (cap 3, empty values dropped first) is ready for when they need more.
4. **#732:** No React Testing Library and no DOM are installed, and we add no dependencies. The button test therefore renders static markup for the label, and the download is checked through an exported `saveWorkbook(file, sheets, docRef)`, with `document` and `URL` stubbed. Banned sheet-name characters become `-`. An empty workbook gets one empty `Sheet1`.

## Still to do when this lands (plan PR)

- Remove `domain/cell-detail.tsx`, `machine-detail.tsx`, `person-detail.tsx`, `decision-detail.tsx` and `detail-parts.tsx` from `.loop.json` `protected`, which extends the ADR 0039 carve-out to #705.
- Add `packages/shared/src/xlsx.ts` to `KIT_ONLY` in `.github/loop/check_pr.py`, so that `Screens: none` still passes.
- Make the compare holdout edit from point 1.
