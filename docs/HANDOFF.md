# Where things stand

Read first. Rewrite when the state changes. Under 50 lines.

## RESUME HERE (M2 gate, 17 Nov 2026)

**State:** **M2 Accountability is ACCEPTED — Nimish gave GO on 17 Nov.** Gate report `docs/plan/gates/M2.md`
(29 lines, every criterion → ticket, test, link). Evidence: #228 schema, #241/#284 roster and ladder, #230
notifications, #249/#252/#285 escalation, #244/#261/#262/#283 sign-off, #248/#264/#284 lockout, #287 the two
design calls. **M4a (analytics parity) is next.**

- **Roster and ladder:** `/settings/roster` with **Copy to the next 7 days**; `/settings/escalation-rules` refuses
  a repeat under 15 minutes and a repeat with no cap, push only for now (the server's WhatsApp fallback stays
  proven for M3).
- **Lockout:** the "Needs lockout" flag now on work types _and_ breakdown categories, and the editable lockout
  step list, both on Lists; a flagged ticket's Start waits for the ticks (#264).
- **Acknowledge** leads the action bar for the on-duty person with Start beside it, who and when after (#285).
- **Escalation** shows in the history (level, who was told, channel, speed, repeats, "Escalation due, nobody
  told") and as a state line on the desk card; the fake clock proves an L2 fires at its configured minute.
- **Sign-off turnaround** on live tickets, and the desk's waiting feed reads **oldest first** (#283).

**Routing and budgets:** the routes are fixed in `docs/decisions/D31-…`; those names live in the decision, not
here. Probe: the **coder route answered ROUTE-OK** and wrote every packet. The **reasoning/review route could not
answer — its API key is absent from the credential store** (recorded gap, ledger 17 Nov); planning and every
fresh/scoped review therefore ran on Isoquant's second family (a different family from the writer), never a silent
switch. Spend is inside the two budgets.

**Open, not mine:** #281 (CI test cut — needs its Q14 review line and a rerun) and #282 (M1 session record —
prettier red). Both predate this session.

## M2 leftovers, for the gate word

- Ticket 30 is `in progress`: clocks live on card and detail, the pause-breach fake clock is #251; switching the
  targets on at Cosmos is the staging step.
- Ticket 35 goal 1 (failed-jobs screen and the timer-lag alarm) is open; the nine M2 success criteria do not
  include it. Decide whether M2 closes without it.

## Next

- **M4a analytics parity** (tickets 36–45; 36 and 37 are part-done), per `docs/plan/MILESTONES.md`. M3/M5 parked.
- His staging step for M2's clocks: Settings → SLA targets, the four severities' acknowledge and restore minutes.
- Weekly dump + Drill B (`RESTORE.md`), and the missing reasoning-route key so that route returns.

## Parallel rule

One orchestrator; children use fresh contexts and disjoint files; contract first, never two writers on one file.
