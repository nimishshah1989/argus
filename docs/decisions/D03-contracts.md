# D3 — Shared Zod schemas are the only contract

Date: 13 November 2026 · Status: accepted (architect); detail in `docs/ARCHITECTURE.md`

## Decision

One schema file per module in `packages/shared`, exposed through one wildcard subpath export (verify the `exports` pattern in current Node docs); no barrel. The server parses and replies through them in the kernel's `route()`; the web takes `z.infer` types. `apps/web/src/api-types.ts` and the DTO copies in `packages/domain` are deleted. `/api/v1` changes are additive; a breaking change is a `/api/v2` path with v1 kept one release. Events and job payloads carry `v`.

## Why

Types are declared three times today and the server replies untyped. Phones run cached builds, so contracts need the same expand-and-contract rule as tables.

## Rejected

- OpenAPI generation: no outside consumer yet (SPEC §6).
- Hand-kept web types.
- Fastify's Zod type-provider: not installed; the existing `safeParse` pattern behind one helper is enough.
