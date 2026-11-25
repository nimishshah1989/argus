# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-25 · **By:** side session "S27-S30 floor/desk/ticket/board" (Sonnet 5.5) · **Model:** Sonnet 5.5
**Milestone:** M2b floor-staff screens S27-S30 · **Branch:** plan/handoff-s27-s30 (context budget)

## State

- Tickets #767 (S27-A), #768 (S27-B), #769 (S28-A), #770 (S28-B), #771 (S29), #772 (S30). ADR 0045, scope files `docs/design/v2/scope/{floor,desk,ticket,board}.md`. Nothing merged, no PR yet.
- Seed `plan/t772` is pushed; #772 body filled by me (`gh issue edit`); `loop prep 772` done; `loop build 772 --bg` running (pid 59043, started ~21:58). Next: `loop wait 772`, `loop finish 772`.
- Seeds 767-771: first `loop plan` job only finished 772 (its 5 background seed agents died when the plan session exited). A second job (background task bk31xn7m2, started ~21:56) is finishing them from the uncommitted work in the old scratchpad worktrees `.../scratchpad/seed-767..771`, told to stay in the foreground until all five are pushed and all five issue bodies filled. Check `git ls-remote --heads origin 'plan/t76*' 'plan/t77*'` and `gh issue view 767` (stub body = "Seed in progress"). If it died again, re-run it once with the same text ("Finish the half-written seeds ... FOREGROUND subagents only"); a second death is BLOCKED.
- Seed notes: `/Users/nimishshah/Library/Application Support/Claude/side-session-notes/local_b73c706f-37c7-4232-b531-35590236458c` (approvals patch etc.). Coordinator session local_8ef44b35 is archived; report to local_b73c706f.

## Next step

1. When seeds land: `loop prep N` + `loop build N --bg` in order 767, 769, 771, (772 already), 768, 770 (768 needs 767 merged, 770 needs 769, 771 needs 769), two at a time while `uptime` load < ~10 (load was spiking to 60+ from other sessions).
2. `loop wait N`, `loop finish N`, reviewer subagent on green, merge on PASS, `loop clean N`. Each PR carries `## Coverage` from its scope file; "Unbuilt from the wireframe" items need Nimish's written yes before merge.

## Blocked

None.

## Don't repeat

- Never run seed writing as background agents inside `loop plan`: they die when the plan process exits.
- Builders (dontAsk): no heredocs, `>`/`>>`, `( )`, `{a,b}`, `$?`. Handoff `## Blocked` must read exactly "None.". No `git merge` in `.loop/wt/N`: use `gh pr update-branch <PR>`.
- The loop stop hook about a stale HANDOFF.md fires falsely when this session committed nothing; ignore.
