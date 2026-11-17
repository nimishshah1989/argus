# Night run: the operating protocol for the autonomous loop

Written 17 Nov 2026 on Nimish's word ("work through the night… a very rigorous goal loop… every ticket has very
specific goals"). It is the contract for any session that continues this work unattended. Read it after
`docs/HANDOFF.md`; the ticket definitions stay in `docs/plan/MILESTONES.md`.

## The end

Finish the core build in this order, **stopping at each milestone gate for Nimish's go**:

1. **M4a — analytics parity** (tickets 36–45; 36, 37 and 38 are done). Current frontier: **39**.
2. **M4b — the loop** (46–54 and 67).
3. **M6 — AI, India only** (55–60).
4. **M3 is out of scope** (Nimish, 17 Nov). The WhatsApp/voice tickets stay parked.
5. **Frontend revamp is a later workstream** (Nimish, 17 Nov): richer visual language, icons/indicators, red-amber-
   green, chart density, coherent analytical screens. Do not start it during the night run; keep building to the
   locked design. Capture anything it needs in `docs/plan/DEBT.md`, not in screens.
6. **Historic registers** (2022/2024/2025) are planned in `docs/plan/history-registers-plan.md` (draft PR #300, which
   Nimish reviews). Its **H1–H5 run beside the M4a tail after ticket 37c**, H6–H7 after the M4a gate, H8–H9 in M4b's
   first window. Consent is settled (N14, 17 Nov); the only precondition is coding the names on the operator's machine
   before any AI pass (H2). Nothing in the night run may load a real register file into the repo.

## The loop, per ticket (non-negotiable)

1. **Read** `docs/plan/MILESTONES.md` for the ticket's goals, blockers and the answer-key file it must match; refresh
   Graphify if the graph is stale.
2. **Plan**: write `docs/slices/<ticket>.md` — scope, files, interfaces, fields, the tests, write areas. A **fresh
   plan review** (`glm-5.3-flash`, never the writer) returns PASS/FAIL before any code. Stop and re-plan on FAIL.
3. **Decompose** into packets: one assertion, ≤3 files, ≤150 changed lines, a named red command and a green command,
   no open design decision. One writer per file area.
4. **Build**: a fresh `subagent` child on `isoquant/deepseek-v4.1-flash-1017-fast` per packet, red first, green
   second, local commits only. It reports red output, green output and deviations.
5. **Verify**: covering suite + `pnpm precheck` locally; then the ticket is a PR. Never delete, skip or weaken a test;
   new behaviour gets a new test.
6. **Review**: a fresh reviewer that did not write the change gets plan + diff + test output and returns PASS/FAIL
   with numbered `file:line` findings. R3 tickets (schema, auth, permissions, tenancy, deletes, money, cutover) get a
   second, different-family adversary who proves findings by running something.
7. **Integrate**: one PR per ticket, rebase on current `main`, one CI run when ready, merge one at a time, then
   `pnpm main:check` and record the result.
8. **Record**: one ledger line per dispatch/ruling/merge; a `changes/` fragment; tracker row updated only for what
   the evidence proves; HANDOFF rewritten when the state changes.
9. **Next**: the next frontier ticket. At a gate, write `docs/plan/gates/<M>.md` (under 30 lines) and **stop** for
   Nimish's go.

## Evidence standard (what "specific goals" means here)

- Every figure ticket: the pure engine test compares each figure to `fixtures/answer-key/<screen>.json` **exactly**
  (no tolerance, no re-rounding) and asserts its drill ids; a live screen shows the values without a fabricated
  number, and "Not computed yet" is the only honest placeholder.
- Every behavioural ticket: the named test fails when the behaviour is removed, proven at least once per ticket by a
  deliberate mutation or a red-first commit.
- A packet that cannot name a red command is not dispatched.
- Server work runs against real Postgres (Testcontainers); screens get one Playwright journey on the real stack.
- The platform's own Guide (`docs/discovery/source/cosmos_platform.html`) is the authority for every formula; when a
  number does not reproduce, stop and report the delta — never tune the formula to fit.

## After each milestone gate: backend architecture review and bug pass

Before starting the next milestone, run one review pass over the backend and fix what it finds (small fixes as their
own PR; large findings become tickets):

- module boundaries and published interfaces (`pnpm boundaries`), raw SQL only in a module's `repo.ts` (D01/D02);
- tenancy and RLS: every tenant table exercised as two tenants, cross-tenant ids answer `not_found`;
- permissions: every route behind the kernel guard, each role's refusal named and tested;
- query shapes: no N+1 on `/state` and list routes; the analytics load timing noted (the drill shortcut's trigger);
- dead code, duplicated logic, files/functions over budget, `shortcut:` comments in the ledger;
- error handling that prevents data loss and every failure naming its state;
- the full suite + `pnpm verify` green, and `pnpm audit:lean` for the gate report.

Record the review in the gate report's evidence and in the ledger. A red `main` gets its own hotfix PR before the
next ticket.

## Budgets, stops, and the handoff

- **Routing (D31):** the coder route writes; planning and reviews run on the second family while the reasoning-route
  key is absent. A 429 or a credit error is a stop, not a retry. Never switch a model silently.
- **Hard stops:** a milestone gate reached (wait for Nimish's go); either budget exhausted; the same finding fails
  three times (the plan is wrong — re-plan); a product decision is needed; an irreversible action (production,
  deletion, outbound message) lacks Nimish's word.
- **Context handoff at ~60%:** finish the ticket in flight (no half-merged work), write `docs/HANDOFF.md` (≤50 lines:
  state, frontier, calls, gaps), append the ledger, leave the persisted goal active with the next frontier named, and
  end the session. A fresh session resumes from those two files and continues this protocol.
- **Queue hygiene:** only this work's PRs; close superseded drafts with a one-line reason; never push to `main`,
  never force-push except a rebased PR branch under `--force-with-lease` after an explicit ruling.
