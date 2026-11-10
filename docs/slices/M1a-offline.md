# M1a-offline — Offline outbox and cached reads (AC5b, SPEC 1.9)

## Goal

A technician who loses signal can still **close** a ticket (with or without report, or mark a
task done / late report): the command is queued with its `Idempotency-Key` and the time the
person chose, replayed in order on reconnect or app open, and a `409` (the ticket changed in the
meantime) becomes a **draft** the person sees — never silently dropped. Reads show an **offline
marker** from the last cached state/config.

## Rules (SPEC 1.9)

- Only the four offline-writable commands queue: `close` (report / no_report / done) and
  `report` (late report). Every other command requires a connection and says so.
- Each queued entry carries the exact body the client built (including the chosen `at`) and a
  fresh `Idempotency-Key`, so a replay is idempotent.
- Replay is in order, sequential. On success `2xx` → drop it; on `409` → move it to a **drafts**
  store (shown, retryable/dismissable); on network error → keep it queued for the next attempt.
- No new runtime dependency if raw IndexedDB is workable; otherwise use `idb` (MIT, in
  THIRD_PARTY.md) — prefer raw IndexedDB.

## Files and write scope (two workers, disjoint)

- **outbox worker** — `apps/web/src/offline/outbox.ts` (new: IndexedDB queue + drafts store),
  `apps/web/src/offline/replay.ts` (new: ordered replay + 409→draft), `apps/web/src/offline/cache.ts`
  (new: persist the last `/state` + `/config`), and `apps/web/src/api.ts` (route a queueable
  command to the outbox when offline; expose an `offline` signal) + `apps/web/src/main.tsx`
  (replay on startup / `online` event).
- **ui worker** — `apps/web/src/components/OfflineBanner.tsx` (new), a **Drafts** list on the desk
  (`apps/web/src/screens/Desk.tsx` + a `components/Drafts.tsx`), and `apps/web/e2e/offline.spec.ts`
  (new E2E: `context.setOffline(true)` → close a ticket → assert it is queued → online → assert it
  replays to `Closed`; and a 409 → draft case).

## Test cases

1. Unit (outbox/replay state machine with a mock fetch): queue → replay success removes; replay
   409 → draft; network error keeps it queued; order preserved.
2. E2E: offline close queues (no error, an "offline" state), reconnect replays to `Closed`.
3. E2E: a queued close whose ticket was closed meanwhile (409) shows a draft, not a silent drop.
4. `pnpm verify` + `pnpm test:e2e` green.

## Out of scope

Web push (AC5c), Gujarati, the service-worker push handler (the outbox is app-level, not SW).
