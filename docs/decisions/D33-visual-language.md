# D33 — A visual language with meaning; the floor keeps Bhavin's positions

Date: 19 November 2026 · Status: accepted (Nimish) · Owner: frontend orchestrator · Changes: D04 (running stays
neutral), D27 (two colours, no legend, no tooltip), `docs/DESIGN.md` (one accent, no bolder modes),
`docs/design/LOCK.md` and the matching line of `CLAUDE.md` (one mockup per screen; ticket 80 amends both). Tickets 80–89.

## Decision

1. **Colour may carry meaning.** Red, amber and green are allowed for status, severity, risk and a figure's
   direction, always with an icon and a word. One table (ticket 82) decides tone, icon and word; no screen chooses.
2. **Charts get a real palette.** Eight categorical colours, one sequential and one diverging ramp, a legend, a
   tooltip, heatmaps and Pareto. "Show the numbers" stays on every chart.
3. **Two zones, two rules.** On the floor and the desk, flow, order, button position and words stay Bhavin's v3
   (LOCK rule 1): operators were trained on those positions. Only colour, type, depth and motion change, and tickets
   88 (desk) and 89 (floor) measure the positions. Analytics — dashboard, analyses, machine page — is redesigned freely; its figures stay
   exact.
4. **Approval is per template.** Nimish approves one direction (ticket 80), five templates and four migration
   waves, not every screen.
5. **Skills.** `impeccable` sets the system; Emil Kowalski's skills (`github.com/emilkowalski/skills`, MIT) set
   the craft. `docs/plan/MILESTONES.md` rule 5 says which is used where.

## Why

Nimish, 17 and 19 Nov: the screens are plain text with no indicators, and the product must look better than the
single HTML file it replaces. The audit of 19 Nov found the flatness was specified, not botched: the rules above
forbade colour, a legend and a tooltip, and the builders obeyed them.

## Rejected

- **Restyle screen by screen.** 92 screen files, 550 hand-written class strings, the same card written 57 times:
  the cost repeats for every screen and the result drifts.
- **Redesign the floor freely.** A better layout that moves a button costs more on the shop floor than it gains.
- **A new component library.** The kit, the tokens and the chart door already exist; the gap is rules and about
  thirteen elements, not a dependency.

## Cost if wrong

The 70 gallery baselines are regenerated once (ticket 81). If the chosen direction is wrong, tokens and the meaning
map change in two files and every screen follows; the templates stay.
