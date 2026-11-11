# Role journeys — D0.1 target contract

These are target journeys for isolated D0.2/D0.3 review, not statements that every route or state is implemented. `docs/design/CURRENT-TRUTH.md` records the current scaffolding and gaps. Offline new stopped/support reports remain an M1 todo; management and role-shell routes are not rebuilt in D0.1.

Every role has one home, one primary job and **exactly five total first-screen facts/actions**. Detail remains available through progressive disclosure rather than joining the first screen.

## Exact two-axis status contract

Condition and work are independent and each gets icon + label. Example: **Stopped · In progress**.

| Axis             | Source fields                                              | Mapping                                                                                                                                                                                                                                                                                    |
| ---------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Condition        | `kind`, `parentId`, `machineRunningAt`, `machineStoppedAt` | `support` → amber LifeBuoy **“Support”**; `general` with parent → amber ClipboardCheck **“Follow-up”**; other general → neutral ClipboardList **“Work request”**; `stopped` → red CircleStop **“Stopped”**, except a later running interval → green CircleCheck **“Running”**              |
| Running interval | `machineRunningAt` and `machineStoppedAt`                  | running-again only when running exists and is later than stopped (or stopped is null); a running machine does not close the ticket                                                                                                                                                         |
| Work             | `status`, `handedOver`                                     | closed → green CheckCheck **“Closed”**; cancelled → neutral CircleX **“Cancelled”**; waiting → amber Clock3 **“Waiting”**; working → teal Wrench **“In progress”**; open + handedOver → amber ArrowRightLeft **“Waiting for pickup”**; other open → neutral CircleDashed **“Not started”** |

Transferred remains open; it is not a stored status. Condition and work always retain their own icon + label.

## Management outcome contract

Head, plant_head and admin share exactly these five Today outcomes. No sixth KPI joins their first screen. Every outcome has all three evidence paths named below.

| Outcome             | Trend                                               | Drill-down                                                  | Guide                                                      |
| ------------------- | --------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------- |
| **availability**    | period and comparison trend with its calendar basis | machines and stopped intervals behind the figure            | availability, production-calendar and NO DT/PM definitions |
| **open critical**   | open-critical count over the selected period        | critical tickets with condition, work, owner and elapsed    | criticality and open-ticket inclusion rules                |
| **overdue PM**      | overdue count/hours over the selected period        | overdue PM tasks and their machines, dates and owners       | PM due, completion and exclusion rules                     |
| **median response** | median and comparison trend with sample size        | response intervals and the tickets behind them              | report-to-start calculation and exclusions                 |
| **backlog hours**   | open backlog hours over time                        | open work grouped to its tickets, expected dates and owners | backlog-hour estimation and inclusion rules                |

Money remains visible only to head, plant_head and admin within relevant drill-downs; it is not a sixth first-screen outcome.

## Operator (including setter)

- **Home:** `/floor` — Report a problem.
- **Primary job:** report the correct machine and situation, then know whether the report is confirmed or still needs attention.
- **First screen — five total:**
  1. Machine search and recent machine choices.
  2. Situation choices for stopped, support and other work.
  3. Problem entry with configured quick choices and the available voice path.
  4. One primary **Send** action with machine/situation summary.
  5. **My complaints** for the acting person.
- **States:** **empty** = no recent machines or complaints, with a clear first-report path; **loading** = config/machines and submission pending without duplicate sends; **error** = problem and machine choices survive an explained failure; **offline** = cached reading plus visible queued stopped/support in the future M1 design, while other work requires a connection; **success** = a ref and clear distinction between confirmed and still-queued.
- **Device/language:** one-thumb, low-end Android first, shared-phone acting-person selection, 52 px targets; English/Gujarati with long-label tolerance and transliterated input, Hindi when configured later.
- **Underlying detail:** My complaints → own report → condition + work, ref, reported time, current owner and status history. Report-only users do not need a Desk link. General/other-work detail remains below the machine report path and is never queued offline without separate approval.

## Technician

- **Home:** `/desk` — Open.
- **Primary job:** start or resume the correct next ticket and keep its condition, work and time record truthful.
- **First screen — five total:**
  1. Open work grouped by stopped/support/general with condition + work labels.
  2. Next ticket's machine, ref and problem.
  3. Current owner and elapsed response/work/waiting context.
  4. One state-dependent primary action: Start, Resume or Pick up.
  5. Mine and Team queue switch.
- **States:** **empty** = no open work, with Mine/Team still available; **loading** = list skeleton or pending action that cannot double-apply; **error** = command failure preserves the ticket and explains the next step; **offline** = cached lists/detail and the existing four close/report writes queue visibly, while start/pause/resume/transfer and new raises require a connection; **success** = the expected two-axis state and timeline entry are visible.
- **Device/language:** phone/tablet, one-handed 52 px action targets, keyboard and screen-reader paths; English/Gujarati labels and unclipped long names/reasons.
- **Underlying detail:** ticket card → action sheet → facts, people and per-person figures → follow-ups/corrections → full timeline and report. Machine running changes condition only; transfer returns to open with **Waiting for pickup**.

## Supervisor

- **Home:** `/desk` — Open, with Team one tap away.
- **Primary job:** unblock the oldest or riskiest work and establish a named owner.
- **First screen — five total:**
  1. Oldest unassigned stopped ticket as the primary drill-in.
  2. Waiting and transferred-for-pickup queue.
  3. Team working now and current ownership.
  4. Overdue follow-up tasks.
  5. Closed-without-report list requiring completion.
