# Lessons

_One line per failure, newest first. Written by the orchestrator whenever review fails, a ticket escalates, or Nimish corrects something. Reviewed monthly: a layer that keeps appearing is where to invest next._

| Date       | What went wrong                                                                                                                    | Layer   | Durable fix (file/rule/test added)                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------- |
| 2026-11-23 | Unattended run: builders denied `mv`/`git commit` ("don't ask" mode); #551 unbuildable, all local `loop finish` blocked behind it | process | Needs Nimish: a permission allowlist for builders' shell in `loop auto`, and `loop doctor` should check it |
| 2026-11-23 | #548 (plan PR) red: no `changes/<PR>-*.md` fragment and no Argus PR body (3 sections + Q1–Q16); the loop's own PR rules omit both  | process | Planned: M1 ticket to fold `changelog:check` + `quality:pr` into the loop's PR template, or drop them |
| 2026-11-23 | Typecheck and 6 tests fail on a Mac: `Bubble.tsx`/`bubble.ts` and `Live.tsx`/`live.ts` differ only by case; Linux CI never sees it | toolbox | Planned: PROJECT.md M1 G1.1 (a guard test for case-only clashes)                                      |
