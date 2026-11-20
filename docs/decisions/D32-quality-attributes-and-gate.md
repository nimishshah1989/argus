# D32 — Quality attributes and the per-change gate

Date: 17 November 2026 · Status: accepted (orchestrator, on Nimish's request) · Owner: orchestrator · Builds on:
D31 (routes, budgets, quality rails), `docs/QUALITY-BAR.md` (the milestone scorecard), `docs/LEAN.md` (budgets)

## Decision

The quality rails in D31 said _who_ reviews and _how_ work is sized. They did not say, in a fixed checklist, what
a change must satisfy before it may merge — so each session re-derived the same list and missed different items.
That is the repeated instruction `principle-encode-lessons-in-structure` tells us to encode.

1. **`docs/QUALITY-ATTRIBUTES.md` is the per-change contract.** Sixteen numbered attributes (Q1–Q16; Q16 "Scope kept" was added on 20 Nov with the coverage gate), each with a
   definition, the exact runner (`quality`, `CI: api suite`, `CI: gallery` or `review`) and the failure
   condition. The ids are stable and are cited by reviewers, PR bodies and gate reports.
2. **One command runs the automatic set.** `pnpm quality` locally (fast, before a push) and `pnpm quality:pr` in
   the `pr-meta` CI job (needs the PR body; it also fails a PR whose body does not carry the Q table).
3. **The reviewer returns the Q table.** In the `ponytail-review` format, followed by one line per attribute
   (`Q1 pass`, `Q7 n/a — docs only`, `Q3 fail — see finding 2`). A verdict without the table is an incomplete
   review.
4. **A failed attribute blocks the merge.** Never lower an attribute to pass a PR. A waiver is a ledger ruling
   with a cost-if-wrong line, never a silent exception.
5. **Q15 keeps `main` green.** CI deliberately does not run on `main` (Actions minutes, #224), so a red tree is
   otherwise found by the _next_ PR's run, after the queue has already spent a CI run on it. On 17 Nov a stale
   expectation from #206 met #258's criticality default that way and blocked every PR. The queue therefore
   verifies the new `main` after each merge: check it out, run `pnpm main:check` (a mode of
   `tools/check-quality.ts`), and hotfix a red tree before the next merge. `main:check` reads
   `git diff --name-only HEAD~1 HEAD`, keeps the changed `*.test.ts` files, runs them with `npx vitest run`,
   and exits non-zero on a failure.

## Why not fold it into `pnpm precheck`

`precheck` runs the checks a push needs and must stay fast. `pnpm quality` adds what precheck deliberately skips:
test-integrity scanning (Q2), the PR evidence contract (Q12), and the printed Q table a reviewer can copy. Keeping
them separate keeps `precheck` cheap and makes the gate's output auditable.

## Rejected

- **A fifteenth document of prose rules.** The bar and LEAN already exist; the gap was enforcement and a stable
  vocabulary, not more guidance.
- **A new CI job.** Actions minutes are budgeted (Nimish, 14 Nov). The checks ride in `pr-meta`, which already has
  the PR body, at roughly thirty seconds.
- **Scoring every PR out of ten.** The 9/10 scorecard is for milestone gates by a human. A per-PR score invites
  arguing about numbers instead of fixing the failing attribute.
