# Answer key (M4a)

What Bhavin's 11 November platform shows on his 11 November workbook, frozen at 11 Nov 2026. One file per screen; `input.json` is the data they were computed from. Names and phones are coded (the repo's pseudonymiser, deny list from the source files); machines, codes, faults and timings are real.

- **Plant local time.** Every figure was computed with the browser in `Asia/Kolkata`, locale `en-IN`. The engine (ticket 37) must use plant local time too: the same data gives different day boundaries, for example A1 breakdown hours, in UTC.
- **R8 — the nine A4 mentions.** The answer-key pseudonymiser collapses every written form of a person's name (short form and full form) to one `Person NN`, but the platform attributed a breakdown only when the team member's full name appeared in `Done By` / `Supported By`. `person-mentions.json` gives those nine mentions their own code (`person-26-mention`, `person-55-mention`, `person-79-mention`) while keeping the printed name, and the fixture applies it while building `ENGINE_DATA`; only A4 reads names for attribution, so no other figure moves. Evidence: the staging workbook `<argus-staging>/docs/discovery/real-2026-11-13/cosmos-export-2026-11-11.xlsx`, its `Breakdown Log` sheet against its own `Analytics 4 - Manpower` sheet (1,279 rows).
- **Forecast.** The planning forecast and Forecast Lab use the platform's seeded mulberry32 generator (`fcRng(1000 + machine index)`, 2,000 runs, `FC_RUNS`); the engine must reproduce the seed scheme to match.
- **Generated with** Chromium 153.0.8010.12. Regenerate with `pnpm tsx tools/answer-key/generate.ts` (hand-run; set `CHROMIUM_PATH` if Playwright's browser is elsewhere). Two runs are identical: the platform's random ids on AMC and legal lines are left out.
- Screen labels are whitespace-normalised; table titles are the heading text only.
- Verdicts and owners: `docs/plan/m4a-triage.md`. Inputs and gaps: `docs/plan/m4a-figures.md`.
