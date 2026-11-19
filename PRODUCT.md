# Product

<!-- impeccable:product-schema 1 -->

Written by `impeccable init` (4.8.1, no launcher) from the repository and Nimish's answers of 19 Nov 2026. Every
line comes from a file named beside it or from those answers. A fact nobody has given yet says "not known yet".
Visual decisions live in `docs/DESIGN.md`, not here.

## Platform

web

## Users

One product, four faces, seven roles (`docs/spec/DOMAIN.md` §3). Each row is a person, the device in their hand, where
they stand and the job. The device and setting columns are the facts a design must fit.

| Surface and route                    | Role                           | Device and setting                                                                                                                                                                                                 | Language      | Job                                                                                                                        |
| ------------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Floor, `/floor`                      | operator (production, setters) | A phone shared by a cell, low-end Android in Chrome, on the shop floor. Signs in once; the phone asks "who is acting" once after sign-in. Does not use computers. Works one thumb, 52 px targets, offline-tolerant | Gujarati      | Report a stopped or struggling machine in three taps; see my complaints; confirm a fix ("Yes, it is fixed" or "Not fixed") |
| Desk, `/desk`                        | technician, supervisor         | A phone, personal or shared (a shared maintenance phone asks who is acting); one-handed; a wide screen from 1024 px shows the list and the ticket side by side. Technicians do not use computers                   | English       | Own a ticket: start, update, pause, transfer, close with a report; supervisors also watch the team and sign off            |
| Desk, `/desk`, and Analytics, `/app` | head (maintenance head)        | Phone for tickets, laptop or desktop for analytics and settings; lives on the phone                                                                                                                                | English       | Run the loop: escalations, roster, settings, Today and Breakdowns analytics, money figures                                 |
| Analytics, `/app`                    | plant head                     | Laptop and phone. Not known yet: which of the two they open first                                                                                                                                                  | English       | One scorecard a month; read analytics; acknowledge the last escalation level                                               |
| Settings and Analytics, `/app`       | admin                          | Laptop, desktop web                                                                                                                                                                                                | English       | Configure the plant: people and logins, machines, lists, shifts, SLA, translations, audit, imports                         |
| Board, `/desk/board?kiosk=1`         | board (a login, not a person)  | A wall TV, 50 inch or larger, always dark, read from across the hall. Signed in once at setup and stays signed in. Read-only, no navigation, no money                                                              | not known yet | Show which machines are running, stopped or held up, and for how long, to anyone passing                                   |

- **Language.** Gujarati is the floor's language and English the desk's (Nimish, 19 Nov). Both ship from M1; Hindi waits
  for a second plant (`docs/BRIEF.md`). People also type Gujarati in Latin letters ("haydrolik oil chek"), and search,
  duplicate detection and codes must take it (`docs/spec/SPEC.md` §12).
- **Theme.** The TV board is always dark. Analytics follows the device's light or dark setting (Nimish, 19 Nov). Not
  known yet: whether the floor and desk phones are used in sunlight, in the dark, or both.
- **Shared phones.** Operators share phones (`docs/design/LOCK.md`, slices 2 and 3). The acting person is chosen from the
  plant's people list, once after sign-in, not on every sheet.
- **Board language.** Not known yet: whether the TV reads in Gujarati or English, or follows the plant default.
- **Not known yet:** how far the TV is from the readers (Nimish said "across the hall", with no distance), the room's
  light, and whether operators wear gloves or work with wet hands.

## Product Purpose

Uptimo is a maintenance operating system for Indian factories, sold per plant (`docs/BRIEF.md`). A breakdown is
reported in three taps, becomes a ticket with a named owner, two clocks (acknowledge, restore) and an escalation path,
is closed with a coded report and signed off by production, and feeds analytics that forecast the next breakdown and
show whether maintenance is working. AI suggests; a person confirms.

Success for the floor: a machine stop reaches maintenance in seconds, on the phone people already hold, in their own
language. Success for the desk: nothing waits without someone owning it. Success for analytics: every figure matches
the old platform's exactly before any figure improves (`docs/BRIEF.md`).

## Positioning

The loop is the product: report, own, clock, close, hand back, then analytics reads from it. A neighbouring tool sells
work orders or dashboards. Uptimo reaches the operator who does not use computers, speaks the floor's Gujarati
(including Latin-letter Gujarati), and holds every action to a named person (`docs/spec/SPEC.md` §1).

