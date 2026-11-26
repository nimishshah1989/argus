# ADR 0053: The kit form draws a short choice as a bar of buttons

Date: 26 Nov 2026 · Decided by: planner (unattended, PR #824 red e2e; assumption recorded here)

PR #824 (ticket #790) failed `e2e/settings-registers.spec.ts`: it clicks the `AMC` button in the Add register item form. v1's `patterns/form-sheet.tsx` draws a `choice` field with up to four choices as a segmented bar and more as a menu; the v2 kit's `ui/v2/form-sheet.tsx` drew every choice as a menu. ADR 0044 asked the kit for v1's form behaviour, so the kit was wrong, not the spec.

## Decision

- The kit `Field` keeps v1's rule: a `choice` with four or fewer choices is the kit `Segmented` bar (a labelled `role="group"` of `aria-pressed` buttons); five or more is the kit `SelectField` menu.
- Pinned by `apps/web/src/ui/v2/form-sheet.test.ts`. The registers e2e spec is unchanged.

## Consequence

No merged screen used the kit form yet, so nothing live changes. Every later Settings ticket on the kit (#789, #791–#795) gets v1's bar for short choices (asset kind, roster level, ladder channel, login kind) and its e2e specs that click those buttons keep passing; a builder must not swap them for a menu.
