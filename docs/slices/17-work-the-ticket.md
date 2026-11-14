# 17 — Work the ticket (API goals only)

Branch `claude/t17-work-the-ticket-api`. One PR, `Refs #<issue>` (the ticket's screens are not part of it).
No table, no migration, no new dependency, no `apps/web` change.

## 1. Goals

1. Start (back-dated), update, pause, resume, join, leave, transfer, pick up, running and stopped give the
   `worker.js` result on real tickets (`v3.actions.01, 03, 04, 07, 08`).
2. Per-person minutes come from one domain function: the same number on the ticket and on the day report.

## 2. How goal 1 is proved

`apps/server/test/work-the-ticket-replay.test.ts` takes every ticket of the pseudonymised export that has an event
log, raises it through `POST /tickets` and replays its steps through the real command routes (shared technician
login, `Idempotency-Key` on every call, the clock set to the time each step was written in his app, back-dated times in
the body). Then it compares, per ticket, with the oracle (`imports/real-oracle.ts`, his arithmetic):
the nine figures, the status, the lead, the transfer count, and every person's minutes (the sum of his `segment` rows).
Every difference sits in an explicit table with its cause; a difference not in the table fails the test, and so does a
table entry that no longer differs. Zero unexplained.

## 3. Where a command's rule differed from `worker.js` (domain function fixed, test first, oracle untouched)

| Command  | `worker.js`                                                                                        | Domain before                                            | Now                                                    |
| -------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| resume   | the lead stays lead if the resumer is the lead or on the crew; every crew member's clock restarts  | the resumer always became lead; crew clocks stayed shut  | as his                                                 |
| transfer | the crew is stopped and marked left ("job transferred")                                            | crew kept as still on the job                            | as his                                                 |
| leave    | the lead may leave when a primary can take over; that primary becomes lead with a fresh lead clock | the lead could not leave; no hand-over of the lead clock | as his; the lead with no primary to take over gets 409 |
| join     | the person running the job cannot join their own job                                               | allowed                                                  | 409                                                    |
| start    | back-dating stops at the report time (or the transfer time when picking up)                        | stopped at the latest event (an update blocked it)       | report or transfer time                                |
| running  | only while working or waiting; once                                                                | any status; repeated                                     | as his                                                 |
| stopped  | back-dated like running                                                                            | no time                                                  | optional `at`, not before the running time             |
| pause    | a "spare" reason flags the ticket as waiting for a spare                                           | not flagged                                              | flagged (cleared at resume)                            |

## 4. Differences kept on purpose (not ported)

- A time earlier than allowed is clamped (DOMAIN §5), his app answers 400. A start more than a day old is accepted.
- `start` on a ticket already working is `409` (his app answers `ok, already`): DOMAIN §2, the second person gets the
  current ticket.
- The 60-updates-per-ticket cap is not ported (no figure depends on it). Vendor time follows the list flag, his app a
  regex on the label; the two agree on every real reason.
- Adding someone else to a job from a personal login (his lead-adds-someone) needs a body field the contract does not
  have; it works on a shared login. Follow-up.

## 5. Goal 2

Three places computed per-person minutes: `figures().perPerson`, a copy in `tickets/mapper.ts`, and a SQL sum in the day
report. Different rounding (the SQL summed raw seconds then rounded once). One function,
`personMinutes(segments, now, window?)` in `packages/domain`: each segment clipped to the window, rounded, summed per
person. `figures()` uses it, the list projection uses it, the day report loads segments and calls it. The test seeds one
ticket set and asserts the ticket view and the day report return the same number per person; a planted divergence (a
segment edge that rounds differently when summed raw) fails the old SQL.
