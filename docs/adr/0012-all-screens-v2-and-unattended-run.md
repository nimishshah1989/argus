# ADR 0012 — Every screen moves to v2, v1 is deleted; Plan decides the open questions; the loop runs unattended

Date: 2026-11-23 · Status: accepted (Nimish, in chat, 19:42–19:43 IST)

## Decision

1. **All screens and all missing features land in the v2 design only.** Every v1 screen, and the old v1 kit (`apps/web/src/ui/elements` and anything only v1 uses), is deleted once its v2 replacement is live. No new work goes into v1.
2. **The coverage gap is closed, not waived.** The 97 of 187 MISSING items across the first six v2 screens (`docs/design/v2/scope/batch1.md`) are built in v2. A row may be DROPPED only when the item is truly obsolete, with the reason written in the scope file.
3. **Plan decides PROJECT.md §6 itself**, with evidence from the docs and code, one ADR per decision. Exceptions that still need Nimish: anything that changes a figure away from Bhavin's answer key, a production release, money, or an irreversible data step.
4. **Wireframe snapshots S01–S19 are approved** (Nimish: "everything is approved"); recorded in `design/approved.json`.
5. **The loop runs unattended** (`loop auto`): fresh Opus sessions, each stopping at ~55% context (`context_budget` 110000), Sonnet/Haiku builders, merges on green.
6. The old pstack harness hooks and plugin are removed from `.claude/settings.json`; `.claude/harness/` is deleted (follows ADR 0010).

## Order

M1 Stabilise → M2 (the coverage gap first: Compare, Data Checklist, Team Focus, then the rest of analytics) → M4 floor/desk/board in v2 → M3 history → M5 waits for Nimish's go.
