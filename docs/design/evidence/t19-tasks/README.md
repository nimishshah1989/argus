# Ticket 19: follow-up task screens, 360 px, from the real seeded stack

No approved slice-4 PNG exists in this repo: LOCK.md records slice 4 as the canvas
https://claude.ai/artifact/7iLVAMkHLQ8ncGEg5ZWhXL (link kept in `docs/design/LOCK.md`), and
`docs/design/slices/` holds slices 5 to 9 only. These shots show the built screens on their own, at 360 px,
taken from the e2e stack with pseudonymised fixture data.

| Image                      | Screen                                                                      |
| -------------------------- | --------------------------------------------------------------------------- |
| `t19-close-leave-task.png` | Close with report: "Leave a follow-up task" with what is left, reason, date |
| `t19-parent-overdue.png`   | The parent's Follow-up tasks box: one overdue task with its reason and date |
| `t19-desk-tasks-tab.png`   | Desk Open, Tasks tab: the task with its state, reason and expected date     |
| `t19-task-done-sheet.png`  | Marking a task done: the sheet asks the machine-stopped minutes             |
| `t19-parent-done.png`      | The parent after the task is done, with "45 min machine-stopped"            |
| `t19-floor-warning.png`    | Floor Step 2: the machine already has a follow-up task                      |

## Deliberate differences

1. **No mockup beside these.** Slice 4 was approved as a canvas link, not as PNG frames; a side-by-side is
   not possible from this repo. Built from LOCK.md's slice-4 row, the slice-4 decisions, and the existing
   Tasks tab / ticket detail idioms.
2. **The task chips are the LOCK ones** (Pending, Overdue, In progress, Done) with their icons, not the
   mockup's own drawings (LOCK: "the mockups drew their own, so build the Lucide one").
3. **Leaving a task sits on the close screens**: the report close (a card on the report step) and the
   close-without-report sheet (three optional boxes). v3 had one close dialog; this build has two paths.
4. **No per-segment colour, no new type size, no new colour**: the panel is the kit's card, section title and
   status pill.
5. The task's own screen says "Left from BD-0001" and its reason and expected date; the parent's box stays
   one primary action (the ticket's own action bar), so rows are links, not buttons.
6. The Tasks tab lists unfinished tasks (v3's pending list); a done task stays on its parent's box, so the
   tab never grows without bound.
7. The close-without-report sheet carries the same three optional task boxes as the report close; it is not
   shot here because it is a sheet over the same screens.
