# Orchestrator ledger

One line per event, append-only: `dispatched NN → session`, `PR #n`, `merged`, `Ruling: what — why — cost if wrong`.

- 2026-11-13 · M0 orchestration started on `main` eb80a47; frontier = {01}.
- 2026-11-13 · Ruling: children append their line to this file in their own PR and the orchestrator rebases `claude/orchestrator-ledger` after each merge — the brief asks for both; append-only lines resolve trivially — cost if wrong: a rebase conflict per merge.
- 2026-11-13 · dispatched 01 → session_01KEBF28bH3ZUiJA3Dp6SYCF (branch claude/t01-green-fast-main, Sonnet).
- 2026-11-13 · Ticket → issue map (from supervisor): 01=#76 02=#77 03=#81 04=#82 05=#83 06=#84 07=#85 08=#78 09=#87 10=#79 11=#86 12=#88 13=#80 14=#89 | 15=#90 16=#91 17=#92 18=#94 19=#96 20=#95 21=#97 22=#98 23=#99 24=#100 25=#93 26=#101 27=#102 28=#104 68=#103 | 29=#105 30=#106 31=#108 32=#107 33=#111 34=#109 35=#112 66=#110 | 36=#113 37=#114 38=#115 39=#116 40=#117 41=#118 42=#119 43=#120 44=#121 45=#122 | 46=#123 47=#124 48=#128 49=#125 50=#129 51=#126 52=#127 53=#130 54=#131 67=#132 | 55=#133 56=#134 57=#135 58=#136 59=#137 60=#138 | parked 61=#139 62=#140 63=#141 64=#142 65=#143. Every ticket PR says "Closes #<issue>"; at the M0 gate `ready-for-agent` moves to M1 issues.
- 2026-11-13 · PR #144 opened for this ledger (draft; merge at M0 gate).
- 2026-11-13 · Ruling: the session-end hook writes HANDOFF/wiki text prettier rejects; orchestrator runs prettier --write before each ledger push (superseded: HANDOFF facts block now fenced with prettier-ignore markers, proven by a fresh hook run) — fixing the hook is athena-ops' file, not this repo's — cost if wrong: one red format check per session.
- 2026-11-13 · 01 slice plan written (17 tasks), plan review running.
- 2026-11-13 · Ruling (01): one PR `size:large`, cut to the three goals — splitting delays the only ticket on the frontier — cost if wrong: a harder review.
- 2026-11-13 · Ruling (01): no real phone list exists in the sources; phone scan proven on generated +91 numbers and also scans phone-shaped values from the source files — cost if wrong: a real number added later in another format slips through.
- 2026-11-13 · Ruling (01): goal 2 removes the DeepSeek/hosted-coder routing (CLAUDE.md, AGENTS.md, docs/orchestration.yaml, tools/check-orchestration.ts) and adds D18 — approved MILESTONES goal; ROADMAP §3.5 names the two harnesses as a defect; Athena v3 is what runs — cost if wrong: re-adding the route from git history.
- 2026-11-13 · Ruling: children do not touch ledger.md (overrides the earlier ruling) — an add/add conflict on a new file per PR is waste; the orchestrator logs for them — cost if wrong: none.
