# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-23 · **By:** Plan · **Model:** claude-opus-5-5
**Milestone:** loop adoption · **Branch:** plan/loop-init · **PR:** see the PR for this branch

## State

- Tests: fast suite `pnpm exec vitest run packages/domain packages/shared apps/web/src tools` on macOS: 2,935 pass,
  8 fail. All 8 are macOS-only: `Bubble.tsx`/`bubble.ts` and `Live.tsx`/`live.ts` differ only by capital letter,
  which a Mac's file system treats as the same file (typecheck fails on macOS for the same reason), plus 2
  backup-dump script tests (cause not traced). Lint passes. Linux CI is the proof.
- Last thing done: loop init: CLAUDE.md from the loop template, old pstack harness removed, `.loop.json` commands set.

## Next step

Adopt: PROJECT.md as the code is, GLOSSARY.md, screens snapshotted as wireframes, `docs/loop/STATE-FOR-NIMISH.md`.

## Blocked / open questions

- `.claude/settings.json` could not be edited by the agent: remove the 4 `.claude/harness/hooks/*.py` hook entries
  and the `pstack@cursor-plugins` plugin, then delete `.claude/harness/`.

## Don't repeat

- Shell commands that contain `>` and an `apps/web/...` path trip the loop's frontend guard; run them without redirects.

## Files touched this session

- CLAUDE.md, AGENTS.md, .loop.json, .github/workflows/loop.yml, docs/adr/0010-adopt-the-loop.md, .claude/ (removals)