## Operating Context

- **Tenant.** One plant for now, Cosmos Engitech, about 192 machines in six segments: CNC, conventional, process,
  utility, DG and robot (`docs/BRIEF.md`). Everything plant-specific is configuration.
- **Flows were made with the floor.** The floor and desk keep the incumbent app's (v3) flows, screen order, button
  positions and copy, because the shop-floor workers already use them. The look changes, never the placement (Nimish,
  13 Nov, `docs/BRIEF.md`).
- **Offline.** Reads work from the cached state; closes queue and replay. A low-end Android over 3G opens Today and
  Live in under 2 seconds (`docs/spec/SPEC.md` §7, §9).
- **Time.** Asia/Kolkata. Shifts are a plant setting (`shift`), and the day report uses shift windows.
- **Numbers.** Indian grouping, 1,00,000. Money prints as "₹ 38.23 lakh" (Nimish, 19 Nov).
- **Status.** A fixed vocabulary of colour, icon and word, the same on every face. Running is grey: stopped, waiting and
  transferred stand out, running is quiet. Green means fixed, confirmed and target met (Nimish, 19 Nov).

## Capabilities and Constraints

- **Terms.** Machine, ticket, breakdown, work request, support, stopped, in progress, waiting, transferred, running,
  closed, cancelled, handback, restore clock, acknowledge clock, escalation, cell, segment, group, shift. Floor words
  for the reporter's own tickets are Booked, In progress, Fixed (`docs/design/LOCK.md`).
- **Not decided.** Hindi strings; the escalation ladder, roster and notification payload (answered after two weeks of
  live use, `docs/BRIEF.md`); the technician ranking method; which of the old platform's screens Cosmos uses
  (`docs/BRIEF.md`).
- **Parked.** WhatsApp and voice (M3). Not built, so no screen mentions them.
- **Server decides.** Every permission is checked on the server; a screen only hides what a role cannot do.
- **No money on the TV.** Downtime cost shows on the plant head's phone only (`docs/design/LOCK.md`).

## Brand Commitments

- The name is **Uptimo** (`docs/BRIEF.md`). A tenant's name and logo are plant configuration.
- Apple's principles, clarity, deference and depth, are Nimish's stated preference (`docs/BRIEF.md`).
- One design language, one kit, one icon set; no second UI kit and no custom chart code (`docs/BRIEF.md`).
- Colour never carries meaning alone: every status is colour, icon and word.

## Evidence on Hand

- Approved mockups: `docs/design/mockups/` (slices 1, 2, 6) and `docs/design/slices/*.html` (slices 5 to 9), recorded
  in `docs/design/LOCK.md`.
- The incumbent apps, inventoried in `docs/discovery/bhavin-v3/INVENTORY.md`, and the platform export of 11 Nov in
  `docs/discovery/real-2026-11-13/`.
- Frozen analytics figures: `fixtures/answer-key/dashboard.json`, as of 11 Nov 2026.
- **Absent, so never fabricate:** usability-session findings (N15 in `docs/plan/NEEDS.md` is still open), photographs
  of the floor or the TV in place, the real Gujarati strings (the catalogue holds placeholders until Cosmos reviews them),
  and any customer quotes.

## Product Principles

1. **The floor first.** A screen the operator sees is built for one thumb, 52 px targets and one primary action. The
   desk and analytics inherit that simplicity.
2. **One person owns it.** Every ticket and action names a person; a shared phone asks who is acting.
3. **Quiet when well.** What is running is quiet; what is stopped or waiting stands out. A screen shows the next action,
   not the most data.
4. **AI suggests, a person confirms.** No number or code is invented; figures come from code.
5. **Their words.** Gujarati on the floor, English on the desk, the plant's own terms from its lists.

## Accessibility & Inclusion

- WCAG AA contrast, tested in light and dark; touch targets at least 44 px, 52 px for primary actions
  (`docs/QUALITY-ATTRIBUTES.md` Q8).
- Gujarati text gets its own line height (1.55) (`docs/design/LOCK.md`) and the Noto Sans Gujarati face (`apps/web/src/ui/tokens.css`).
- Reduced motion switches animation off.
- Colour never carries meaning alone.
- Not known yet: whether any user needs a larger text size than the six drawn sizes, or has a colour-vision difference
  that a plant has told us about.
