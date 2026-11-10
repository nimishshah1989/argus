# M1a — Ticket core (sliced)

The full ticket state machine, figures and permissions in `packages/domain`, then the API and faces. Built as vertical sub-slices, each merged on green:

- **M1a-1 figures** — the exact derived-figure engine (the answer-key dependency).
- **M1a-2 permissions** — the §3 matrix as pure functions.
- **M1a-3 state machine** — `transition()` for every command in §2.
- **M1a-4 tickets API** — commands, idempotency, row locks, `/state`, `/tickets/{id}`.
- **M1a-5 floor and desk** — the real faces on top of the API.

This file is the umbrella; each sub-slice keeps its own plan.
