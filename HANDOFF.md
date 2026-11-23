# HANDOFF

> **Read ADR 0012 first.** Nimish is away; the loop runs unattended. Plan decides §6 (ADR each) except answer-key changes, production, money, irreversible data steps. **ADR 0015:** M1 closed without G1.2a and Shift KPIs/Energy G1.4.

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-24 · **By:** Plan · **Model:** claude-opus-5-5
**Milestone:** M2 Finish the analytics redesign (building) · **Branch:** plan/lint-runs-prettier

## State

- **#572 DC-1** (Data Checklist live adapter, ADR 0017) → PR **#574**: CI green, **reviewer FAIL** (spec bug, see issue #572 comment): unregistered machine id becomes a machine chip. Build folder `.loop/wt/572` kept; attempts used: 2 of 3.
- **#573 TF-1** (Team Focus notes server, ADR 0018) → PR **#575**: CI red on api (4/5), browser (5/5), pr-meta. Not looked at yet. Seed already carries the changes note.
- `.loop.json` lint_command now also runs `pnpm format:check` (this PR).
- Not ticketed yet: DC-2 (route Data Checklist + delete v1), TF-2 (Team Focus screen reads/writes notes), Compare CMP-1..4.

## Next step

1. #574: on `plan/t572` add ADR 0017 line (unregistered machine → plain text, no chip) + a visible test (bd_mach + bd_hrs, same report; no chip carries the id); merge seed into the PR branch, repoint `Plan-base`; `loop prep 572` → `loop build 572` → `loop finish 572` → reviewer.
2. #575: read the failing lines (`loop ci 575`); browser 5/5 may be a flake (rerun); pr-meta = PR body (see below). Then reviewer → merge.
3. Then DC-2, TF-2, Compare (the 24 Nov morning HANDOFF in git history has the facts).

## Blocked / open questions

- **G1.2a needs Nimish:** duplicate ticket column pinned by the frozen answer key (`workbook-export.json`).
- **Shift KPIs + Energy, Money Matters, Reports, Guide:** new wireframes need Nimish's sign-off.
- Compare "Spares cost ₹ 0" placeholder: product call. Nimish (old): branch protection; answer-key last digit; support tickets 0 downtime.

## Don't repeat

- `loop finish` writes a thin PR body: every ticket PR then needs the full template (sections + Q1–Q16, copy #574's body), "No parity:" and, if >800 lines, "Large PR:". Edit the body, then push an empty commit from a `/tmp` worktree of the PR branch (checks read the body from the push event).
- Seeds must list `changes/<N>-<slug>.md` under "Files to change" (CI `changelog:check`), or `loop finish` drops it.
- Builders get Bash denied on chained commands: tickets say "one command per Bash call, start with pnpm/git".
- Ticket PR red on loop-guard with main's files listed → `Plan-base` is stale. Never `gh pr update-branch`.
- Hidden tests go in a `holdout/` folder the test command reaches.
