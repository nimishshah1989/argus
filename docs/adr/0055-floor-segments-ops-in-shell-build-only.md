# ADR 0055: Floor falls back to segments, operational screens join the Analytics frame, build-only sessions

Date: 26 Nov 2026 · Decided by: Nimish ("okay with all 3 recommendations", after seeing Floor, Desk, Team and Board on staging)

## Context

On staging Nimish found three things that looked wrong:

- Floor step 1 says "tap its group below", but the plant has 0 machine groups (all 192 machines have only a segment), so nothing shows.
- Desk, Team and the ticket page look like the old app. They match the approved S28–S29 wireframes, which kept the Desk's own menu, but not the Analytics frame.
- The Live board breaks on a wide window: the page frame squeezes the side columns.

He also wants the 11 unstarted tickets built and live without more planning rounds.

## Decisions

1. **Floor:** when a plant has no machine groups, step 1 shows its segments as tiles (name and machine count). Tapping one lists that segment's machines. Once groups exist, the approved group tiles return. Test fixtures include a plant with zero groups.
2. **Desk (Open, Mine, Team), Board (browser view) and the ticket page move into the v2 `Shell` (the Analytics frame).** The TV/kiosk view and Floor (phone) keep their own frames. This needs new S28–S30 wireframes, which Nimish approves with `loop approve`, then tickets.
3. **Board:** ticket #828 (frame fix, seed `plan/t828`) is built and merged first.
4. **Process:** the 11 seeded tickets (#791–#794, #812–#818) and #826 are built back to back with no new planning. A ticket merges on green tests and a critical-only review (ADR 0050). Planning runs only for decisions 1 and 2. CI, hooks and `loop-guard` stay on.
