# HANDOFF

> **24 Nov 03:15 — ADR 0016 (Nimish: yes to all):** Breakdown Log Excel keeps both ticket columns, screen + CSV show one (G1.2a unblocked); draft Shift KPIs + Energy wireframes for his approval; answer key stays frozen (ties ordered by date then ticket); budget 150k; helpers = `helper` (Sonnet), never general-purpose.

> **Read ADR 0012 first.** Nimish is away; the loop runs unattended. Plan decides §6 (ADR each) except answer-key changes, production, money, irreversible data steps. **ADR 0015:** M1 closed without G1.2a and Shift KPIs/Energy G1.4.

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-24 · **By:** Plan · **Model:** claude-opus-5-5
**Milestone:** M2 Finish the analytics redesign (building) · **Branch:** plan/handoff-m2-tf2

## State

- Merged: **#582** DC-2 (Data Checklist v2 live at its v1 address, v1 deleted; reviewer PASS, #578 closed). Data Checklist is done.
- **#579 TF-2** → PR **#583**: built in 1 attempt; pr-meta was red on (a) "removed assertion" and (b) no `scope/team-focus.md`. Fixed: seed `plan/t579` now carries the coverage file (copied from TF-3's seed, identical), merged into the PR branch, body has `Tests removed:` + `Plan-base: 1f53c614`. CI re-running; then reviewer → merge.
- Plan accepted TF-2's answer-key test change: the frozen key file is untouched, every frozen field still compared exactly, only the new `period` is excluded and pinned by its own test (recorded in #583's body; not a key change).
- **TF-3 #580** (seed `plan/t580`, blocked by #579): after #583 merges, merge main into `plan/t580` (normal push), `loop prep 580` → build → finish.
- **Compare planned (ADR 0021 on `plan/t584`):** #584 CMP-1 domain `comparePair` (medium) → #585 CMP-2 `GET /analytics/compare?a&b&asOf` (blocked #584) · #586 CMP-3 six v1 tables in the view (small, no blockers) · #587 CMP-4 live adapter (blocked #585, #586) · #588 CMP-5 go live + delete `MachinesPage.tsx` (blocked #587, #580). Seeds cut from main `a21ffd70`; merge main into each before `loop prep`. Before #588: merge main into `plan/t588`, delete the 'Compare not routed' line in `live.test.ts` and `openCompare` in `e2e/analytics-compare.spec.ts`. `plan/t580` already conflicts with main in `live.test.ts`, `today-tabs.test.ts` (from DC-2): resolve when refreshing it. New e2e `analytics-compare-v2.spec.ts` never run.

## Next step

1. `loop ci 583` → reviewer → merge → `loop clean 579`. 2. TF-3 #580. 3. Compare #584/#586 can build now (independent of TF). 4. Then M2 needs new wireframes (Money Matters, Monthly, Annual, Guide, Settings) → Nimish approves.

## Blocked / open questions

- **G1.2a needs Nimish:** duplicate ticket column pinned by the frozen answer key (`workbook-export.json`).
- **Wireframes for Shift KPIs + Energy, Money Matters, Monthly, Annual, Guide, Settings** need Nimish's sign-off.
- **For Nimish (ADR 0019):** live Data Checklist has one control the S16 wireframe doesn't draw (drill under the verdict, v1 parity).
- Compare: spares cost ₹0 is frozen in the answer key though `breakdown_report.spare_cost` exists (Nimish's call); wireframe's "Add the fix to Team Focus" became an "Open Team Focus" link (ADR 0021 §5); six v1 tables sit below the wireframe's sections (ADR 0013/0021) — for his click-through. Nimish (old): branch protection; answer-key last digit; support tickets 0 downtime.

## Follow-ups (from reviewers, not ticketed)

- DC Page.tsx: no render test clicks a fix button (only pure `fixTarget` tested). `analytics.checklist.*` i18n keys may be unused now.
- DC adapter: `daysSince` rolls impossible dates (31-02) forward instead of `—`. TF-1 test: assert audit line's `login_id`.

## Don't repeat

- **Never force-push** (auto mode denies it). Refresh a stale seed by merging main into `plan/t<N>`, then merging the seed into the PR branch; set `Plan-base` to the new seed sha.
- Ticket PR red on loop-guard "must not edit HANDOFF.md" = seed base older than main. Same fix as above.
- Write "ticket 578" in code comments, never `#578`: loop-guard reads `#` + 3/6 hex digits as a raw colour.
- A seed touching any `screens/v2/<screen>/*.tsx` needs `docs/design/v2/scope/<screen>.md` in the same PR.
- `loop finish` writes a thin body: copy #582/#583's body (sections, Q1–Q16, `No parity:`, `Large PR:` if >800, `Tests removed:` if a test line changed). Edit, then empty commit from a `/tmp` worktree (`cd /tmp/<wt> && …`).
