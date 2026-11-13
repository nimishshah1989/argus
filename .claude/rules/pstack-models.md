# pstack model configuration for Argus (D23). One line per role. Delete a line to fall back to the skill default.

# Values are `<model> <effort>` for the Claude Code Agent tool; `inherit-parent` runs on the session model.

# Claude Code has no Grok or GPT, so every panel is Opus + Sonnet; the cross-family second opinion is Codex (optional).

# budget: medium (high)

feature, refactoring: sonnet high
bug-fix: sonnet high
perf-issue: sonnet high
hillclimb: sonnet high
judgment and prose: opus high
hardest tasks: fable high
how explorer: sonnet medium
how explainer: opus high
why investigators: sonnet medium
why synthesizer: opus high
reflect tooling: sonnet medium
reflect judgment, divergent, synthesizer: opus high
arena runners: opus high, sonnet high
arena cross-judge pool: opus high, sonnet high
swarm workers: sonnet medium
architect runners: opus high, sonnet high
interrogate reviewers: opus high, sonnet high
