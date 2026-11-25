# HANDOFF

_Overwritten at the end of every session. Facts only._

**Updated:** 2026-11-25 · **By:** Coordinator (Sonnet), 4th session in the chain

## State

- Merged in the kit lane: #718 (#684), #720 (#661), #727, #728 (#690), #729 (#693), #730 (#698), #733 (#703). #698 reviewer PASS after the merge; follow-ups for plan: the amber watch tone never shows (no CSS targets `data-status` on `.v2-ref`, no icon) and the guard `count <= 0` lets NaN through (use `!Number.isInteger(count) || count <= 0`, add a holdout test).
- v2 screen folders under apps/web/src/screens/v2: 52 (count only, NOT checked that each is routed and live; do that before reporting a "screens done" number to Nimish).
- Open PRs: #731 (#701, red), #726 (#687), #707 (#643), #300 parked.
- A plan job is RUNNING (started 9:22, pid 25882, `loop plan "Seed the missing kit stylesheets..."`): it writes the missing kit stylesheets onto seed branches plan/t685,686,691,692,694,697,699,700,704 so builders only write tsx. Check `git fetch; git log origin/plan/t686` etc. and `pgrep -fl "loop plan"` first. Do not start another plan job on the same seeds while it runs.

## Next step

1. When the CSS-seed plan job has landed, build 686, 691, 697, 699, 700, 704 one or two at a time when `uptime` load is under ~10 (never rebuild the Blocked ones below without Nimish's word). 695/696 wait for 694.
2. Open #732 (KIT-7b) still needs `loop plan "Seed issue 732"` before the ADR 0036 sweep.
3. Final report to Nimish (5 lines): merged, what he can click on staging, what needs him, screens done.

## Blocked (no further attempt, per Nimish's stop rule)

- **#685, #692, #694**: builders BLOCKED; kit stylesheets (kpi-tone.css, severity-row.css, ranked-bars.css) are plan-owned. 692 code is committed on its build branch (36c65b74, 599e540f, tsx only, no PR yet); 694 wrote ranked-bars.tsx, nothing committed. The CSS-seed plan job should fix the cause; a rebuild needs Nimish's yes to the stop rule.
- **#701** (PR #731): seed fix is on origin/plan/t701 (c8509f4c). The haiku builder (loop build 701 --bg) edited i18n/index.ts but ended BLOCKED (Bash denied) and its branch does NOT contain c8509f4c; `loop finish 701` refused (attempt 2 failed, Blocked section in its handoff). Needs: merge origin/plan/t701 into the build branch, commit, finish. That is builder/Nimish territory per the stop rule.
- **#687** (PR #726): ticket rule 1 vs hidden test compare/holdout/tables-edges.test.ts. Plan must change one.
- **#643** (PR #707): merge plan/t643-e2e (a6521bc) into the build branch, delete the spares note line at machine/View.tsx:149, set PR body `Plan-base: a6521bc6b7e24790b6ff1dfdb5000bc542a26995`, `loop ci 707`.
- **Needs Nimish's yes**: the classifier DENIED a plan job that would extend the ADR 0039 carve-out / protected list in .loop.json. Not done, not worked around. Only needed if the CSS-seed job proves not enough.

## Don't repeat

- `loop build N --bg` builders are denied Bash: they cannot run checks or commit and report BLOCKED. Plan for it (finish may refuse because of the Blocked section they write).
- Never write a ticket number like #693 in a code comment (loop-guard reads it as a hex colour). Put it in every brief.
- The hook blocks any command that names a build folder path (git -C inside it is blocked too); the orchestrator cannot merge or edit there.
- merger.sh merges green PRs before the reviewer finishes; a FAIL then needs a follow-up issue.
- Commit from a detached worktree: `git worktree add --detach`, `git -C`, `git push origin HEAD:plan/handoff`. Start every command with `cd /Users/nimishshah/argus &&`.
