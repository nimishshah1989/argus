# Design

Nimish's authoritative direction of 11 November 2026 is Apple's **clarity, deference and depth**, applied literally. This contract supersedes older grey/blue/violet and neutral-running hints. D0.1 records the contract; it does not reskin or approve the current production UI.

## Principles

- **Clarity.** One screen has one primary job and one primary action. Text remains legible, Floor/Desk targets are at least 52 px, icon-only controls have accessible names, and every state uses icon + text rather than colour alone. Meet WCAG AA.
- **Deference.** Body/canvas and cards are **white**. Neutrals are for text, borders and subordinate detail, not a grey application background. Use one **deep-teal** action accent. Borders come before shadows; remove decoration that does not help the task. No competing blue/violet rainbow, gradients, glass, dark variant or display font in v0.
- **Depth.** Sheets and expanded details explain hierarchy. Timelines, people, figures, corrections, follow-ups and history stay available underneath instead of disappearing for visual simplicity.

## Semantic language

- **Action / selection / focus / working:** deep teal.
- **Stopped / destructive:** red.
- **Support / follow-up / waiting / transferred-for-pickup:** amber.
- **Running / success:** green.
- **General / not-started / cancelled / inactive detail:** neutral.
- **Icons:** Lucide outline only, 1.75 px stroke with round joins: 16 px status, 20 px button/list, 24 px navigation and 28 px Floor choice. Decorative icons are hidden from assistive technology; icon-only controls have accessible names and 52 px targets.

## Exact two-axis status contract

Condition and work are independent and each gets icon + label. Example: **Stopped · In progress**.

| Axis             | Source fields                                              | Mapping                                                                                                                                                                                                                                                                                    |
| ---------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Condition        | `kind`, `parentId`, `machineRunningAt`, `machineStoppedAt` | `support` → amber LifeBuoy **“Support”**; `general` with parent → amber ClipboardCheck **“Follow-up”**; other general → neutral ClipboardList **“Work request”**; `stopped` → red CircleStop **“Stopped”**, except a later running interval → green CircleCheck **“Running”**              |
| Running interval | `machineRunningAt` and `machineStoppedAt`                  | running-again only when running exists and is later than stopped (or stopped is null); a running machine does not close the ticket                                                                                                                                                         |
| Work             | `status`, `handedOver`                                     | closed → green CheckCheck **“Closed”**; cancelled → neutral CircleX **“Cancelled”**; waiting → amber Clock3 **“Waiting”**; working → teal Wrench **“In progress”**; open + handedOver → amber ArrowRightLeft **“Waiting for pickup”**; other open → neutral CircleDashed **“Not started”** |

Transferred is not a stored status: the ticket remains open and its work label is **“Waiting for pickup”**. Condition and work labels appear together wherever a ticket's state is summarized.

## Composition and interaction

- Show five total first-screen facts/actions for a role; place the remaining record one tap down in a sheet, expanded detail or drill-down.
- Use system UI type for Latin and Noto Sans Gujarati/Devanagari for consistent Indic rendering. No display face in v0.
- Motion is short and purposeful (150–250 ms), explains a sheet or state change and respects reduced motion. Never animate away unresolved work.
- Management shows exactly five outcomes: availability, open critical, overdue PM, median response and backlog hours. Each has a trend, ticket drill-down and Guide definition.
- Every screen specifies empty, loading, error, offline and success states. Pending and unresolved-failure states remain visible until resolved.

## Evidence and approval boundary

The current-truth PNGs in `docs/design/evidence/d01/` are unapproved functional scaffolding, not renderings of this contract and not pixel goldens. D0.2/D0.3 are isolated review artifacts. Production migration, including Board, Management, Settings and role routing, waits for Nimish's explicit D0.3 visual-alignment record. Use the `impeccable` intent and this file for anything a person looks at; no screen is approved merely because an agent inspected a screenshot.
