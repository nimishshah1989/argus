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
`Loading` (loading shapes).

**Drawn but not yet in the kit** (a ticket that needs it builds it once, in `ui/`, with a gallery section; never in
`faces/`): counts strip, segmented bar, machine row, group tile, choice card, ticket card, quick-problem chip.

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
- A shared phone asks "who is acting" once after sign-in, not per sheet.
- The label is "Alerts".
- The WhatsApp share keeps v3's details (reporter, who is working, what it waits for) and reads "Cell 4".
- Live counts use v3's words (Running, Stopped, In progress, Support); a waiting machine counts as Stopped.
- The Live tab is off for operators by default.
- **The Live board and TV visual design is not locked**: a leadership dashboard concept is being explored.

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
