# HANDOFF

> **24 Nov 03:15 — ADR 0016 (Nimish: yes to all):** Breakdown Log Excel keeps both ticket columns, screen + CSV show one (G1.2a unblocked); draft Shift KPIs + Energy wireframes for his approval; answer key stays frozen (ties ordered by date then ticket); budget 150k; helpers = `helper` (Sonnet), never general-purpose.

> **Read ADR 0012 first.** Nimish is away; the loop runs unattended. Plan decides §6 (ADR each) except answer-key changes, production, money, irreversible data steps. **ADR 0015:** M1 closed without G1.2a and Shift KPIs/Energy G1.4.

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-24 · **By:** Plan · **Model:** claude-opus-5-5
**Milestone:** M2 Finish the analytics redesign (building) · **Branch:** plan/handoff-m2-dc2

## State

- Merged this session (reviewer PASS, CI green): **#574** DC-1 adapter (#572 closed), **#575** TF-1 notes server (#573 closed), #577 handoff.
- **#578 DC-2** (Data Checklist goes live, deletes v1; ADR 0019 on seed `plan/t578`, rebased onto main at `bbd1905b`): attempt 1 failed only on Prettier of `docs/loop/handoff/578.md`; attempt 2 passed local checks → PR **#582**, CI red on loop-guard + pr-meta (not read yet; likely stale `Plan-base` (seed was rebased to `bbd1905b`) and the thin PR body). Fix body (copy #574), set `Plan-base: bbd1905b…`, empty commit from a `/tmp` worktree, `loop ci 582`, reviewer, merge.
- **TF-2 #579** (adapter, not routed; seed `plan/t579` `acada198`, files<=5 lines<=320) and **TF-3 #580** (route + save status/owner/note + v1 delete; seed `plan/t580` `8f81206f` on top of t579, blocked by #579). ADR 0020 on the seeds. **Check first:** the planner says it _changed the answer-key test_ so the engine can publish `period` without regenerating the frozen key — answer-key changes are Nimish-only (ADR 0012); verify that test change doesn't weaken the key check before building #579. Overlaps with #582: i18n index, `live.tsx`, `live-frame.tsx`, `live.test.ts`, `today-tabs.test.ts`, `Analytics.tsx` (keep both sides). Open: Dashboard banner counts all actions open; overload/suggested-owner rules need Nimish.

## Next step

1. Finish #578 (above). 2. TF-2 ticket → build → merge. 3. Compare CMP-1..4 (server pair input first; `compareFigure` `compare.ts:300` picks the pair itself).

## Blocked / open questions

- **G1.2a needs Nimish:** duplicate ticket column pinned by the frozen answer key (`workbook-export.json`).
- **Shift KPIs + Energy, Money Matters, Reports, Guide:** new wireframes need Nimish's sign-off.
- **For Nimish (ADR 0019):** live Data Checklist shows one control the S16 wireframe doesn't draw (the standard drill button under the verdict, for v1 parity). Gallery markup unchanged.
- Compare "Spares cost ₹ 0" placeholder: product call. Nimish (old): branch protection; answer-key last digit; support tickets 0 downtime.

## Follow-ups (from reviewers, not ticketed)

- DC adapter: bd_mach check prints the engine sentence `machine ID "<raw id>" not found` as plain text; `daysSince` rolls impossible dates (31-02) forward instead of `—`.
- TF-1 test: assert the audit line's `login_id` in `team-focus-notes.test.ts`.

## Don't repeat

- `changes/<N>-*.md` is needed on **every** PR, plan PRs too (changelog:check). Plan PR bodies need Q1–Q16 + 3 sections + "No parity:".
- A route-count bump in `reply-contract.test.ts` reads as "removed assertion": put `Tests removed: <reason ≥10 chars>` in the PR body.
- A seed cut from an unmerged ticket branch conflicts after squash-merge: `git rebase --onto origin/main <old-base>` in a `/tmp` worktree, force-push `plan/t<N>`.
- Git commands in a `/tmp` worktree: start the Bash call with `cd /tmp/<wt> &&` (a call starting in the main checkout trips the "on main" hook).
- Builders forget Prettier on their handoff note: tickets should say `pnpm exec prettier --write docs/loop/handoff/<N>.md`.
