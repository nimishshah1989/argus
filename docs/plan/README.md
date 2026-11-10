# Plan

| File | Holds |
|---|---|
| `backlog.md` | Every ticket, one per row, with dependencies, acceptance criteria and `verification: auto | gate-manual | external` |
| `STATUS.md` | What the last session did, what is in progress, what is next (short; the full state is in `docs/HANDOFF.md`) |
| `NEEDS.md` | Every input only Nimish or Bhavin can supply, with the exact format needed |
| `gates/M0.md`, `M1a.md`, ... | The gate report: scope done and not done, parity counts, test counts, open questions, ten steps to try, risks, go/no-go |

Session 1 writes these. A ticket that hits an external dependency is marked `blocked-external` and the next unblocked ticket is taken.
