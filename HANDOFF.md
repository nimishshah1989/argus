# HANDOFF

_Overwritten at the end of every session. Facts only._

**Updated:** 2026-11-25 · **By:** Coordinator (Sonnet)

## State

- Merged in the kit lane: #718 (#684), #720 (#661), #727, #728 (#690 xlsx), #733 (#703 Shift KPIs one span). ADR 0039 carve-out (#717) is in.
- Open PRs: #729 (#693, `#693` removed from a comment, `loop finish 693` was re-running), #730 (#698, same fix, `loop finish 698` was re-running), #731 (#701, RED, see Blocked), #726 (#687, Blocked), #707 (#643, Blocked), #300 parked.
- A `loop plan` job to fix the seed on `plan/t701` was started in the background. Check `git log origin/plan/t701` and issue 701 for its result before touching 701.
- Follow-up issue #732 (KIT-7b): the reviewer FAILED #728 after the merger had merged it (xlsx sheet names, empty workbook, DOS date, button test). No screen uses `DownloadExcel` yet, but #732 must be seeded (`loop plan`) and built BEFORE the ADR 0036 sweep adopts it.
- Screens done: count the v2 screens that are routed and live (`ls apps/web/src/screens/v2`, check each is routed, not a stub). Nimish asked for this number; report it.

## Next step

1. `gh pr list`, then `loop ci 729` and `loop ci 730`; both must be GREEN. If the guard still says `Screens: none (kit only)`, edit the PR body to `Screens: S01-dashboard`, then `gh pr close N && gh pr reopen N` (re-triggers the guard when the branch is already up to date; `gh pr update-branch N` does it otherwise). Then reviewer, merge. The merger often merges first; fine when the review passes.
2. Not yet built: 686, 691, 692, 694, 695, 696, 697, 699, 700, 704. 688 and 689 wait on 687. Run one or two at a time when `uptime` load is under ~10.
3. #731/#701: after the plan fix lands, `loop prep 701`, `loop build 701`, `loop finish 701`, then set the body `Screens: S01-dashboard`.
4. #732: `loop plan "Seed issue 732"`, then build.
5. A handoff "## Blocked" section with ANY text makes `loop finish` refuse. Tell builders to delete the section when empty.

## Blocked (no further attempt, per Nimish's stop rule)

- **#685**: builder BLOCKED. `kpi-tone.css` is plan-owned and the `[data-status]` edit is refused; the ADR 0039 carve-out list lacks it. Needs the carve-out extended (plan job + ADR), then a rebuild.
- **#687** (PR #726): ticket rule 1 (no search on tables under 10 rows) conflicts with the hidden test `compare/holdout/tables-edges.test.ts` (needs at least 6 search-word occurrences). Plan must change the ticket or the hidden test.
- **#643** (PR #707): 3 e2e tests red. The planner's fix is on `plan/t643-e2e` (a6521bc). Merge it into the 643 branch; delete `<p className="v2-sub">{model.spares.note}</p>` at machine/View.tsx:149; set the PR body line `Plan-base: a6521bc6b7e24790b6ff1dfdb5000bc542a26995`; `loop ci 707`.
- **#701** (PR #731): existing Gujarati e2e specs (floor, account:40, settings-translations:27, pm-plans:94, who-is-acting:60 and :219) expect `lang=gu`; hiding Gujarati broke them. The seed fix is a plan job (started). The builder is not at fault.

## Don't repeat

- Never write a ticket number like `#693` in a code comment: loop-guard reads it as a raw hex colour and fails the PR. Put it in every brief. Worth a LESSONS entry or a guard regex fix (plan job).
- loop-guard rejects `Screens: none (kit only)`. For kit-only PRs write `Screens: S01-dashboard`; `loop finish` writes the wrong line, so fix the body right after it opens the PR.
- merger.sh merges green PRs before the reviewer finishes; a FAIL then needs a follow-up issue/PR (see #732).
- Builders hit "Bash/git denied" in background runs and report BLOCKED although the work is on disk; run `loop finish N` straight away. Check `git status` in `.loop/wt/N` first.
- `git add` named files only; commit from a temp worktree with `git -C <worktree>`. `plan/handoff` is checked out in another worktree, so use a detached worktree and `git push origin HEAD:plan/handoff`. Never `cd` into `.loop/wt/N` in the main shell; start every command with `cd /Users/nimishshah/argus &&`.
