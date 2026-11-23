# ADR 0013 — Compare keeps the health score and its tables; M2 runs before M3

Date: 2026-11-23 · Status: accepted (Plan, under ADR 0012 §3; Nimish away)

## Decisions

1. **Compare keeps v1's 0–10 age-adjusted health score, its five-part scorecard and its two tables, in v2.**
   Evidence: `docs/design/v2/scope/batch1.md` lists them as MISSING (rows 197–198, finding 2 "Compare lost most of its
   page"), the v2 mockup `docs/design/v2/mockups/Compare.dc.html` leads with "Health score", and ADR 0012 §2 says the
   MISSING items are built, not waived. Dropping them would reduce scope, which the screen rules forbid. No figure
   changes: the score is the one v1 already computes (`packages/domain/src/analytics/compare.ts`).
2. **M2 (analytics redesign and the coverage gap) runs before M3 (history).** ADR 0012 "Order" already fixes this;
   this ADR closes the open question in PROJECT.md §6.

## Not decided here (still Nimish's)

- Moving the frozen answer key by a last digit (changes a figure) — blocks M3.
- Whether `support` tickets count 0 downtime (Bhavin to confirm) — blocks M3.
- TV board in Gujarati — blocks M4; Plan decides it when M4 starts.
