# Where things stand

Read first. Rewrite when the state changes. Under 50 lines.

## RESUME HERE (17 Nov 2026)

**State:** `main` = `b9da80e` (#280, the first merge train). **The unmerged PR queue is clear** and every M1 screen ticket is merged: 15-19, 20-25 (settings, lists/glossary/company, people/logins/audit, sign-off, lockout, follow-up tasks, Gujarati + translation screen, live board/alerts), 22, 34 p1, 37A, 36A/B, 66. The M1 gate report is written at `docs/plan/gates/M1.md` and stops for Nimish. M0 gate passed 14 Nov; M1 is current. Merged 16-17 Nov: #265 analytics engine (37A), #261 sign-off screens (34 p1), #258 plant settings (22), #264 lockout (66), #268 M4a migration (36B), #267 triage + answer key (36A, signed off), #263 Gujarati (24 p1), #260 account + Alerts (25/21), #275 follow-up task screens (19), plus #273 (main was red), #274 (browser shards), #277 (path-filtered CI), #272 (quality gate). M0 gate passed 14 Nov; M1 is current. Merged 16–17 Nov: #265 analytics
engine shell (tickets 37A), #261 sign-off screens (34 part 1), #258 plant settings screens (22), #264 lockout
before Start (66), #268 the M4a migration (36B), #267 M4a triage + answer key (36A, triage signed off by
Nimish 16 Nov), plus #273 (test-only: main had gone red) and #274 (browser CI sharded 3 ways).

**In the merge queue:** #281 only (test-cost cuts: imports job, real test timeout, path fixes, axe subset) - GitHub Actions stopped creating runs again, so it waits on billing.
#260 (account sheet + Alerts control). One at a time, rebase on current main, fresh review, green CI.

**In build (parallel frontend streams, each its own worktree/branch):** ticket 19 follow-up tasks screens
(`fe-19`), ticket 23 lists + company settings screens (`fe-23`). Streams must not touch `App.tsx`,
`packages/shared/src/i18n/index.ts` or the settings/desk nav — they hand the orchestrator their wiring lines
and it integrates them at merge (exception granted: a 6-line catalogue registration hunk, flagged in the PR).
There is no slice-4 HTML in the repo; slice 4 is only the LOCK.md canvas link — build from LOCK.md and the
slice-5 to slice-9 HTML files.

**Routing and budgets:** coder `isoquant/deepseek-v4.1-flash-1017-fast`; reasoning `deepseek-account/
deepseek-flash` because `DEEPSEEK_API_KEY` is absent (no Pro; R3 uses flash + a glm-5.3-flash adversary).
Budgets $5 coder / $10 reasoning, hard stops. One coder per file area.

**Quality:** fifteen attributes Q1–Q15 in `docs/QUALITY-ATTRIBUTES.md` (D32). `pnpm quality` locally,
`pnpm quality:pr` in the pr-meta job, `pnpm push:check` before every push, `pnpm main:check` after every merge
(Q15 — CI does not run on main, so a red main otherwise surfaces on the next PR).

**What a user can do on staging after the next deploy:** report/work/close a breakdown, desk lists and detail,
PDFs, plant settings screens, sign-off answers ("Is it fixed?"), lockout steps before Start, the live board.

**Next:** ticket 16's leftovers are closed; the gate items 26 (external security review), 27 (usability sessions) and 28 (cutover rehearsal) need people, not code. Then M2 screens and the M4a analytics screens (38-45).
screen), 16 desk leftovers, 19 and 23 (in flight).

3 technicians on staging), 28 cutover (Bhavin sign-off + rehearsal), 68 Gujarati translation provider.

**Open for Nimish:** (1) hidden-group breakdowns still push a phone alert - confirm it should go quiet; (2) the update-banner quiet window: 15 minutes in code, 30 in SPEC; (3) ticket 68 needs a translation-provider decision; (4) GitHub Actions billing/spending limit keeps stopping runs.

**CI facts to know:** browser suite runs as 3 shards with a 600 s global timeout; two workflows fire per push
(push + pull_request), doubling minutes; `state-scale` p95 sits close to its 300 ms budget.