- **States:** **empty** = explicitly “nothing waiting/unassigned” rather than a blank queue; **loading** = queue and team summaries preserve their structure; **error** = stale queue time and retry are visible; **offline** = cached queues are labelled and writes wait for a connection except the four existing close/report commands; **success** = reassignment/resume/transfer shows the new owner and correct two-axis state.
- **Device/language:** phone first during a shift, tablet/desktop for review; all acting people and wait reasons remain legible in English/Gujarati without truncating ownership.
- **Underlying detail:** exception → ticket → owner/action → timeline, crew minutes, waiting reason and handover; Team → person → day report; follow-up → parent/child history; needs-report → late report.

## Head

- **Home:** `/app` — Today (target route, not current production).
- **Primary job:** judge whether maintenance is working and investigate the outcome that needs intervention.
- **First screen — five total:**
  1. **availability** with trend, drill-down and Guide.
  2. **open critical** with trend, drill-down and Guide.
  3. **overdue PM** with trend, drill-down and Guide.
  4. **median response** with trend, drill-down and Guide.
  5. **backlog hours** with trend, drill-down and Guide.
- **States:** **empty** = no tickets in the selected period with the period and inclusion rule shown; **loading** = five stable outcome placeholders, never invented zeroes; **error** = last good figures are not presented as fresh and retry is available; **offline** = cached outcomes carry an as-of/offline marker and no fresh claim; **success** = as-of time, trend, drill-down and Guide agree on the same period.
- **Device/language:** desktop/tablet for analysis and phone for exceptions; precise numerals, keyboard/screen-reader access and translated labels without changing metric definitions.
- **Underlying detail:** outcome → trend → contributing machines/tickets → ticket history/report → Guide formula. Team, machine, PM, cost and scorecard detail sit below these outcomes, not beside them as extra first-screen KPIs.

## Plant head (`plant_head`)

- **Home:** `/app` — Today (target route, not current production).
- **Primary job:** understand plant availability, maintenance risk and permitted cost exposure, then review the evidence with the head.
- **First screen — five total:**
  1. **availability** with trend, drill-down and Guide.
  2. **open critical** with trend, drill-down and Guide.
  3. **overdue PM** with trend, drill-down and Guide.
  4. **median response** with trend, drill-down and Guide.
  5. **backlog hours** with trend, drill-down and Guide.
- **States:** **empty** = no data for the period, not zero risk; **loading** = period and five outcomes remain identifiable; **error** = failed refresh is explicit and no stale scorecard is called current; **offline** = read-only cached outcomes show their as-of time; **success** = the five outcomes and monthly comparison reconcile to their drill-downs.
- **Device/language:** desktop for scorecards and phone/tablet for review; export labels preserve English/Gujarati meaning and monetary values remain role-gated.
- **Underlying detail:** outcome → tickets/machines/PM → monthly scorecard and permitted Money Matters evidence → Guide. Forecasts include their frozen period and hit-rate beneath the relevant outcome rather than becoming another first-screen number.

## Admin

- **Home:** `/app` — Today (target route; Settings is progressive detail).
- **Primary job:** keep access, master data and operational evidence trustworthy while monitoring the same plant outcomes.
- **First screen — five total:**
  1. **availability** with trend, drill-down and Guide.
  2. **open critical** with trend, drill-down and Guide.
  3. **overdue PM** with trend, drill-down and Guide.
  4. **median response** with trend, drill-down and Guide.
  5. **backlog hours** with trend, drill-down and Guide.
- **States:** **empty** = no management data or no setup items, with the cause distinguished; **loading** = outcome and configuration saves show pending without duplicate submission; **error** = validation/permission failures identify the affected setting or import row; **offline** = management evidence is cached/read-only and admin writes require a connection; **success** = saved configuration has an audit entry and management figures retain their evidence links.
- **Device/language:** desktop for Settings/import/audit and tablet/phone for Today; translations are supplied/reviewed by people, with missing translations explicit.
- **Underlying detail:** outcome → operational drill-down; Settings → people/access, machines, lists, shifts, imports, failed jobs and audit → before/after reason. Admin corrections remain in ticket history and never overwrite the event record silently.

## Board

- **Home:** `/desk/board?kiosk=1` — Live board.
- **Primary job:** show which machine needs attention and who is responding, without offering desk navigation.
- **First screen — five total:**
  1. Live as-of time and connection/staleness state.
  2. Current stopped count.
  3. Machine code with its segment/group.
  4. Open ticket ref with independent condition + work labels.
  5. Current owner and elapsed time for the displayed work.
- **States:** **empty** = no open tickets, with machines still identifiable rather than a blank TV; **loading** = tile geometry remains stable while state loads; **error** = refresh failure and last successful update are visible; **offline** = cached tiles are marked offline/as-of and never called live-confirmed; **success** = the correct machine/ref/two-axis state updates without navigation or motion-only meaning.
- **Device/language:** 1920 px kiosk/TV and tablet, high contrast, readable at distance, reduced motion; icon + text labels remain understandable in the plant's configured language.
- **Underlying detail:** permitted tile interaction → read-only machine sheet → ticket condition/work, owner, elapsed and underlying timeline. Kiosk mode has no Report/Desk navigation; Board, Management and Settings rebuilds are separate later slices.
