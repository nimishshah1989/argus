# 73 — the plan tells the truth, and reaches to v1

- `docs/plan/MILESTONES.md` is still the one tracker and now opens with the road to v1: nine numbers that define
  v1, the stages with their gates and sizes, and 26 new tickets (73–98) whose every goal carries a number.
- The tracker matches `main` again: 18 rows were stale. M4b's 46, 47, 48, 49, 51, 52 and 67 are done; 50c, 53 and
  54 are open; M1's 16 and 19–25 were built and are marked so.
- Two decisions record Nimish's rulings of 19 Nov: D33 (colour may carry meaning; the floor and desk keep Bhavin's
  positions; analytics is redesigned freely) and D34 (validation runs on the whole database, history included).
- The history plan gains what Bhavin's 2023 workbooks show: utility rows written once per machine, real rows the
  year rule would drop, the workbooks' own code legend, and a hole in early 2022.
- Nothing a user sees changes in this change.
- `pnpm docs:check` now fails when a merged `feat` or `fix` commit names a ticket whose tracker row still says `todo`, so the tracker cannot fall behind `main` again.
