# 0033 — A page never prints one sentence twice

Date: 2026-11-24 · Decided by: Plan (unattended; Nimish not asked)

**Context.** PR #649 (ticket 642, Shift-calendar KPIs) gave every section a takeaway (ADR 0031 §4). The compare section's takeaway was the comparison headline, which the page's verdict already prints at the top. The e2e (`analytics-shift-kpis.spec.ts`, "462.0 hrs between breakdowns") then found two copies of the same sentence.

**Decision.** A section takeaway that would repeat the verdict headline is left out (null). The Shift-calendar KPIs compare section opens with the verdict; it has no takeaway of its own. The seed test (`shift-kpis/insight.test.ts`) asserts the headline is in the verdict and the compare takeaway is null; `insight-coverage.test.ts` no longer lists `shift-kpis.compare` as a section that needs a takeaway. The e2e locator stays as it is.

**Rejected.** Keeping both copies and making the e2e locator exact to the verdict: it hides the repetition from the test instead of removing it from the page.

**Assumption.** The rule applies to every v2 screen: when a screen's first section is the verdict's own figure, the verdict is that section's takeaway.
