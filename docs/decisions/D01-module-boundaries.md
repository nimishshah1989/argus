# D1 — Module boundaries and how CI enforces them

Date: 13 November 2026 · Status: accepted (architect); detail in `docs/ARCHITECTURE.md`

## Decision

Thirteen server modules in `apps/server/src/modules/`, each with one published `index.ts`; every table has one owner; SQL only in a module's `repo.ts`. Enforced by (1) declared `workspace:*` dependencies and `exports` maps with the root `tsconfig` aliases removed, (2) ESLint core `no-restricted-imports`, (3) a new `tools/check-boundaries.ts` that reads `modules/manifest.ts` (tables owned, modules callable, dated exceptions).

## Why

The harness requires boundaries enforced in CI. Table ownership is the rule that matters and only a repo-specific check can see it. No new dependency (`docs/LEAN.md`).

## Rejected

- `eslint-plugin-boundaries`, `dependency-cruiser`: new dependencies, and neither checks which table a query names.
- One package per module: thirteen more `package.json` files for no extra safety.
