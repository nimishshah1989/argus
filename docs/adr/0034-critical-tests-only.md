# 0034 — Seeds carry critical tests only (Nimish, loop PR 6)

Date: 2026-11-24 · Decided by: Nimish (loop PR 6), applied by Plan

## Rule

A seed's visible and hidden tests keep only:

- figures and data correctness (including what a screen says when data is missing: it must never invent a count or a comparison);
- tenancy, auth and permissions;
- money;
- data safety;
- one render-smoke per screen.

Removed: tests on wording, CSS classes, markup shape, element order, i18n strings, tone/colour and other cosmetic details. A test the builder could only pass by editing a protected or kit file is removed or its file change moves onto the seed. Kept tests stay red for their real reason (the missing figure), proved before push.

Where a kept test checked a sentence, it now checks the figures in it (`toContain('51%')`), so a wording change cannot fail it and a wrong number still does.

## Applied 24 Nov to seeds t640, t641, t643

| Seed               | Kept                   | Removed | Notes                                                                                                                                                                                                    |
| ------------------ | ---------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| t640 Dashboard     | 7 (6 + coverage entry) | 3       | Removed: two table-`meaning` shape tests, the "nothing needs you" wording/tone test. Takeaway tests assert figures only; `tone: 'risk'` dropped.                                                         |
| t641 Breakdown Log | 3 (2 + coverage entry) | 0       | `tone`/`tag` and the section-key list dropped from assertions (the coverage entry still checks the key).                                                                                                 |
| t643 Machine       | 5 (4 + coverage entry) | 2       | Removed: spares table-`meaning` shape test, "No open tasks." wording/tone test. Added `takeaways?` to `MachinePageModel` on the seed so the tests typecheck without the builder touching the type first. |

None of the three seeds had hidden tests of their own. None of the kept tests needs a protected or kit file changed: `KpiData.yardstick` and `Takeaways` are already on main. Each seed had main merged in (it was 7 commits behind and did not typecheck without `KpiData.yardstick`).

No seed added a render-smoke; main already renders each screen (`dashboard/dashboard.test.ts`, `breakdown-log/view.test.ts`, `machine/machine.test.ts`), so none was added. Those main tests were not pruned here: this ADR covers the seeds only.

Not applied: t642 (building) and t644 (no seed branch yet; issue says seeding in progress, blocked by #619 and #620). t644's seed must follow this rule when it is written.

The seed commits that applied this say "ADR 0033" in their messages; 0033 was already taken by `plan/t642`, so the number is 0034. The test-file comments were corrected.
