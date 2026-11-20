# Where things stand — handoff for the next orchestrator session

Read this first, then the tail of `docs/plan/ledger.md`. `git log origin/main` and the PR list beat this text.
State as of 09:30 UTC, 20 Nov 2026. Staging deploys on every merge; `https://cosmos.3-108-95-203.sslip.io/api/v1/health`
shows the commit it serves. Open PRs via `gh api --method POST repos/nimishshah1989/argus/pulls --input <file.json>`.

## The one job now: redesign every screen (Nimish, 20 Nov) — nothing else starts until screens are final

- Source of truth for look and behaviour: `docs/design/v2/UX-RULES.md` (5 sizes 12/13/14/20/24; Inter, Geist, Geist
  Mono; icon rail; glass header; 420px reflowing drawer; tables of 10 rows with search, sort, chips; motion carries
  information, never page-load fades). `docs/design/v2/LANGUAGE.md`: decision-first, ELI5 bullets behind a click,
  bold or colour only for highlights, side-by-side boxes aligned.
- Kit + Dashboard merged (#496, #497). **Entity links merged (#500):** every screen uses `EntityShell` (never the raw `Shell`); a machine, cell, person or decision is an `EntityChip`, in text a segment `{{kind:id|label}}`; the drawer is `?drawer=kind:id`; `entityHref` maps an entity to its full page; recipe in `docs/slices/entity-links.md`. Gallery: `/gallery?view=v2-dashboard` (staging builds with the gallery on, #498).
- Plug-and-play rule: a screen is `screens/v2/<name>/{model.ts, View.tsx, fixture.ts}`; View uses kit components only
  (`ui/v2`, `ui/v2/domain`); data comes through `useScreenModel` (`screens/v2/data.ts`); `ui:check` blocks colours,
  sizes, weights and animation in screen files. The backend later plugs in an adapter; screens do not change.
  Fixtures compute every figure and a test checks totals. Mockups (`docs/design/v2/mockups/`) are illustrative only.
- Old v1 screens are deleted as their v2 replacement ships. No tech debt.
- Process: 5 screens per PR, up to 3 PRs in parallel, Sonnet builders (poteto-agent, worktree), from the kit,
  LANGUAGE.md, UX-RULES.md and the mockups. One smoke e2e per screen + the orchestrator's screenshot check before
  merge. No deep review round for pages (Nimish's speed rule); cubic findings on code are fixed in one push.
- Batches: 1 Action Center, Team Focus, Data Checklist, Machine page, Compare · 2 Machines register, OEM, Age,
  Footprint (confirm meaning with Nimish: assumed "20% of machines cause most hours" + cell map), Cell change log ·
  3 Breakdown Log, General Work, PM Calendar, Fix Finder, Problem Analysis · 4 BD% & PM split, Category & Cell,
  MTTR & MTBF, Manpower, Why-Why · 5 Energy heat map, Bottleneck, Shift-calendar KPIs, Forecast Lab, Reliability
  scorecard · 6 Money Matters, Monthly, Annual, Guide, Settings · 7 Floor phone, desk, ticket, TV board, login.

## Waiting on Nimish (ask in plain words, product only)

1. Dashboard on staging: his check. 2. Rail: list pages inside each section, or sections only? 3. Verdict line at body
   size or one 20px line? 4. Keep mid-green running tiles (needed for 3:1 contrast)? 5. Footprint page meaning.
   Older: PM hours, breakdown hours with no downtime, manpower and spend figures; staging history yes/no (69d).

## Rulings (Nimish)

Everything is redesigned. Floor phone: new look, Bhavin's step order, button order and words unchanged. Desk, ticket
and TV: flow may change too. Rupee figures on the dashboard OK. #493 closed. Earlier: Running grey, Waiting amber,
Transferred blue; Indian grouping; system dark/light; power and air failures count in downtime; real data already in
the public repo is an accepted risk, add NO more (Bhavin's files hold real plant data: never commit screenshots of it).

## How to work

- Never ask Nimish a technology question. Report short and plain; challenge him; flag uncertainty.
- Builders: before every push `pnpm precheck`, or for web/docs-only PRs the light set in CLAUDE.md (Git; it includes `pnpm format:check`); `Large PR:` and `Tests removed:` lines in the body.
- Merge squash with `expectedHeadSha` only after reading check runs of the CURRENT head. The gallery job has an
  8-minute limit and the test server on port 3001 sometimes refuses connections: re-run once, then investigate.
- Known staging bugs to fix when wiring real data: UUIDs shown instead of names, unformatted floats, A1 all 0.00%.

## Open numbers (not final)

History vs Bhavin's sheets: 1,855 of 2,084 machine-months (89%) match with his rules; 229 unexplained. Plant-event
hours are a lower bound. Tracker: https://claude.ai/artifact/5Kc9KrYMwnW9EK1UvmA9JJ (never edit the page file).
