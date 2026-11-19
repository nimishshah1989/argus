# Emil Kowalski's skills (vendored)

- Source: Emil Kowalski's skills repository, `skills/` folder (20 skills).
- Commit: 64eb3de, copied 2026-11-19.
- Licence: MIT, Copyright (c) 2026 Emil Kowalski (see LICENSE beside this file and in each copied skill folder).
- Copied unchanged into `.claude/skills/<name>/`, each with the upstream `LICENSE`: `prototype` (with `PICKER.md`),
  `emil-design-eng`, `apple-design`, `break-ui` (with `CATALOG.md`), `mobile-native`, `animation-performance`,
  `review-animations` (with `STANDARDS.md`), `learn-taste`.
- Left out (12): `animate`, `improve-animations`, `find-animation-opportunities`, `choreograph`, `remove-animations`,
  `animation-vocabulary`, `gestures`, `pick-ui-library`, `ask-emil`, `ask-sonner`, `animate-expo`, `write-swift`.
  Reasons are in `docs/slices/80-design-foundations.md` section C.
- `prototype`, `learn-taste` and `review-animations` set `disable-model-invocation: true`: builders read them, and
  only Nimish types `/prototype`.
- Local changes: none yet. Packet 80b adds one line to `learn-taste` naming `docs/DESIGN.md` and `PRODUCT.md`; this
  file will say so then.
- To update: copy the same folders from a newer commit and change the commit line above.
