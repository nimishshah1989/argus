# Coverage: nothing the plant had is lost (Nimish, 20 Nov 2026)

Every v2 screen PR carries this table in its body and in `docs/design/v2/scope/<screen>.md`. It is built
from the v1 screen, its e2e spec and its section of `docs/spec/SPEC.md`, before any design, and re-checked at the end.

| Item (figure, column, filter, chip, sort, drill, export, explanation, state, link, role-dependent view) | Source (v1 file or spec line) | v2  | Where in v2 |
| ------------------------------------------------------------------------------------------------------- | ----------------------------- | --- | ----------- |

- **v2 column:** `same` (same figure, same meaning), `moved` (now in the drawer, a tooltip, another card: say where),
  `better` (same item, more detail or smarter), `MISSING`, `DROPPED`. A renamed or recomputed figure is `changed` and
  needs a line saying why it still means the same thing.
- `MISSING` and `DROPPED` block the PR unless the row says `Nimish said yes: <date>`. The builder never decides.
- A second table, **More intelligent**, lists what the screen now says that v1 could not (rank, peer or fleet
  comparison, trend break, repeat cause, forecast, early warning, rupee impact, confidence), each with its data source
  (a table in `docs/DATA-MAP.md` or an engine figure) and whether the engine computes it already.
- The orchestrator reads the table against the v1 file and spec itself. A builder's "nothing is missing" is a claim, not
  evidence.

## What goes in a builder's brief and in the PR body (a checklist)

- Coverage table filled; MISSING rows listed at the top of the PR under "What must be decided".
- PR body has every line CI checks: Q1 to Q15 each `pass`, `n/a — reason` or `fail — finding` (never `pending`),
  `Large PR:`, `Tests removed:`, `No parity: <10+ characters>` (gallery-only PRs), what changed for a user, how to try it.
- Light checks (CLAUDE.md, Git): `pnpm format:check`, `lint`, `typecheck`, `ui:check`, `pii:scan`, `changelog:check`, the
  tests you touched; Prettier on every file edited by script.
