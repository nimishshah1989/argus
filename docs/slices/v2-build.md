# v2 build contract: how every remaining screen is built (adapter-first, nothing lost)

Applies to every v2 screen from batch 2 on. Read with `docs/HANDOFF.md`, `docs/slices/v2-build.md` (section 5) (recipe, prototype result),
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

## 1b. "needs server" is never a reason to leave out what v1 shows (Nimish, 20 Nov)

If v1 shows something today, the data already exists: find where v1 gets it (endpoint, drill reply, figure) and use the same
source. A v1 feature the v2 screen does not show is `MISSING`, which blocks going live; it is never `needs server`. Rows for NEW
ideas v1 never had are written `later: <idea>` and do not block anything. A real server change is only for (a) a v1 feature whose
data exists in no v1 source (say exactly what), (b) a v1 bug the screen would otherwise copy, or (c) a new screen v1 never had.

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

## 3b. Live in the same PR, old page deleted in the same PR (owner's rule, never negotiable)

The PR that ships a screen wires it to its real route (the same URL v1 used) with live data from the same API and the same role
rules, and DELETES the v1 page: the screen, helpers only it used, its route and its unit tests. v1 e2e assertions are ported to the
v2 screen against the real server (each maps to a coverage row), never dropped. No `?view=classic`, no "Old view" link, no
gallery-only screen. Run the repo's dead-code checks after deleting. If the coverage table still has a MISSING row or a
`needs server` / `needs kit` row that is a v1 feature, build that server or kit change in the same work; if it truly cannot be done now,
the screen does not go live yet, and the PR says what blocks it. The gallery holds kit demos and test fixtures only.

## 4. Before the push and in the PR

- Light checks (web and docs only): `pnpm format:check`, `lint`, `typecheck`, `ui:check`, `pii:scan`, `changelog:check`, the tests
  you touched; Prettier on every file you edit with a script. Anything outside `apps/web`, `docs`, `changes`: full `pnpm precheck`.
- Use `pnpm pr:body` (once merged) for the body; it must carry Q1 to Q16 (`pass`, `n/a — reason`, `fail — finding`; never
  `pending`), `Large PR:`, `Tests removed:`, `No parity:`, `## Coverage`, a `changes/<n>-<slug>.md` fragment. One push per fix round
  (each push cancels and restarts CI). Check the body is yours before you stop. Do not mark the PR ready; the orchestrator does.
- Five screens per PR. If the inventory of a screen is large, say so and cut to four rather than drop scope.
- No real names, phone numbers or screenshots in the repo. Screenshots go to a scratch folder, never the shared `shots/` folder wipe.

## 5. Lessons (so nobody repeats them)

- Prototype (Action Center from the real engine reply): the saving is correctness, not code (about 60 lines). Real data shows at once what
  v1 carries that an invented model dropped. Real data is sparse (acknowledgements have empty owners); the engine writes ids into nudge
  titles (UUIDs on staging): map them in the adapter. A value per decision or "hours won back" does not exist in the engine.
- What cost time: PR-body lines CI checks (use `pnpm pr:body`; Q14 and Q16 never `pending`), PRs appending to shared files (now
  self-registering), the gallery job limit (15 min, 4 shards, fonts cached), one Team Focus gallery test that hung in CI and never
  locally (instrumented), two builders fixing the same kit problem (check main before touching a kit file), gate and tests written
  against folders that are not screens (a folder is a screen only with a View.tsx).
- Cost: a builder run is about 300k to 450k tokens; tests are minimal (one smoke on the real server, one completeness test, ported v1 assertions).
- Model for the work: a cheaper model for copying a screen, adapters and fixtures; a stronger one for the coverage inventory, URL and
  history logic, CI changes and the final read of a coverage table against the v1 code.
- Checks before a push (web and docs only): `pnpm format:check`, `lint`, `typecheck`, `ui:check`, `pii:scan`, `changelog:check`; run Prettier on every file edited by script. Anything else: full `pnpm precheck`.

## 6. Lessons from the independent reviews of 20 to 21 Nov (every one shipped once; do not ship it again)

- A drill belongs to the figure it counts: run the engine over `fixtures/answer-key/` and check the rows a drill opens equal that card's number. If v1 put the link on a page action, the v2 control is a page action.
- The answer-key fixture sets every machine's id equal to its code, which hides bugs: re-key the fixture to UUIDs in tests and assert that no UUID reaches a screen, chip, link, title, chart label or export. Look up by id, print the code.
- A figure the engine did not compute says "Not computed yet", never "Nothing to show"; a held figure still gets its tile. A person-scoped answer never reaches another login (cache keyed by login and acting person).
- Keep v1's 30 s refresh. Every v2 screen is the same component in the same place: key pages by screen, and key forms and write state by the row's business key (the ticket, or machine code and day), never by position or by what was typed before.
- A write is paired with its own row by business key; a slow write landing must not close or change another row's form; moves are sent one at a time; the same idempotency key is resent after a dropped connection and a fresh one after any server answer.
- Never delete, rewrite or weaken a v1 assertion: port it to the v2 screen on the real server (`apps/web/e2e/`), and list every assertion that changed in `Tests removed`. A dropped assertion with no equivalent fails the ticket. Check `docs/spec/parity.yaml` cites no deleted test.
- Words: new strings are catalogue keys in en and gu; where v1 had a translated string, reuse its key (a blank Gujarati string on a screen v1 translated is a regression).
- Phone: a wide table must clip its screen-reader text inside its scroll card (a hidden label made a page 686 px wide on a 393 px phone and broke a pointer drag); check 360 px with every disclosure open.
- The real-server e2e needs Docker and runs first in CI; gallery specs run anywhere with a local Chromium (`GALLERY_PROD=off npx playwright test -c <config> <spec>`). A draft PR runs no CI; marking it ready starts it and a push restarts it, so make one push per fix round.
- gitleaks flags a long string literal beside the word `key`: name constants `FIGURE`. The `who-is-acting` /floor ERR_ABORTED and `sla-timers` failures are unrelated flakes (one re-run); `apps/server/test/escalation.test.ts` fails in the half hour before midnight IST (it depends on the clock).
