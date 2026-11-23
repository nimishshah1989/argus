# HANDOFF

> **Read ADR 0012 first.** Nimish is away; the loop runs unattended. Plan decides §6 (ADR each) except answer-key changes, production, money, irreversible data steps. **ADR 0015:** M1 closed without G1.2a and Shift KPIs/Energy G1.4.

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-24 · **By:** Plan · **Model:** claude-opus-5-5
**Milestone:** M2 Finish the analytics redesign (planning) · **Branch:** plan/handoff-m1-done

## State

- **M1 done.** Merged this session: #563 (G1.3), #565 (G1.2b), #567 (G1.4 Dashboard), #569 (G1.4 Problem Analysis), #570 handoff. Each reviewer PASS, CI green. Issues #551–#558 closed. PROJECT.md ticks M1, M2 → Building.
- M2 has no tickets yet. 41 MISSING rows in `docs/design/v2/scope/batch1.md`: Data Checklist 17 (`:103-130`), Team Focus 4, Compare 20 (`:197-228`).
- Facts found (explorer): the three v2 folders run on fixtures (`register.ts` provider returns the fixture). Live pattern to copy: `screens/v2/breakdown-log/{register,live}.ts` (`liveReply(client)` → `figureOf(reply, KEY)` → adapter; throw `NotComputed` unless status `ready`), routed by adding to `LIVE` in `screens/v2/live.tsx`; `live.test.ts:41,81-82` asserts Compare/Team Focus are not routed (update when going live).
- Data Checklist engine (`packages/domain/src/analytics/data-checklist.ts`) already computes all 16 checks: value `{counts, items:[{group,key,plain}]}`, `plain` = `"<date> · <machine> — <what>"`, drillIds for bd_*/ww. v1 sections: `checklist-view.ts` (`sectionOf`, `SECTION_LABELS`). The v2 model (`data-checklist/model.ts`) also wants owners, per-record age and last-week deltas that the engine does not give: decide (ADR) what prints instead (e.g. empty delta = "no earlier figure", per kit doc `kpi-card.tsx:14`).
- Team Focus: note/status/owner have no storage or endpoint (`plant/repo/config.ts:46-52` only excludes `focus:` keys; `PUT /settings/:key` rejects them). Needs a server ticket first.
- Compare: `compareFigure` (`compare.ts:300`) picks the machine pair itself, so the v2 picker needs a server input. Spares cost is `() => 0` in the engine (no source).

## Next step

1. Data Checklist first (all data exists): DC-1 ticket `data-checklist/live.ts` adapter engine value → `DataChecklistModel` (ADR for the owner/age/delta gaps); DC-2 register provider + `LIVE` entry + delete v1 `DataChecklist.tsx`/`checklist-view.ts` + coverage table. 2. Team Focus: server endpoint for `focus:<period>|<action>` notes, then adapter, then go-live. 3. Compare CMP-1..4 (server pair input first). 4. Shift KPIs/Energy gallery view + fixture → wireframe (needs Nimish's approve).

## Blocked / open questions

- **G1.2a needs Nimish:** duplicate ticket column pinned by the frozen answer key (`workbook-export.json`).
- **Shift KPIs + Energy, Money Matters, Reports, Guide:** new wireframes need Nimish's `loop approve`.
- Compare "Spares cost ₹ 0" placeholder: product call. Nimish (old): branch protection; answer-key last digit; support tickets 0 downtime.

## Don't repeat

- Ticket PR red on loop-guard with main's files listed → `Plan-base` is stale (see LESSONS 2026-11-24). Never `gh pr update-branch`.
- loop-guard/pr-meta read the PR body from the push event: after `gh pr edit`, push an empty commit (`cd /tmp/<wt> && git commit --allow-empty`, one PR per Bash call: a `for` loop with `cd` trips the "you're on main" hook).
- Plan PR bodies need Q1–Q16 + "No parity:" (copy from #566). Builder handoff notes need Prettier; `Screens:` needs full ids.
- Hidden tests go in a `holdout/` folder the test command reaches.
