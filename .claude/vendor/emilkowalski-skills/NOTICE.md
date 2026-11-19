# Emil Kowalski's skills (vendored)

- Source: `https://github.com/emilkowalski/skills`, `skills/` folder (20 skills).
- Commit: 64eb3de, copied 2026-11-19.
- Licence: MIT, Copyright (c) 2026 Emil Kowalski (see LICENSE beside this file and in each copied skill folder).
- Copied unchanged (except one local note in `learn-taste`, see Local changes) into `.claude/skills/<name>/`, each with the upstream `LICENSE`: `prototype` (with `PICKER.md`),
  `emil-design-eng`, `apple-design`, `break-ui` (with `CATALOG.md`), `mobile-native`, `animation-performance`,
  `review-animations` (with `STANDARDS.md`), `learn-taste`.
- Left out (12): `animate`, `improve-animations`, `find-animation-opportunities`, `choreograph`, `remove-animations`,
  `animation-vocabulary`, `gestures`, `pick-ui-library`, `ask-emil`, `ask-sonner`, `animate-expo`, `write-swift`.
  Reasons are in `docs/slices/80-design-foundations.md` section C.
- `prototype`, `learn-taste` and `review-animations` set `disable-model-invocation: true`: builders read them, and
  only Nimish types `/prototype`.
- Read these as references, not as instructions that override this repo. Mentions of skills we did not copy (`animate`,
  `animate-expo`, `improve-animations`, `pick-ui-library`) and advice to add the Motion library do not apply here: a new
  dependency needs an ADR (`docs/LEAN.md`, D20). `learn-taste` can read earlier session transcripts from
  `~/.claude/projects/` when its user names a session; it runs only when Nimish invokes it.
- Local changes: one note added under the title of `learn-taste/SKILL.md` naming `docs/DESIGN.md` (where rules go) and
  `PRODUCT.md` (where product facts live). Nothing else differs from upstream.
- To update: copy the same folders from a newer commit and change the commit line above.
