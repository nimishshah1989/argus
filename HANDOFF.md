# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-25 · **By:** Plan · **Model:** Opus 5.5
**Milestone:** M2b screens lane · **Branch:** plan/v2-floor-desk (stopped at context budget)

## State

- Plan PR #764 (this branch). Nimish's S27-S30 approvals (25 Nov) are NOT in it: the loop guard blocks Plan from staging the approvals file; it is still uncommitted in the main checkout.
- Coverage tables written from the v1 code + e2e specs: `docs/design/v2/scope/{floor,desk,ticket,board}.md` (0 MISSING rows that drop v1 scope; each lists "Unbuilt from the wireframe" items needing Nimish's written yes, and "Selectors the e2e specs rely on").
- ADR 0045 decides the split: 6 tickets (S27-A, S27-B, S28-A, S28-B, S29, S30), files, kept logic, which v1 tests the seeds retarget, and that locked control-order specs (`e2e/gallery/floor-order-lists.ts`, `desk-order.spec.ts`, `board-settings-order.spec.ts`) win over the wireframe.
- **No issues and no seed branches created yet.**

## Next

1. `loop ci 764`, merge when green. Get the approvals committed by an allowed route (Nimish runs `loop approve`).
2. New Plan session: create the 6 issues from ADR 0045 "Tickets" (loop-ticket format; builder notes: dontAsk, no heredocs/redirects/subshells/brace lists; handoff `## Blocked` reads exactly `None.`), then seed `plan/t<N>` each: skeleton `model.ts`/`View.tsx`, visible `view.test.ts` + `insight.test.ts`, hidden `screens/v2/holdout/<screen>-*.test.ts`, and the test retargets ADR 0045 names (T3: `TasksList.test.ts`; T4: `team-waiting.test.ts`, `fetch-guard.test.ts:17`). Prove red, lint, push.
3. Coordinator: ask Nimish for written yes/no on each scope file's "Unbuilt from the wireframe" rows.

## Blocked

None.

## Don't repeat

- Builders cannot modify or delete existing tests (`.github/loop/check_pr.py`): every e2e/unit test edit goes on the seed.
- v1 floor has no offline send queue and no lockout (ADR 0045 §6); the server already serves `GET /api/v1/tickets/:id/pdf`.
- The inventory seed notes were in this session's scratchpad only; the facts needed are in ADR 0045 and the scope files.
