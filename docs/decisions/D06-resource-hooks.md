# D6 — One `defineResource` builds the data hooks

Date: 13 November 2026 · Status: accepted (architect); detail in `docs/ARCHITECTURE.md`

## Decision

`defineResource({ key, path, schema })` returns list, one, create, update and disable hooks on TanStack Query, with keys and invalidation in one place. `useCommand` sends ticket commands with idempotency key, optimistic update and outbox. No `fetch` or query key outside `apps/web/src/data/`.

## Why

Keeps screens thin and makes a renamed field a compile error.

## Rejected

- Per-screen fetch code (today).
- A generated API client: needs an OpenAPI document we do not produce.
