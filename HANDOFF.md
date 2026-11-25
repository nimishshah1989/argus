# HANDOFF

_Overwritten at the end of every session. Facts only._

**Updated:** 2026-11-25 9:45 · **By:** Coordinator (Sonnet), 5th session in the chain · ended on the context budget (a big attempt-notes dump), not on a problem.

## State

- The CSS-seed plan job FINISHED (no PR; it only pushed seed branches). Seeds with their stylesheet are on origin: plan/t685, 686, 691, 692, 694, 697, 699, 700, 704 (each "Seed #N: kit stylesheet written by Plan"). Ticket bodies now say the CSS is "already written in the seed; do not edit it".
- I added a "Builder shell rules" line (Write/Edit only; one simple Bash per call; no heredocs/redirects/subshells/braces/$?; CSS is already on the seed) to the Don't section of issues 685, 686, 691, 692, 694, 695, 696, 697, 699, 700, 704. Not yet added: 687, 701, 705+ (not needed yet).
- Nothing merged this session. Open PRs unchanged: #731 (#701), #726 (#687), #707 (#643), #300 parked. Merged earlier in the lane: #718, #720, #727, #728, #729, #730, #733.
- **#686** (fresh build folder from the new seed, attempt 1 of 3 used): the builder did the tsx and DONE; `loop finish 686` failed ONLY on `prettier --check` of its own `docs/loop/handoff/686.md`. Fix: `loop prep 686` (keeps folder, brief carries the note) then `loop build 686`; or the quicker route: tell the builder to run `pnpm exec prettier --write docs/loop/handoff/686.md` as its last step. Then `loop finish 686`.
- **#691** builder ended BLOCKED: the seed's `action-strip.css` sets a `transition` on `.v2-strip` with no `@media (prefers-reduced-motion: reduce)` rule, so `apps/web/src/ui/v2/language.test.ts` ("turns every animation and transition off under reduced motion") fails. Only 691's seed has a transition (checked the 9 seed diffs). Needs `loop plan "Fix the seed on plan/t691: add the reduced-motion rule for .v2-strip to action-strip.css"`, then `loop prep 691 --fresh` and build again. 691 build folder holds the finished tsx (not pushed).
- Untouched and ready to build (seed + CSS in place): 685, 692, 694, 697, 699, 700, 704. 695/696 wait for 694. 692's old build branch has tsx only; use `loop prep N --fresh` so the new seed is picked up.

## Next step

1. Fix 686 (prettier line above), finish, CI, reviewer, merge. Plan job for 691, then rebuild.
2. Build 697 and 699 next (two at a time, only when `uptime` load is under ~10), then 685, 700, 704, 692, 694 (then 695, 696). Then `loop plan "Seed issue 732"` for the ADR 0036 sweep.
3. Final 5-line report to Nimish: merged, what he can click on staging, what needs him, screens done (52 v2 screen folders exist; NOT checked that each is routed and live — check before quoting a number).

## Blocked (stop rule: no further attempt without Nimish's word)

- #701 (PR #731): needs origin/plan/t701 (c8509f4c) merged into its build branch, then commit and finish. #687 (PR #726): ticket rule 1 vs hidden test compare/holdout/tables-edges.test.ts, plan must change one. #643 (PR #707): merge plan/t643-e2e (a6521bc) into the build branch, delete the spares note line at machine/View.tsx:149, set PR body `Plan-base: a6521bc6b7e24790b6ff1dfdb5000bc542a26995`, `loop ci 707`.
- Follow-ups for plan from #698 review: amber watch tone never shows (no CSS on `data-status` in `.v2-ref`); guard `count <= 0` lets NaN through (use `!Number.isInteger(count) || count <= 0`, add holdout test).

## Don't repeat

- `loop prep N` keeps an old build folder and its OLD seed. When the seed changed, use `loop prep N --fresh` (also resets the attempt count).
- #686's first 3 attempts failed on `packages/domain/test/engine-scale.test.ts` (20 s limit): it takes 9 s on an idle Mac and 23–26 s at load 14–20. It is a load flake, not a builder fault. Never run more than two builders at once; wait for load under ~10 first.
- Never run `cat .git/loop/tickets/N.json` or any command that dumps attempt notes: they are huge ANSI test logs and cost ~30k tokens. Use `loop prep N | grep attempts_so_far`.
- A `Monitor` with `pgrep -f "<text>"` matches itself; wait on a pid with `kill -0`.
- Builders run in dontAsk mode (no heredocs/redirects/subshells/braces/$?). They must run `pnpm exec prettier --write docs/loop/handoff/<N>.md` after writing their handoff. Never write a ticket number like #693 in a code comment (loop-guard reads it as a hex colour).
- The hook blocks any command that names a build folder path (even `ls`). merger.sh can merge green PRs before the reviewer finishes; a FAIL then needs a follow-up issue.
- Commit handoffs from a detached worktree: `git worktree add --detach`, `git -C`, `git push origin HEAD:plan/handoff`. Start every command with `cd /Users/nimishshah/argus &&`.
