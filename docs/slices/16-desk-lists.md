# 16 — Desk lists and ticket detail

Issue [#91](https://github.com/nimishshah1989/argus/issues/91) · Blocked by 05, 12, 13, 14 (merged) · Branch `claude/t16-desk-lists`.
One PR, `Closes #91`. No table, no migration, no new dependency. Layout rule: v3's screen order, button positions and copy stay;
the kit changes the look only (accent token, never a colour).

## 1. Order of work

1. **Goal 3 first: the minutes.** `figures()` follows `worker.js` (DOMAIN §5 rewritten). Failing test first:
   `apps/server/test/figures-worker-parity.test.ts` runs `figures()` on every ticket of the pseudonymised export and compares each
   figure with `real-oracle`. Rules that change: rounding (`round`, not `floor`), repair = wall clock, hands-on = lead's finished
   segments, `down_acc` = finished stopped stretches, support downtime 0, general downtime = hands-on, no one-minute floor, open
   stretches excluded until they end. The existing tests whose expectation encoded the old rule change value only
   (each listed in the PR with the rule behind it); none is deleted, skipped or loosened.
2. **Open** (`v3.views.01`): counts strip Down / Waiting / Support / Running OK (tap filters), Team now strip, segmented
   Breakdowns / Tasks / Work with counts, v3's sort rules, "Closed without a report". Built on `defineResource` + the kit
   components; offline and error states from `viewState`.
3. **Mine, Team, needs-report** (`v3.views.04, 05`) keep their behaviour, read through the same resource, and the closed
   lists page by cursor past 200 rows ("Show more").
4. **Ticket card and detail** (`v3.views.02, 03`): facts, full history, people and minutes, action bar from `availableActions`;
   an imported ticket shows Bhavin's stored minutes, never a recompute.

## 2. Decisions (cost if wrong)

- Cancel and restore keep our rule (the cancelled gap counts in nothing); his app counts it. One ticket in the export (BD-0077)
  differs. Asked of Nimish; cost if wrong: one rule in `figures.ts`.
- Open `repairMin` is 0 until the close (his is null), because the reply contract carries a non-null number.
- Strings live in their own catalogue namespace (`deskLists.*`) so ticket 15 (floor) does not collide.
