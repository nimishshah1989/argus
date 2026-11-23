# Lessons

_One line per failure, newest first. Written by the orchestrator whenever review fails, a ticket escalates, or Nimish corrects something. Reviewed monthly: a layer that keeps appearing is where to invest next._

| Date       | What went wrong                                                                                                                    | Layer   | Durable fix (file/rule/test added)                               |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------- |
| 2026-11-23 | Typecheck and 6 tests fail on a Mac: `Bubble.tsx`/`bubble.ts` and `Live.tsx`/`live.ts` differ only by case; Linux CI never sees it | toolbox | Planned: PROJECT.md M1 G1.1 (a guard test for case-only clashes) |
