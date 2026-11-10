# M1a-pwa — WhatsApp share text + PWA install/shell (AC5a, SPEC 1.8/1.9 part 1)

## Goal

Two independent, disjoint pieces of M1b:

1. **WhatsApp share text** (SPEC 1.8): the short and full ticket text Bhavin's users send today,
   produced by one pure function and offered as a share button (opens `wa.me/?text=…`).
2. **PWA baseline** (SPEC 1.9): two installable manifests (floor "Report", desk "Maintenance"),
   a service worker that precaches the app shell, and the install/update hooks. The **offline
   outbox** (queue + replay + 409 drafts) is a separate slice (AC5b); **web push** is AC5c.

## Files and write scopes (disjoint — two workers)

- **share worker** — `packages/shared/src/share.ts` (new: `shareText(ticket, config, mode)` short/full),
  `packages/shared/src/index.ts` (export), `packages/shared/test/share.test.ts` (new unit test),
  `apps/web/src/components/ShareButton.tsx` (new), and one wire-in each in
  `apps/web/src/screens/TicketDetail.tsx` + `apps/web/src/screens/floor/SentConfirmation.tsx`.
- **pwa worker** — `apps/web/vite.config.ts` (vite-plugin-pwa), `apps/web/package.json`
  (+ `vite-plugin-pwa`, licence in `THIRD_PARTY.md`), `apps/web/index.html` (manifest links),
  `apps/web/public/manifest-floor.webmanifest` + `manifest-desk.webmanifest` (new, with the
  needed icons — reuse a generated square icon; no external asset), and the service-worker
  registration snippet.

## Rules

- Share text is a pure function (no DOM), tested (short + full, missing fields, tenant name).
- `wa.me` link is generated from the text (`https://wa.me/?text=` + encodeURIComponent).
- PWA: app-shell precache only; **no offline write queue yet** (AC5b). Do not register a push
  handler (AC5c). Icons must be real files committed in the repo (no external fetch).
- No new runtime dependency beyond `vite-plugin-pwa` (MIT, dev).
- `pnpm verify` + `pnpm test:e2e` green; `pnpm --filter @uptimo/web build` emits the manifest +
  service worker.

## Test cases

1. Unit: share text short + full match the expected strings for a sample ticket (problem, ref,
   machine, times); handles a missing machine/problem.
2. Unit: the `wa.me` URL is correctly encoded.
3. Manual/E2E-lite: the detail and sent screen show the share button; the built app registers a
   service worker and exposes both manifests.

## Out of scope

Offline outbox/replay/drafts (AC5b), web push + subscription (AC5c), Gujarati strings.
