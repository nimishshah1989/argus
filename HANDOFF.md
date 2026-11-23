# HANDOFF

> **23 Nov 19:45 — read ADR 0012 first.** Nimish is away; the loop runs unattended. Everything moves to v2 and v1 is deleted; the 97 MISSING coverage items get built in v2 (not waived); Plan decides PROJECT.md §6 itself (ADR per decision) except answer-key changes, production, money and irreversible data steps. Start M1, then the M2 coverage gap.

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-23 · **By:** Plan · **Model:** claude-opus-5-5
**Milestone:** adoption done (next: M1 Stabilise) · **Branch:** plan/handoff-after-adopt · **PR:** the PR for this branch

## State

- Tests: CI on #546 (Linux): fast suite `pnpm exec vitest run packages/domain packages/shared apps/web/src tools`
  307/307 test files pass; `pnpm typecheck` passes; `pnpm lint` passes (7 warnings). On macOS 8 tests and typecheck
  fail (case-only file name clash, see LESSONS.md). Full Postgres suite and e2e run in `ci.yml` only (Docker).
- Last thing done: adoption: PROJECT.md (as built, M1–M5), GLOSSARY.md, 19 screen snapshots in `design/wireframes/`,
  `docs/loop/STATE-FOR-NIMISH.md`, ADR 0011. #546 (loop init) and #547 (adoption) merged; main = ee35dde8.

## Next step

Waiting on Nimish: read `docs/loop/STATE-FOR-NIMISH.md` and PROJECT.md, answer §6, run `loop approve --all`. Then
`loop-ticket` M1 (Stabilise) into GitHub Issues, starting with G1.1 (case-clash guard + renames) so a Mac can run the
checks. Backend-only M1 tickets need no wireframe approval and may start before it.

## Blocked / open questions

- Nimish: branch protection command (session permission refused), `.claude/settings.json` clean-up (4 old hook entries and
  the `pstack@cursor-plugins` plugin; then delete `.claude/harness/`), the decisions in PROJECT.md §6.
- `db/schema.sql` not dumped: needs a Postgres (`pnpm migrate` then `pg_dump --schema-only`).

## Don't repeat

- Shell commands containing `>` plus an `apps/web/...` path trip the loop's frontend guard; run them without redirects.
- `/gallery` sections (floor, board) and `?view=desktop` don't snapshot on staging (missing or behind sign-in).
- Wireframes were made by `/tmp` Playwright scripts against the staging gallery; re-snapshotting changes the hash and
  voids approval.

## Files touched this session

- HANDOFF.md only (state refresh after #547 merged).
