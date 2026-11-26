# ADR 0050: Built screens ship; only critical faults hold a merge

Date: 26 Nov 2026 · Decided by: Nimish ("I'm principally approved on everything … everything that has been built right now and does not have any critical issues, please just merge and get them live. Do not wait for stuff.")

Built screens were waiting on paperwork checks (screen names, test-file flags) while the goal, every screen live on the newest kit, stayed unmet.

## Merge rule

A PR merges when its tests and build are green (static, api, browser, gallery, secrets) and a review finds no **critical** fault.

- Critical: a failing test or build; wrong figures or wrong data written; something today's app does that disappears; a page that does not open; a secret or personal data; a permission or tenant leak; data loss.
- Not critical, logged as a follow-up: `loop-guard` failing on a screen name, a listed page with no wireframe, a false "raw colour" hit in a comment, or a test edit the reviewer confirms only follows the redesign and weakens no assertion (no re-seed and re-merge for it); ticket budget; handoff file; review nits.

The checks and hooks stay as they are; none is switched off. Builders still may not edit a test to make it pass.

## Two sessions

One builds the unbuilt tickets up to an open PR with green tests and never merges. One releases: finishes built work, reviews, merges, checks staging.

## Approvals given with this decision

- `#753` lists screens by full approved name. Forecast Lab has no wireframe and ships without sign-off; Cell change log and Bottleneck (merged in `#801`) likewise.
- `#765` deletes `ReportsPage.tsx` and `report-view.ts`.
- The written yes ADR 0045 asks for: `#768`–`#772` ship without their "Unbuilt from the wireframe" rows, tracked in `#803`.
