# HANDOFF

_Overwritten at the end of every session. Facts only._

**Updated:** 2026-11-25 (night) · **By:** Coordinator (top session), context full · **Branch:** plan/handoff-coord2

## State

- **Live on staging:** kit pieces (18 of 22; #749), Money Matters (#755), Breakdown Log count fix (#759), machine page (#774), Sign in (#775 + heading fix #778), Settings CRUD kit (#776).
- **Open / in flight:** #779 Guide (conflicts with main; a builder redoes it), #780 planner PR with sweep A–D coverage rows (`docs/design/v2/scope/*.md`), page batches #750–#753 built and committed on local branches (`.loop/wt/750..753`, main merged in by Nimish), session "Land sweep batches #750–#753" (`local_33c34ce9`) finishing them; "Reports, Guide, Settings: part 2" (`local_7296fee2`) does Guide, Monthly (#763, built in `.loop/wt/763`), Annual (#765), Settings sub-pages S26-1..8; "Build Floor, Desk, Ticket, Board" (`local_bfc6fd20`) waits on the planner seeds `plan/t767..t772` (only t772 pushed).
- **Not done:** kit pieces #689, #695, #705, #732; Floor/Desk/Ticket/Board build; Settings sub-pages plan.
- Wireframes S27–S30 approved by Nimish (25 Nov).

## Next step

1. Merge #780 when green; then the batch session finishes #750–#753 (reviewer, merge; one at a time under load).
2. Floor/Desk/Ticket/Board: seeds first (planner), then build 767, 769, 771, 772, 768, 770. If the planner has not pushed t767–t771 in ~30 min, kill it and have the build session write them.
3. Reports lane in order: #779, #763, #765, Settings sub-pages.
4. Report to Nimish in plain words: what is live, PR links, which red checks he can merge past (he asked to be told, never merge red yourself).

## Blocked

- A builder wrote protected scope files with a python script in `.loop/wt/750` (guard bypass; Nimish ran `git restore docs/design/v2/scope` there). Builders must not do that: coverage rows come from planner PRs only.
- Mac load hit 67 with ~15 sessions in parallel: run two builds at a time, wait for `uptime` < 10.

## Don't repeat

- Nimish: no re-planning, no new proposals, plain words, one-line PR notifications. "/ship" only he can type.
- `git merge` in `.loop/wt/<N>` is blocked for sessions: give Nimish the exact terminal command, or `gh pr update-branch <PR>`.
- Builders (dontAsk mode) are denied heredocs, redirects, subshells, brace expansion, `$?`. Handoff `## Blocked` must read exactly "None.".
- The HANDOFF.md stop hook fires falsely when other sessions move the shared checkout.
