# PR body draft: 05 Actions and words from the domain

Closes #83

## What changed for a user

- **The buttons on a ticket are exactly the ones the server will accept.** One domain rule, `availableActions`,
  decides them for the ticket page, the desk card and the floor "My complaints" and "Sent" cancel. Order and
  copy are Bhavin's v3 order and copy. Where the screen differed from the server, the screen now follows the
  server:
  - An **open** ticket no longer offers "Add me as support" (the server refused it).
  - A **lead with no crew row** no longer sees "Leave" (the server refused it).
  - A **technician on a personal login who is neither lead nor primary** no longer sees "Close" on a working
    ticket (the server refused it).
  - **Plant head** no longer sees "Cancel" on their own open ticket, and an **operator named as reporter on a
    ticket raised from another login** no longer sees it (the server refused both).
  - A **shared floor login's operator** now sees "Cancel" on a ticket raised on that login by another person,
    while it is not started; a **work role** now sees "Cancel" on their own started ticket on My complaints
    and Sent (the server accepts both).
- Every label reads from per-namespace catalogues in `packages/shared/src/i18n` with a typed `MessageKey`, so
  an English literal in a label field fails `pnpm typecheck`. The board's "Other" is the key `board.other`.
  No existing word changed (a frozen copy of the old English catalogue is tested key by key, including the 31
  status labels).
- The Playwright suite now also runs a `gujarati` project (tenant language `gu`).

**Gujarati proof limit.** Until ticket 24 every Gujarati value is empty and falls back to English. The
Gujarati e2e project proves only that the tenant language is read from the seed and `/config` and that nothing
regresses with `gu` active. It does not prove that a Gujarati string renders.

## Tests (each fails first, except the marked regression guards)

- `packages/domain/test/actions.test.ts`: T1 (never shows what the server refuses, hides only the ruled rows,
  across 7 roles, 9 ticket states, 3 kinds, machine running or not, 6 relations to the ticket, shared or
  personal, same login or other), T2 to T6.
- `apps/web/src/components/actionSpecs.test.ts`: labels, order, Pick up, quick action, `actorFrom`, `crewFrom`,
  the ported join, leave and cancel cases, W4 (English literal rejected as a label).
- `apps/web/src/screens/board/data.test.ts`: the catch-all section and group are `other`, not an English word.
- `packages/shared/test/catalogue.test.ts`: file size, no duplicate key, no word changed, `gu` key-identical.
- `apps/web/src/i18n/message-key.test.ts` (regression guard: passes today) and `tools/workspace.test.ts` X1.
- `apps/web/e2e/actions.spec.ts` E1 (8 logins by 6 tickets), E2 and E3 (regression guards: pass today),
  `apps/web/e2e/i18n.spec.ts` E4.

## How to try the preview

Sign in as a technician (`asha`) and open a working ticket you started: Update, Pause, Transfer, Machine running,
Close, Cancel, and no Leave. Sign in as a second technician and open it: Add me as support; after joining, Leave
and no Close. Open a ticket nobody has started: Start and Cancel, no Add me as support. As an operator, raise a
ticket on the floor and cancel it from My complaints.

## Test changes and ports (nothing deleted or weakened)

- `apps/web/src/components/actions.test.ts` is removed because `actions.ts` is split; every case moved:
  - `buildCorrectChanges` x 4 moved verbatim to `correctChanges.test.ts`.
  - `offers join to a technician who is not on the crew`: the join half runs on a working ticket; the open half
    now expects **no join** (Q1, ruled: the server refuses it) and still expects `start`.
  - `offers leave to an active crew member instead of join`: kept on an open and on a working ticket.
  - `treats the lead as being on the crew`: join stays hidden (Q3); **Leave is now hidden** (Q2, ruled: the
    server refuses it; it was expected before).
  - `offers join/leave on working and waiting tickets too`, `offers cancel from working`, `keeps cancel on open
and waiting`: kept.
  - `omits join/leave without an acting person or outside the live statuses`: kept, now `[]` without a person.
  - `canCancelOwn` x 4 became actor-based cancel tests: same-login operator cancel (W7), started and closed
    refused, the named reporter on another login refused (Q13, was allowed), no acting person refused,
    technician cancel on an own started ticket (Q16, was refused), shared-login operator cancel (Q12, was
    refused), cancelled ticket refused (Q14).
- `packages/domain/test/registry.test.ts` D2 pins the domain's public exports; `ACTION_ORDER` and
  `availableActions` are added to that list (a new export, nothing removed).
- `apps/web/src/i18n/i18n.test.ts`: the key-identity test moved to `catalogue.test.ts` (I4, now also checks every
  value is empty); the fallback test stays.
- `apps/web/src/screens/desk/views.test.ts`: the ticket fixture gained `raisedLoginId` (no assertion changed).

## Follow-up: server accepts what the Spec forbids (or the web hides what the server accepts)

Ruled: these stay as today on the screen. The server rule should change in a later ticket, or the product
should decide that the server's behaviour stands. The domain test T1 lists them as `HIDDEN` rows.

| Q   | Situation                                                                    | Server today | Spec                               | Screen (kept)                  |
| --- | ---------------------------------------------------------------------------- | ------------ | ---------------------------------- | ------------------------------ |
| Q3  | Lead without a crew row, "Add me as support"                                 | accepts      | not already on the ticket          | hidden                         |
| Q4  | Open handed-over ticket, person still on crew, "Leave"                       | accepts      | leave only from working or waiting | shown                          |
| Q5  | Closed or cancelled ticket, person still on crew, "Leave"                    | accepts      | not allowed                        | hidden                         |
| Q7  | Open ticket not handed over, "Update"                                        | accepts      | open only when handed over         | hidden                         |
| Q8  | Open stopped ticket, "Machine running"                                       | accepts      | working or waiting only            | hidden                         |
| Q9  | Closed or cancelled stopped ticket, "Machine running"                        | accepts      | not allowed                        | hidden                         |
| Q10 | Open, closed or cancelled ticket whose machine is running, "Machine stopped" | accepts      | working or waiting only            | hidden                         |
| Q14 | Own unstarted ticket already cancelled, "Cancel"                             | accepts      | cancel from open, working, waiting | hidden                         |
| Q18 | Operator opens the page of their own unstarted ticket, "Cancel"              | accepts      | own, not yet started               | whole bar hidden for operators |

Also out of scope (Q17): Restore, Correct, late Fill report and Upgrade to stopped are unchanged.

Other follow-ups: make the server call `availableActions` (until then T1 must follow any server rule change);
real Gujarati strings (ticket 24); ticket 06 deletes the tags code, so whichever of 05 and 06 merges second
deletes `tags.en.ts`, `tags.gu.ts`, their entries in `index.ts`, and the `TagsPanel` line in `TicketDetail.tsx`.

🤖 Generated with [Claude Code](https://claude.ai/code)

https://claude.ai/code/session_01KEBF27LbjC9M4GVChQu9gA
