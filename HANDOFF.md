# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-25 · **By:** side session "S27-S30 floor/desk/ticket/board" (Sonnet 5.5) · **Model:** Sonnet 5.5
**Milestone:** M2b floor-staff screens S27-S30 · **Branch:** plan/handoff-s27-s30 (context budget)

## State

- Tickets #767 (S27-A), #768 (S27-B), #769 (S28-A), #770 (S28-B), #771 (S29), #772 (S30). ADR 0045, scope files `docs/design/v2/scope/{floor,desk,ticket,board}.md`. Nothing merged, no PR yet.
- Seed `plan/t772` is pushed; #772 body filled by me (`gh issue edit`); `loop prep 772` done; `loop build 772 --bg` running (pid 59043, started ~21:58). Next: `loop wait 772`, `loop finish 772`.
- Seeds 767-771: ALL PUSHED (plan/t767..t771) and all six issue bodies filled (second plan job finished; first one had lost 5 background agents). Not run: no e2e spec was run on the seeds. Plan notes: #770's fetch-guard test stays red until its builder moves the day-report fetch into `v2/desk/Page.tsx` and deletes `MinePanel.tsx`; 767/769/771 likely exceed file budgets (warn-only, ADR 0038); #770 moves `DeskFrame`/`NotAvailable` unchanged from v1 `Shell.tsx` into `v2/desk/Frame.tsx` (no ADR). After 767/769 merge, plan adds the lists/team takeaways to `insight-coverage.test.ts`.
- Seed notes: `/Users/nimishshah/Library/Application Support/Claude/side-session-notes/local_b73c706f-37c7-4232-b531-35590236458c` (approvals patch etc.). Coordinator session local_8ef44b35 is archived; report to local_b73c706f.

## Next step

1. Seeds are ready: `loop prep N` + `loop build N --bg` in order 767, 769, 771, (772 already), 768, 770 (768 needs 767 merged, 770 needs 769, 771 needs 769), two at a time while `uptime` load < ~10 (load was spiking to 60+ from other sessions).
2. `loop wait N`, `loop finish N`, reviewer subagent on green, merge on PASS, `loop clean N`. Each PR carries `## Coverage` from its scope file; "Unbuilt from the wireframe" items need Nimish's written yes before merge.

## Blocked

None.

## Don't repeat

- Never run seed writing as background agents inside `loop plan`: they die when the plan process exits.
- Builders (dontAsk): no heredocs, `>`/`>>`, `( )`, `{a,b}`, `$?`. Handoff `## Blocked` must read exactly "None.". No `git merge` in `.loop/wt/N`: use `gh pr update-branch <PR>`.
- The loop stop hook about a stale HANDOFF.md fires falsely when this session committed nothing; ignore.
