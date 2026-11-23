# 0011 — PROJECT.md written from the code as it is (loop adoption)

**Date:** 2026-11-23 · **Status:** accepted, pending Nimish's read of PROJECT.md

## Context

ADR 0010 moved Argus to the loop. The loop needs one blueprint (`PROJECT.md`), a glossary and a wireframe for every
screen. Argus already had 37 tables, about 34 screens and a 98-ticket plan (`docs/plan/MILESTONES.md`).

## Decision

- `PROJECT.md` describes the product as built on `e468e31a`; detail stays in SPEC, DATA-MAP, DESIGN and MILESTONES.
- Milestones restart at M1 (Stabilise), M2 (finish the analytics redesign), M3 (history in, figures fast), M4 (floor,
  desk and board redesign + Gujarati), M5 (production). They regroup the old plan's open tickets; the old plan stays as
  the backlog.
- M2 before M3 because the redesign was "the one job" on 20 Nov; listed as an open question for Nimish.
- Schema truth stays `packages/db/migrations/*.sql`. No `db/schema.sql` was dumped: no Postgres was available.
- Wireframes for built screens are self-contained snapshots of the staging gallery (fixture data), so Nimish can approve
  them all with `loop approve --all`. Screens with no gallery view are listed without a snapshot.

## Rejected

- Rewriting the old plan into GitHub Issues now: the issues are already out of sync with MILESTONES (37–67 open but
  done); `loop-ticket` creates fresh issues per milestone instead.
- Hand-drawn low-fidelity wireframes of built screens: a snapshot of the real screen is cheaper and cannot drift from it.

## Consequences

- 15 built screens (6 v2 analytics, 9 v1 faces) have no wireframe; the first ticket that touches one must add it first.
- A `db/schema.sql` dump is still owed (one `pg_dump --schema-only` after `pnpm migrate` on a fresh Postgres).
