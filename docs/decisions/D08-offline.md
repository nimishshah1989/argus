# D8 — Page-driven outbox replay; token stays in `localStorage`

Date: 13 November 2026 · Status: accepted (architect); detail in `docs/ARCHITECTURE.md`

## Decision

Keep the IndexedDB outbox, replay on app open and on reconnect, and 409 becomes a draft. No Background Sync, so the service worker never needs the token. This departs from SPEC §7's wording (token in IndexedDB).

## Why

Background Sync is Chromium-only (SPEC §5a), so page-driven replay is needed anyway; moving the token buys nothing.

## Rejected

- Background Sync as the replay path.
- Moving the token to IndexedDB for the service worker.
