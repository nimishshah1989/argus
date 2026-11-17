# Where things stand

Read first. Rewrite when the state changes. Under 50 lines.

## RESUME HERE (17 Nov 2026)

**State:** `main` = `cba7541` (#267). M0 gate passed 14 Nov; M1 is current. Merged 16–17 Nov: #265 analytics
engine shell (tickets 37A), #261 sign-off screens (34 part 1), #258 plant settings screens (22), #264 lockout
before Start (66), #268 the M4a migration (36B), #267 M4a triage + answer key (36A, triage signed off by
Nimish 16 Nov), plus #273 (test-only: main had gone red) and #274 (browser CI sharded 3 ways).

**In the merge queue:** #272 (the quality gate + `pnpm push:check`), #263 (Gujarati screens + baselines),
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

**Next buildable tickets:** 20/21 people + audit screens, 25 live-board goal 2, 24 Gujarati part 2 (translation
screen), 16 desk leftovers, 19 and 23 (in flight).

**Blocked on people, not code:** 26 hardened (external security review), 27 usability round (3–5 operators and
3 technicians on staging), 28 cutover (Bhavin sign-off + rehearsal), 68 Gujarati translation provider.

**Open for Nimish:** none. Language is per device today (per login deferred, accepted 16 Nov).

**CI facts to know:** browser suite runs as 3 shards with a 600 s global timeout; two workflows fire per push
(push + pull_request), doubling minutes; `state-scale` p95 sits close to its 300 ms budget.
