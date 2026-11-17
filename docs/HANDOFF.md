# Where things stand

Read first. Rewrite when the state changes. Under 50 lines.

## NEXT SESSION GOAL (agreed 17 Nov 2026)

**Ship M2 Accountability — roster and ladder settings, live SLA clocks, the acknowledge action, the
escalation feed and lockout settings — so that sign-off turnaround is visible on live tickets. Stop at the M2
gate.** Next in the plan's order; its server side already exists (schema #228) so the gap is screens plus the
gate criterion — bounded, with a checkable gate.

Then in order: **M4a** analytics figure screens (engine shell + answer key are in `main`), then **M4b** PM
scheduling and spare parts (the two gaps the UpKeep research says lose deals), then **M6** AI.

Start with: "Orchestrate `docs/plan/MILESTONES.md` per `CLAUDE.md`, next goal: M2 accountability per
`docs/HANDOFF.md`."

**Language rule (non-negotiable):** one codebase, one set of screens, a catalogue of keys with `en`/`gu`
dictionaries, the plant's language as a tenant setting, a per-phone override. Never a separate screen, route,
build or app per language; Hindi is another dictionary, not a fork.

Carried, owned by Nimish: M1's human items — external security review (26), usability sessions (27), Bhavin's
cutover rehearsal (28). Nothing in M2 blocks them.

## RESUME HERE (17 Nov 2026)

**State:** `main` = `b9da80e` (#280, the first merge train). **The unmerged PR queue is clear**; every M1
screen ticket is merged (15–19, 20–25, 22, 34 p1, 37A, 36A/B, 66). M1 gate report: `docs/plan/gates/M1.md`
(stops for Nimish).

**Open PRs:** #281 (test-cost cuts: imports job, 35 s timeout, path fixes, axe subset) and #282 (this session's
ledger, tracker, M1 gate report, handoff, research). Both rebased and running; merge them before the new goal.

**Routing and budgets:** coder `isoquant/deepseek-v4.1-flash-1017-fast`; reasoning `deepseek-account/
deepseek-flash` (`DEEPSEEK_API_KEY` absent, no Pro; R3 adds a glm-5.3-flash adversary). Hard stops; no spend
meter. Actions $75 with ~28% left: chain `push:check`, keep drafts draft, use trains.

**Quality:** Q1–Q15 in `docs/QUALITY-ATTRIBUTES.md` (D32). `pnpm quality`, `pnpm quality:pr`, `pnpm push:check`
before every push, `main:check` after every merge (Q15). CI is path-filtered (#277), browser-sharded 3 ways
(#274); merge trains allowed via a `Merge train:` body line (#279).

**Research on file** (`docs/research/`): `upkeep-vs-uptimo.md` (UpKeep: $24/user/mo, Nova AI, Edge hardware,
SAP/QuickBooks/Oracle/Zapier, SOC 2, no India presence), `borrowable-capabilities.md` (the four links: two are
name-collisions, nothing to embed from UpKeep's org; borrow AI diagnosis + narrative drafting + the
inspect/disclose discipline), and `claude-manufacturing-skills-vs-uptimo.md` (in progress: the 17 skills mapped to our raw
data, plus capabilities we were not planning).

**Open for Nimish:** hidden-group breakdowns still push an alert; update-banner 15 min in code vs 30 in SPEC;
ticket 68 needs a translation provider; export the slice 1–4 mockup frames as PNGs to end the Q7 waiver.
