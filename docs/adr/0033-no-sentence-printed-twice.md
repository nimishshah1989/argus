# 0033 — A page never prints one sentence twice

Date: 2026-11-24 · Decided by: Plan (unattended; Nimish not asked) · Revised after the PR #649 review FAIL

**Context.** PR #649 (ticket 642, Shift-calendar KPIs) gave every section a takeaway (ADR 0031 §4) and every tile a yardstick. The page then said the same thing twice in four places: the compare takeaway repeated the verdict headline; every tile printed the engine's basis line as its yardstick and again as its sub; the backlog printed "Not computed yet" as a takeaway and again in its empty state; the map takeaway repeated the verdict's Why line.

**Decision.** Each sentence has one home on a page.

1. **Verdict headline and its Why lines both count as the verdict.** The Why lines are hidden until asked, but opening them must not show a sentence already on the page. A sentence about one section lives in that section's takeaway, not in the verdict's Why: the adapter leaves out of `verdict.why` any line it uses as a takeaway. On Shift-calendar KPIs: the headline stays in the verdict and the compare section has no takeaway; the backlog and half-the-hours lines move to their sections' takeaways, so `verdict.why` is empty there.
2. **Kit, Verdict:** a verdict with no Why lines draws no Why button (one guard in `ui/v2/verdict.tsx`).
3. **Kit, FigureTile:** when `sub` equals `yardstick`, the tile prints the line once, as the yardstick (one guard in `ui/v2/figure-tile.tsx`). Adapters keep copying the engine's basis line into `yardstick` (ADR 0031 §4 shortcut), so the coverage gate still sees a yardstick and every screen doing the same is fixed in one place.
4. **Not computed:** a section the engine did not compute has no takeaway (null); its empty state is the one place that says so. `insight-coverage.test.ts` accepts a null takeaway only for a section whose model says `notComputed`.

The rule is enforced for every finished screen in `insight-coverage.test.ts` (no takeaway equals the verdict headline or a Why line) and for the drawn Shift-calendar KPIs page in `shift-kpis/view.test.ts`.

**Rejected.** Keeping both copies and making the e2e locator exact: hides the repetition instead of removing it. Treating hidden Why lines as not printed: the sentence shows twice the moment the Why opens. Blanking `sub` in the adapter: loses the engine's line from the model and breaks the existing sub test.

**Assumption.** Applies to every v2 screen; batch-1 tickets #640, #643, #644 inherit it through the coverage gate.
