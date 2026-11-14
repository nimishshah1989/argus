# M1a-push — Web push (AC5c, SPEC 1.8)

## Goal

Web push notifications, with the **acting-person re-subscribe rule**: a phone subscribes to push
for the person currently acting on it; when the shared phone's acting person changes, the
subscription is re-bound to the new person (never silently notifying the old one). Tapping a
notification opens the ticket.

## Server contract

- `GET /api/v1/push/key` → `{ publicKey }` (the VAPID public key from the environment).
- `POST /api/v1/push/subscribe` `{ subscription, actingPersonId? }` (the session's person when left out; naming another is 403) → upsert a `push_subscription`
  row for the current login + acting person (the table already exists).
- `POST /api/v1/push/unsubscribe` `{ endpoint }` → remove the subscription.
- `POST /api/v1/push/test` → send one test push to the caller's subscriptions.
- A `sendPush(personId, payload)` helper (web-push) for later ticket events; not wired to an
  event yet (M2 escalation owns that).
- VAPID keys come from `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` (already in
  `infra/.env.example`); with no keys configured the endpoints return `503` rather than crash.

## Files and write scope (two workers, disjoint)

- **push-server worker** — `apps/server/src/push.ts` (new: endpoints + web-push send),
  `apps/server/src/app.ts` (register), `apps/server/package.json` (+ `web-push`, MIT),
  `THIRD_PARTY.md`, `apps/server/test/push.test.ts` (new).
- **push-web worker** — `apps/web/src/push.ts` (new: permission + subscribe + re-subscribe on
  acting-person change), `apps/web/src/components/NotificationsToggle.tsx` (new), a wire-in in
  `apps/web/src/screens/TicketDetail.tsx` or the desk (an enable/disable control),
  `apps/web/vite.config.ts` (switch vite-plugin-pwa to `injectManifest` with `src/sw.ts`) +
  `apps/web/src/sw.ts` (new: precache + a `push` handler showing the notification + a
  `notificationclick` that opens `/desk/:id`), `apps/web/e2e/…` only if practical.

## Rules

- The acting-person re-subscribe rule: store the bound `acting_person_id` with the subscription;
  when the session's acting person changes, re-subscribe/re-bind (the server upsert keys on the
  endpoint + login + acting person).
- Permissions are requested only on an explicit user action (no auto-prompt); a denied permission
  shows a quiet message, never a loop.
- No secrets in the repo; VAPID keys only from env; tests use a generated test key pair or the
  503 path.
- `web-push` is MIT — add it to `THIRD_PARTY.md` and the licence allowlist.

## Test cases

1. Server: `GET /push/key` returns the configured key (and `503` when unset); subscribe upserts
   and is tenant-scoped; unsubscribe removes; test push is a no-op/`503` without keys.
2. Unit: the re-subscribe decision — same acting person → keep; different → re-bind.
3. `pnpm verify` + `pnpm test:e2e` green.

## Out of scope

Email escalation (M2), M3 WhatsApp delivery, wiring pushes to ticket events (M2 escalation).
