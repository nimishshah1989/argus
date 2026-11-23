# HANDOFF

> **23 Nov 19:45 — read ADR 0012 first.** Nimish is away; the loop runs unattended. Everything moves to v2 and v1 is deleted; the 97 MISSING coverage items get built in v2 (not waived); Plan decides PROJECT.md §6 itself (ADR per decision) except answer-key changes, production, money and irreversible data steps. Start M1, then the M2 coverage gap.

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-23 · **By:** Plan · **Model:** claude-opus-5-5
**Milestone:** M1 Stabilise · **Branch:** plan/escalation-clock-free · **PR:** the PR for this branch

## State

- Tests: CI on #546 (Linux): fast suite `pnpm exec vitest run packages/domain packages/shared apps/web/src tools`
  307/307 test files pass; `pnpm typecheck` passes; `pnpm lint` passes (7 warnings). On macOS 8 tests and typecheck
  fail (case-only file name clash, see LESSONS.md). Full Postgres suite and e2e run in `ci.yml` only (Docker).
- Last thing done: G1.5 (plan PR, test-only): `apps/server/test/escalation.test.ts` dated its roster lines by the
  wall clock, so a breach 31 min later fell on the next IST date between 17:59 and 18:30 UTC. Roster lines are now
  dated at the breach moment. Proof: with the process clock shifted to 17:59:30 UTC the old file fails 1/49, the new
  one passes 49/49; at real time 49/49. G1.1 ticketed as #551 (seed `plan/t551`).

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

- `apps/server/test/escalation.test.ts` (roster lines dated at the breach), `changes/902-escalation-clock-free.md`, HANDOFF.md.
