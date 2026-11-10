# M1a-5d — Web polish

## Goal

Close the small quality follow-ups from the M1a-5 reviews. No user-visible feature change.

## Changes

- `apps/web/src/screens/Floor.tsx` — extract the report flow into `apps/web/src/screens/floor/*.tsx`
  components so `Floor()` is ≤60 lines and the file stays ≤300.
- `eslint.config.js` — apply `max-lines-per-function` (60), `complexity` (12), `max-depth` (4),
  `max-params` (4) to `**/*.tsx`, matching the `.ts` rules. Split any `.tsx` component those flag.
- `apps/web/src/components/actions.ts` — offer `update` on a handed-over `open` ticket
  (DOMAIN.md §2 allows `update` from `open (handed over)`); keep the work-role `Set` with its
  "server is authority" comment (sharing it with the domain is a later, optional change).
- `apps/web/src/components/Figures.tsx` — also show `vendorMin`, `handoverWaitMin`, `followMin`.

## Verification

- `pnpm verify` green; the lint rule now covers `.tsx`, and every screen/component stays ≤300
  lines with functions ≤60.
- Behaviour unchanged: raise flow, desk tabs and actions.

## Out of scope

Playwright E2E, new features, sharing the domain role set.
