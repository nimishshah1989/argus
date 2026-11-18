# Shortcut ledger

Every deliberate `shortcut: <limit>, <when to upgrade>` comment in the code is listed here with the file, the limit and the trigger. A shortcut without a trigger is not a shortcut; it is debt.

| File                                          | Limit                                         | Upgrade when                                                                                                               | Ticket |
| --------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------ |
| `apps/server/src/modules/analytics/routes.ts` | Drills load the whole plant once per request. | drills load the whole plant once per request; switch to narrow repo reads by id when a plant's load passes about a second. | 37a    |
| `apps/web/src/screens/analytics/ProblemsPage.tsx` | A10's problem-group keyword editor and its "add a word to a group" action are read-only in ticket 41 (the figure still prints the platform's exact cells). | when the problem-group settings write and its audit land in the M4b settings slice. | 41 |
| `apps/web/src/screens/analytics/ProblemsPage.tsx` | A10 omits the platform's "What stands out" prose: it is computed from the figures, the answer key holds no text field and no engine rule pins it. | when those sentences are computed from the figures and a key or a recorded ruling pins them. | 41 |
