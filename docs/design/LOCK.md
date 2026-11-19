# Design lock: slice 1 (floor and desk)

Nimish approved the slice 1 mockups on 14 Nov 2026 (canvas: https://claude.ai/artifact/Tr4eCZnmM1wBMQjz3pXsaU).
This page is what a builder reads before building any floor or desk screen. The pictures are in
`docs/design/mockups/slice-1/` (one 360 px PNG per phone, see its README); tokens live in `apps/web/src/ui/tokens.css`.

## Rules

1. **Floor and desk keep v3 flows, order, button positions and copy.** The look changes, never the layout or words.
2. **No className, no raw colour, no hand-made element in `faces/`.** Build from the kit (`ui/`) and the patterns
   (`patterns/`); `pnpm ui:check` enforces the first two. Anything not in this lock needs a new decision first:
   ask the orchestrator, who asks Nimish only if it is a product question.
3. **Built like the mockup.** A screen PR shows its built screen at 360 px next to the mockup PNG and lists every
   deliberate difference. Compare against the PNG, not against memory.
4. **One primary action per screen.** Colour never carries meaning alone: every status is colour + icon + word.
5. Text sizes, spacing and tap targets come from the tokens below. A new size or colour is a new decision.

## Tokens (`ui/tokens.css`; dark is `:root[data-theme='dark']`)

| Role                      | Light             | Dark              | Class                                          |
| ------------------------- | ----------------- | ----------------- | ---------------------------------------------- |
| Page / card               | #f5f5f7 / #ffffff | #111214 / #1c1c1e | `bg-neutral-100` / `bg-surface`                |
| Text / secondary          | #1d1d1f / #6e6e73 | #f5f5f7 / #a1a1a6 | `text-neutral-900` / `text-neutral-600`        |
| Accent fill, text on it   | #0f766e, white    | #14b8a6, #04201d  | `bg-accent-strong text-accent-ink`             |
| Accent as text, tint      | #0f766e, #e3f2f0  | #2dd4bf, #12302c  | `text-accent-text`, `bg-accent-tint`           |
| Control border (tap/type) | #8e8e93 (3.26:1)  | #8e8e93           | `border-control` (card edges stay neutral-200) |

- **Type: six sizes only**, 12 `text-caption` (chips), 14 `text-footnote` (hints, secondary lines), 16 `text-body`,
  20 `text-title3` (bar title, machine row), 24 `text-title2` (step question, counts), 32 `text-title1` (card machine
  code). Weights 400, 600, 700, 800. Gujarati lines get 1.55 line height.
- **Spacing:** 4, 8, 12, 16, 24, 32 (`Stack`/`Inline` gaps; 48 stays in the kit for page level, not drawn). Gutter 16,
  card padding 16, 16 between groups, 8 inside them.
- **Shape:** controls 12, cards 16, sheets 20 (`--radius-sheet`), chips round. Light cards carry one soft shadow, dark
  cards a hairline. Motion 150/250 ms, off for reduced motion.
- **Tap targets:** `--spacing-target` 52 px for primary, secondary and tonal buttons and fields (`min-h-target`);
  `--spacing-target-min` 44 px is the floor for everything smaller (`min-h-target-min`: quiet button, chip, tab
  inside a segmented bar, round close). Rows and tiles 64 to 84; bottom tab 56; status chip 28 (not tappable).
- **Contrast is tested** (`ui/tokens.test.ts` and axe in the gallery, light and dark): every ink on its tint, the
  accent as text and as a fill must be 4.5:1 or better.

## Status vocabulary (`<StatusPill group id />`; ink on tint, 4.5:1 or better)

Light ink (dark is the lighter tone of the same name). Icons are the kit's Lucide names (D04); the mockups drew their
own, so build the Lucide one.

| Chip (English)                                      | group.id                           | Tone, ink / tint (light)                           | Icon                                 |
| --------------------------------------------------- | ---------------------------------- | -------------------------------------------------- | ------------------------------------ |
| Stopped                                             | ticket.stopped                     | danger #b91c1c / #fdecec                           | octagon-x                            |
| In progress                                         | ticket.in_progress                 | info #1d4ed8 / #e8effd                             | wrench                               |
| Support                                             | ticket.support                     | warning #92400e / #fbf0dc                          | life-buoy                            |
| Waiting                                             | ticket.waiting                     | hold #9a3412 / #fdeee4                             | hourglass                            |
| Transferred                                         | ticket.transferred                 | moved #6d28d9 / #f1eafd                            | arrow-right-left                     |
| Running                                             | ticket.running                     | ok #166534 / #e6f4ea (mockup green; D04 had muted) | circle-check                         |
| Closed, Cancelled                                   | ticket.closed, .cancelled          | muted #48484a / #ececf0                            | check-check, ban                     |
| Booked, In progress, Fixed (floor, "My complaints") | floor.booked, .in_progress, .fixed | hold, info, ok #166534 / #e6f4ea                   | clock, wrench, circle-check          |
| Needs report, With report                           | report.needs_report, .with_report  | danger, ok                                         | file-warning, file-check             |
| Online, Offline, Sending, Draft                     | sync.* (header pill, decision 5)   | muted, hold, info, warning                         | wifi, wifi-off, refresh-cw, file-pen |

The 31 existing chips plus the five new ones are all on `/gallery` in light and dark. Severity, clock, handback, pm
and forecast keep their groups; no mockup screen shows them.

## Page patterns (`apps/web/src/patterns/`)

`QueuePage` (every list), `DetailPage` (ticket), `FormSheet` (every desk action and its reason), `WizardPage`
(report steps, other work). `PatternFrame` puts the sync pill in the header on every one. Kit: `Button` (`primary`,
`secondary`, `tonal` for a card's own action, `quiet`, `quiet-danger`), `Input`/`Label`, `Card`, `Sheet`, `StatusPill`.

**Screen frame in the kit** (`ui/`, gallery section "Screen frame"): `TopBar` (title, "Updated" line, sync pill or
step count), `TabBar` (floor 2 tabs, desk 5, count badge), `Banner` (offline, info, attention, error), `Skeleton` and
`Loading` (loading shapes). **Desk lists in the kit** (gallery "Desk lists"): `CountsStrip`, `SegmentedBar`,
`TicketCard`.

**Drawn but not yet in the kit** (a ticket that needs it builds it once, in `ui/`, with a gallery section; never in
`faces/`): machine row, group tile, choice card, quick-problem chip.

## The six decisions (Nimish, 14 Nov 2026, verbatim)

1. A quick problem keeps a separate Send (4 taps).
2. Screen title "Report a problem", confirmation "Sent to maintenance".
3. A machine with an open support ticket reads "Needs support. Tap to say it has stopped."
4. A quiet tonal per-card action button instead of v3's solid blue "Start work".
5. The desk header shows the sync status pill (online, offline, sending, draft).
6. My complaints keeps v3's words (Booked, In progress, Fixed) on the floor; the catalogue gets these as floor
   labels (`status.floor.*`) without renaming the desk's ticket words.

## Slices 2 and 3: approved, decisions recorded (14 Nov 2026)

Nimish approved the slice 2 mockups (https://claude.ai/artifact/3McvVvwWvijMLM6FNcTVLK) and the slice 3 mockups
(https://claude.ai/artifact/UEwV5m4SdfC3UvUprBy1bG). Their reference PNGs are not in this PR (slice 1 only); each
slice's screen PR adds its own. Decisions that came with them:

- Mark done works offline like the other closes.
- Start and close times move in 5-minute steps.
- The report keeps three "Done by" and one "Supported by".
- A restored ticket does not count the cancelled gap.
- The wall TV is signed in once at setup and stays signed in.
- A shared phone asks "who is acting" once after sign-in, not per sheet. Floor and desk use the same picker: the company's people list (Nimish, 14 Nov, replacing T2's typed name + role chip).
- The label is "Alerts".
- The WhatsApp share keeps v3's details (reporter, who is working, what it waits for) and reads "Cell 4".
- Live counts use v3's words (Running, Stopped, In progress, Support); a waiting machine counts as Stopped.
- The Live tab is off for operators by default.
- The Live board and TV visual design is locked below ("Live board, slice 4 and slices 5 to 7").

## Live board, slice 4 and slices 5 to 7: approved (14 Nov 2026)

Nimish approved these on 14 Nov 2026. The Live board, slice 4 and the slice 4 icons were relayed by the frontend
orchestrator from his answers; slices 5, 6 and 7 he approved without publishing ("even the ones I've not published, I've
had a look, consider them approved"), and he told the design agent in its own session to commit them and update this lock.
Build from these; a change needs a new decision first. Where the pictures are:

- Live board (combined, TV, phone, desktop): https://claude.ai/artifact/M3Gc2VpfMqTBrQ6u6MrV6p
- Slice 4 (settings, people and logins, audit, follow-up tasks, past breakdown, icons and colour, desktop): https://claude.ai/artifact/7iLVAMkHLQ8ncGEg5ZWhXL
- Slices 5, 6 and 7 are not on a canvas. They are `docs/design/slices/slice-5-account-alerts.html`, `slice-6-signoff.html`
  and `slice-7-lockout.html`; `docs/design/slices/README.md` lists every frame, its states and the choices taken.

| Screen group                                                                                                                                              | Who may open it                                                                | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live board: pulse (running and stopped), the three columns (Nobody has started, Being repaired, Paused and waiting), scoreboard tiles; TV, phone, browser | board and every desk role; no money on the TV                                  | Order: pulse, what is holding us up, scoreboard. "Today" is the calendar day for now. Long stops stay in their column, oldest first, age shown. Every other wait reason sits in the third column labelled with its reason. 3 machines per column plus "and N more". After M4a the 24 h chart replaces the TV clock (a small time stays in the header) and downtime against yesterday joins; downtime cost on the plant head's phone only. "Stopped longest" tile dropped. |
| Settings: machines, segments and groups, shifts, lists, glossary, company                                                                                 | head, admin                                                                    | Edit in a sheet on the phone and a right-hand side panel on desktop. A cell move is dated from today; past tickets keep the old cell. Hidden group = off the Live board, its counts and alerts; still found by search and reportable on the floor. Criticality starts at B for every machine.                                                                                                                                                                             |
| People and logins, switch off, audit trail with CSV export                                                                                                | admin (audit: admin and head read, only admin exports)                         | Switching a person off needs a reason. Bulk actions only: people (change shift, sign out devices, switch off, each confirmed) and machines (set criticality).                                                                                                                                                                                                                                                                                                             |
| Follow-up tasks: leave at close, Tasks tab, parent box, mark done, floor warning; Record a past breakdown                                                 | technician and above (past breakdown: technician, supervisor, head, admin)     | Task chips Pending and Overdue are new; a task with no date never turns Overdue. Past breakdown is a card at the foot of the desk's Report step 1.                                                                                                                                                                                                                                                                                                                        |
| Account sheet, Who is acting, sign out                                                                                                                    | every signed-in role                                                           | Opens from a person button in the top bar (desktop: the name at the foot of the left menu). Language belongs to the login. Support-access note only for the support person under the grant.                                                                                                                                                                                                                                                                               |
| Alerts control: Off, On, Blocked by the browser, Not available                                                                                            | every signed-in role                                                           | Blocked says where to allow it and offers "Check again".                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Sign-off: My complaints "Is it fixed?", dispute, board QR band, desktop ticket                                                                            | the reporter or any login in the machine's cell; supervisor and above anywhere | Floor buttons say "Yes, it is fixed" and "Not fixed" (API: Confirm, Dispute). A dispute needs a short reason. Timeout is a plant setting, default 4 h.                                                                                                                                                                                                                                                                                                                    |
| Lockout before Start: steps unticked, all ticked, confirming, refused, already confirmed                                                                  | technician and above                                                           | Four default steps (plant setting); a different person confirms again; only Electrical is flagged at first; only the confirmation is saved.                                                                                                                                                                                                                                                                                                                               |

**Icons and colour (slice 4, locked).** A machine's tile takes its segment's icon: CNC Cog, Conventional Drill, Process
FlaskConical, Utility Zap, DG Fuel, Robot Bot. Its colour comes from its live status, never from its segment; running
stays neutral. Segments get no colours of their own. Filters are tappable chips with an icon, a word and a count; a
selected chip shows a tint, a 2 px ring and a tick. One table in the kit (`ui/meaning.ts`) holds segment to icon and
status to tone, icon and word; the task chips (Pending, Overdue, Done) are in it.

**Desktop (locked).** One left menu on desktop; phones keep their tabs. The desk on a wide screen shows the Open list on
the left and the ticket detail on the right from 1024 px, same words and actions. Editing opens a side panel, never a
new page. Live in a browser is the approved board with an "Open TV view" button; Tasks get their own menu item.

## Slice 8 and analytics batch 1: approved (14 Nov 2026)

Nimish approved these on 14 Nov 2026 ("approved") after the design agent listed them as waiting. Frames:
`docs/design/slices/slice-8-escalation-roster-lockout.html` and `slice-9-analytics-1-dashboard-today.html`; the README lists
every frame, its states and the choices taken.

- **Acknowledge on the ticket:** the person on duty (canAcknowledge) sees Acknowledge as the main button while the clock
  runs, with Start work beside it; anyone else sees who is on duty. After it, the card says who and when.
- **Escalation history entries:** each says level, who was told and the channel; the acknowledgement says who and how fast;
  a repeat is its own entry; "no ladder" reads "Escalation due, nobody told" with "Set the ladder" for head and admin.
- **Roster and ladder settings (head, admin):** roster per day and shift with Copy to the next 7 days; ladder rules refuse
  a repeat under 15 minutes and a rule with no stop count; push only for now.
- **Lockout settings (head, admin):** a "Needs lockout" flag on work types and breakdown categories, and one editable list
  of steps (at least one).
- **Analytics face (heads, plant head, admin; desktop and phone; supervisors also get the desk Analytics link, Nimish, 19 Nov: supervisors get an Analytics link in the desk menu):** left menu in groups, collapsed except the current one,
  with Guide and Data checklist; Dashboard in the platform's order; head and plant head open on Today; every figure shows
  its drill target; Money Matters is heads and admin only. Every Dashboard figure and chart is the backend answer key
  (`fixtures/answer-key/dashboard.json`, as of 11 Nov 2026); the Live machine status card is dropped (m4a-triage).

## Screens: artboard, pattern, parity row, who may open it, states shown

Roles are DOMAIN §3 (operator, technician, supervisor, head, plant_head, admin, board). "Raise" = every role but board.
Every list and detail also has the loading, empty, offline and error states of `viewState`; only the ones drawn are
named. Dark (A4, B6) and Gujarati (A5) are variants of the same screens, not new ones.

| Artboard         | Screen                                                             | Pattern                             | Parity                                      | Roles                                           | States shown                                                                           |
| ---------------- | ------------------------------------------------------------------ | ----------------------------------- | ------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| A1-1, A1-2, A1-3 | Step 1: find the machine, search, inside a group                   | WizardPage                          | v3.reporting.01, .02                        | Raise                                           | ready, searching, group, already reported, support ticket (A3-5, A3-6), loading (A3-1) |
| A1-4             | Step 2: the situation                                              | WizardPage                          | v3.reporting.03                             | Raise                                           | ready; support-ticket variant (A3-6)                                                   |
| A1-5             | Step 3: the problem, then Send                                     | WizardPage                          | v3.reporting.04                             | Raise                                           | shared phone (name, role), disabled Send with reason, offline (A3-3), error (A3-4)     |
| A2-1             | Sent                                                               | WizardPage (last step)              | v3.reporting.09                             | Raise                                           | ready (Cancel only while unstarted)                                                    |
| A2-2             | My complaints                                                      | QueuePage                           | v3.views.07                                 | Raise                                           | ready, empty (A3-2), loading, offline                                                  |
| A2-3             | Other work (not a machine)                                         | WizardPage                          | v3.reporting.06                             | Raise                                           | ready (personal login)                                                                 |
| A2-4             | "I am starting work on it now"                                     | WizardPage step 3                   | v3.reporting.07                             | technician, supervisor, head, admin             | ready                                                                                  |
| A3-1 to A3-6     | Floor states                                                       | patterns' `StateNotice`, WizardPage | v3.reporting.02, .08; slices 15 (5), 11 (6) | Raise                                           | loading, empty, offline, error, already reported, support ticket                       |
| B1-1, B1-2       | Open: counts, breakdowns, tasks, work; needs report                | QueuePage                           | v3.views.01, .02                            | technician, supervisor, head, plant_head, admin | ready, filtered by count; needs-report list                                            |
| B1-3             | Mine                                                               | QueuePage                           | v3.views.04                                 | technician, supervisor, head, admin             | ready, closed 30 days                                                                  |
| B1-4             | Team (read only)                                                   | QueuePage                           | v3.views.05                                 | technician, supervisor, head, plant_head, admin | ready                                                                                  |
| B2-1 to B2-4     | Ticket detail: facts, minutes, people, history, action bar, closed | DetailPage + FormSheet              | v3.views.03                                 | as the list it opens from                       | ready, closed (no actions)                                                             |
| B3-1 to B3-12    | The action bar by role and ticket state                            | DetailPage (`availableActions`)     | DOMAIN §3 (no v3 row)                       | all four desk roles                             | not started, working, cancelled                                                        |
| B4-1 to B4-3     | Not available to you                                               | route guard notice                  | none (screens plan, access control)         | any role lacking the route's permission         | not available                                                                          |
| B5-1 to B5-4     | Sync status pill and banner                                        | PatternFrame, `SyncStatus`          | slice 11 goal G1                            | every signed-in role                            | online, offline, sending, draft                                                        |
| B6-1 to B6-3     | Desk in dark                                                       | as B1, B2, B3                       | as B1, B2, B3                               | as B1, B2, B3                                   | dark                                                                                   |

**Not drawn, so not locked:** the `?m=` link (reporting.10, opens Step 2), Gujarati dictation (.11), the pending-task
note (.05), Live board, account sheet, sign-in, settings, analytics, notifications. Gujarati strings are placeholders.
