# Shortcut ledger

Every deliberate `shortcut: <limit>, <when to upgrade>` comment in the code is listed here with the file, the limit and the trigger. A shortcut without a trigger is not a shortcut; it is debt.

| File | Limit    | Upgrade when | Ticket |
| ---- | -------- | ------------ | ------ |
| `apps/server/src/modules/analytics/routes.ts` | Drills load the whole plant once per request. | drills load the whole plant once per request; switch to narrow repo reads by id when a plant's load passes about a second. | 37a |
