# 0057 — "Nothing old remains" is a measured list; this push runs as one session

Date: 26 Nov 2026 · Decided by: Nimish ("i dont want you to follow the loop process now … build it like an organic session and finish it")

## Context

Asked "how much is left" for ADR 0055's goal, the coordinator answered from the open-ticket list ("about 5 tickets"). Nimish then found the Desk still on the old design. A route-by-route survey showed 14 of 36 routes still old and several gaps with no ticket. The old guard planned in #819 checked file locations only and would have passed with the old Desk in place.

## Decision

1. `tools/old-ui-left.ts` walks the imports the shipped app reaches from `apps/web/src/main.tsx` and lists every `.tsx` component outside `screens/v2` and `ui/v2` (except `main.tsx`, `App.tsx`, `ui/chart/chart.tsx`). `tools/old-ui-left.test.ts` pins that list. It may only shrink: a new old component fails CI, and a removed one must be crossed off. **ADR 0055 is done when the list is empty**, not when tickets close.
2. On 26 Nov the list held 62 components. Desk, Ticket and the browser Board account for most of them and wait for Nimish's approval of the redrawn S28–S30 wireframes (ADR 0056).
3. For this push the main session builds directly, without ticket, builder and reviewer rounds. Hooks and CI still apply: wireframe approvals, tokens only, tests, handoff.

## Consequences

- "What is left" is answered by running `pnpm exec vitest run tools/old-ui-left.test.ts` and reading `OLD_LEFT`, never from memory.
- Logic (`.ts`) in old folders stays allowed (ADR 0051). The dev-only `/gallery` is not walked, and its pages that show deleted components go with them.
- #819 is replaced by this guard.
