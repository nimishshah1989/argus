# v2 build contract: how every remaining screen is built (adapter-first, nothing lost)

Applies to every v2 screen from batch 2 on. Read with `docs/HANDOFF.md`, `docs/plan/v2-next.md` (recipe, prototype result),
`docs/design/v2/UX-RULES.md` (section 11), `LANGUAGE.md`, `COVERAGE.md`, `docs/slices/entity-links.md`.

## 1. Inventory before design (the rule that stops scope loss)

1. Read the screen's v1 file(s), its e2e spec in `apps/web/e2e/`, its section of `docs/spec/SPEC.md`, `docs/spec/PARITY.md` and
   the engine reply it consumes (`packages/shared`, `packages/domain`, the server route). List every figure, column, filter,
   sort, drill, export, explanation, state, link and role-dependent view.
2. Write that list as the coverage table `docs/design/v2/scope/<screen>.md` (format in `COVERAGE.md`; the column that says what v2
   does is named `v2` and says same / moved / better / MISSING / DROPPED). MISSING or DROPPED needs `Nimish said yes: <date>`;
   you never decide it. Put the same table in the PR body under `## Coverage`.
3. A second table, **More intelligent**: what this screen can now say that v1 could not, each with its data source (a table in
   `docs/DATA-MAP.md` or an engine figure) and whether the engine computes it already. Build the cheap ones that the engine
   already computes. Where the engine would need new work, write the row `needs server: <what>`; do not invent the number.

## 2. Data: the real reply, not invented rows

- The screen's model is built from the engine reply v1 already uses, by a small pure adapter `screens/v2/<name>/adapter.ts`
  (reply plus words in, model out). The adapter is the only place that renames, formats or derives. Every field of the reply is
  either shown, mapped on purpose, or listed in the coverage table with the reason it is not.
- Test data is the real-shaped reply: run the real engine over the frozen answer keys in `fixtures/answer-key/` (see how the
  server tests do it) or record a reply; do NOT invent plants, people or totals. Test behaviour: every reply field is shown or
  mapped (a completeness test), the states (loading, empty, error, no-results), the drawer and Back. Do not write totals tests for
  the engine's own numbers; the engine has its own.
- Known display bugs live in the adapter, once: machine ids in titles become codes, floats are formatted, UUIDs never reach the
  screen. If the server must change (a value per decision, daily snapshots, codes in titles), write `needs server: <what>`.
- Role and money: rupee figures only for head, plant head and admin (parity). Never show money to other roles.
- Words: every visible string is a catalogue key in en, gu and hi (the adapter takes words as input).

## 3. Screen shape (unchanged from the Dashboard pattern)

`screens/v2/<name>/{model.ts, adapter.ts, View.tsx, <name>.test.ts}`, `EntityShell` (never `Shell`), kit parts only, every machine, cell,
person, decision an `EntityChip`, every figure opens the rows behind it through the kit's rows-behind panel (once it lands; until
then list it as `needs kit: rows-behind`), designed loading, empty, error and no-results states, 10-row tables with search, sort and
filter chips, Indian number format, DD-MMM-YYYY dates, a source and as-of line. Registers itself (no shared-file edits) once the plumbing
is merged; a gallery view `gallery/v2-<name>-view.tsx` and one e2e smoke (loads, a drawer opens, Back closes it, axe light and dark).

## 4. Before the push and in the PR

- Light checks (web and docs only): `pnpm format:check`, `lint`, `typecheck`, `ui:check`, `pii:scan`, `changelog:check`, the tests
  you touched; Prettier on every file you edit with a script. Anything outside `apps/web`, `docs`, `changes`: full `pnpm precheck`.
- Use `pnpm pr:body` (once merged) for the body; it must carry Q1 to Q16 (`pass`, `n/a — reason`, `fail — finding`; never
  `pending`), `Large PR:`, `Tests removed:`, `No parity:`, `## Coverage`, a `changes/<n>-<slug>.md` fragment. One push per fix round
  (each push cancels and restarts CI). Check the body is yours before you stop. Do not mark the PR ready; the orchestrator does.
- Five screens per PR. If the inventory of a screen is large, say so and cut to four rather than drop scope.
- No real names, phone numbers or screenshots in the repo. Screenshots go to a scratch folder, never the shared `shots/` folder wipe.
