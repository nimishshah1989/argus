# pstack (vendored)

- Source: https://github.com/cursor/plugins, path `harness/pstack/claude-code` (the Claude Code build).
- Commit: 3dbd22ff12742fb28c9700b9760baa29ed41dc13 (pstack 0.15.36), copied 2026-11-14.
- Licence: MIT, Copyright (c) 2026 Lauren Tan (see LICENSE beside this file).
- Copied: every skill in `skills/` into `.claude/skills/<name>/`, and `agents/poteto-agent.md`,
  `agents/comment-sicko.md` into `.claude/agents/`.
- Left out: `skills/statechart/scripts/test/` (3.8 MB test corpus of the upstream tool) and `docs/` (guide images).
- Model choices for Argus stay in `.claude/rules/pstack-models.md` (D23).
- Vendored as project skills, so the names have no `pstack:` prefix: `/pstack:poteto-mode` in our docs is
  `/poteto-mode` here, `/pstack:interrogate` is `/interrogate`.
- To update: copy the same path from a newer commit and change the commit line above.
