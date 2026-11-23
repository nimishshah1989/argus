# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-23 · **By:** Plan · **Model:** claude-opus-5-5
**Milestone:** adoption (next: M1 Stabilise) · **Branch:** plan/loop-adopt · **PR:** the PR for this branch

## State

- Tests: CI on #546 (Linux): fast suite `pnpm exec vitest run packages/domain packages/shared apps/web/src tools`
  307/307 test files pass; `pnpm typecheck` passes; `pnpm lint` passes (7 warnings). On macOS 8 tests and typecheck
  fail (case-only file name clash, see LESSONS.md). Full Postgres suite and e2e run in `ci.yml` only (Docker).
- Last thing done: adoption: PROJECT.md (as built, M1–M5), GLOSSARY.md, 19 screen snapshots in `design/wireframes/`,
  `docs/loop/STATE-FOR-NIMISH.md`, ADR 0011. #546 (loop init) merged.

## Next step

First: `gh pr checks 547`; when green, `gh pr merge 547 --squash`. Then, after Nimish reads PROJECT.md and runs `loop approve --all`: `loop-ticket` M1 (Stabilise) into GitHub Issues, starting
with G1.1 (case-clash guard + renames) so a Mac can run the checks.

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

- PROJECT.md, GLOSSARY.md, LESSONS.md, HANDOFF.md, design/wireframes/S01–S19, docs/adr/0011, docs/loop/STATE-FOR-NIMISH.md,
  docs/HANDOFF.md (superseded note), .prettierignore
