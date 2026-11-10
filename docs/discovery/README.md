# Maintenance OS — handoff pack for the Claude Code build

Updated 9 Nov 2026 for Nimish. Put this folder in the private repo as `docs/discovery/`, copy `spec/` to `docs/spec/`, then paste `02-KICKOFF-PROMPT.md` as the first message of the first Claude Code session. The spec was reviewed by an independent three-reviewer council on 9 Nov (edge cases, over-complexity, autonomous buildability); their reports are in `review/` and their findings are folded into the spec.

## Start here

| Path | What it is | Read when |
|---|---|---|
| `spec/SPEC.md` | **The build specification** (9 Nov, post-review): stack decision, product, parity goal post, what we add beyond the baseline, milestones M0–M6 with gates (M1 and M4 split), architecture, borrow-don't-build picks, backend, frontend, data model and API rules, non-functional requirements, repo layout, the goal loop and CLAUDE.md, build order with auto / gate-manual / external acceptance, Cosmos as tenant zero and the cutover story, accounts and inputs | First, fully |
| `spec/DOMAIN.md` | Entities and fields, ticket state machine and transitions, permissions matrix, API contract, exact definitions of response, repair, waiting, downtime and per-person time | Before schema v1 and `packages/domain` |
| `spec/PARITY.md` | Every feature of Bhavin's ticket app v3 and analytics platform with keep / improve / replace / drop, plus the Cosmos master data to carry over | Before every ticket; becomes `docs/spec/parity.yaml` |
| `02-KICKOFF-PROMPT.md` | The first message for Claude Code: reading order, goal loop, session 1 | Paste as first message |
| `bhavin-v3/` | Full source of the live ticket app (`app.js`, `ref.js`, `voice.js`, `maint.html` with the old access key removed), `INVENTORY.md` (line-referenced, ~7,600 words), `live-config-2026-11-09.json` (phone configuration, shift windows, team shifts, the 192 machine ids) and `glossary-2026-11-09.json` | Porting any behaviour; seeding |
| `review/` | The council review: `01-edge-cases.md`, `02-simplicity.md`, `03-autonomy.md` | When a spec rule looks odd: the reason is usually here |
| `01-SCOPE-BRIEF.md` | The earlier product scope and research brief (27–28 Oct). Product reasoning, competitive landscape, capability benchmark, AI brain. Its build-plan and Atlas-first sections are superseded by `spec/SPEC.md` | Background |
| `research/01..16` | Research notes with sources: 01 open-source CMMS, 02 capture + infra, 03 analytics libraries, 04 UX, 05 onboarding, 06 standards + data model, 07 competitors + pricing, 08 Atlas licence (reference only now), 09 ticketing + escalation, 10 WhatsApp/email/SMS, 11 global scan, 12 AI brain, 13 mid-market teardown, 14 enterprise teardown, 15 capability matrix (+ `capability-matrix.tsv`), 16 borrow-don't-build (libraries and repos with licences) | When a decision needs evidence |
| `prototype-inventory/part1..4` | ~39,000-word line-by-line inventory of the analytics platform HTML: every screen, formula (with line numbers), field, rule, hard-coded assumption and bug | Specifying analytics (M4) and the answer key |
| `atlas-poc/` | The earlier Atlas CMMS proof of concept (AGPL). **Reference only; do not copy code.** Useful for the Cosmos loader scripts and the fit-gap list | Rarely |
| `source/cosmos_platform.html` | The analytics platform (single file; data lines 533–540; Guide lines 3473–3796) | Ground truth for formulas |
| `source/cosmos-platform-export-2026-10-28.json` | The platform's data export: 191 machines with nameplate fields, 1,158 breakdowns, settings, cell log | Seeding (M0) and the engine's history (M4) |
| `source/discovery-call-transcript.txt` | Bhavin–Nimish discovery call | Vision and requirements |

## Ground rules (also in CLAUDE.md inside SPEC.md)

1. Bhavin's two tools are the minimum product. Every "Keep" row in PARITY.md works in ours before Cosmos switches over.
2. Every table has `tenant_id` and row-level security from its first migration, with an isolation test.
3. Nothing plant-specific in code; it is configuration with a cascade.
4. The platform's numbers on Cosmos's data at a frozen as-of date are the answer key; legacy mode reproduces them exactly, differences are logged.
5. NO DT means repaired outside production hours (zero lost hours), not "running with a problem"; keep both concepts.
6. No AGPL/GPL code copied (Atlas included); permissive licences only, listed in THIRD_PARTY.md.
7. Data stays in AWS Mumbai; audit log kept at least one year.
8. AI suggests, people confirm; numbers from code; codes selected, never generated.

## Still needed from Cosmos (see SPEC.md section 13)

Core, now: the live ticket store export with the Worker source; the current platform HTML with the latest Excel export; the PM tool if separate. Later (M2–M3): staff phone numbers with consent, 50–100 consented voice notes. Everything else starts from defaults in Settings and is tuned after cutover.
