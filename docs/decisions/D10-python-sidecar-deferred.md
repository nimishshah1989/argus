# D10 — No Python sidecar until a named trigger

Date: 13 November 2026 · Status: accepted (architect); detail in `docs/ARCHITECTURE.md`

## Decision

The statistics SPEC §5a lists (Weibull, Kaplan-Meier, Crow-AMSAA, Poisson regression) are written in TypeScript in `packages/engine`. No Python container is added. Trigger: an accepted ticket needs a model that cannot be written and tested in TypeScript within one slice; then it arrives behind the engine's interface with its own decision.

## Why

ADR 0001 already defers it; M4a is exact reproduction of existing JavaScript calculations.

## Rejected

- A sidecar from the start of M4: a second runtime, image and deploy with no ticket that needs it.
