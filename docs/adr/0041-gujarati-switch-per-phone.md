# ADR 0041: Gujarati's switch is read on the phone, once at load

Date: 25 Nov 2026 · Decided by: Plan (unattended; assumption for Nimish to confirm or reverse)

ADR 0036 R25 hides Gujarati behind `GUJARATI_ON`. A constant `false` could not be switched on for the browser checks that prove Gujarati still works: one Vite server serves every Playwright project, so a build-time variable is on for all of them or none.

**Decision.** `GUJARATI_ON` (`apps/web/src/i18n/index.ts`) is `localStorage.getItem('uptimo.gujarati') === 'on'`, read once when the module loads; a missing value, any other value, or no storage (tests in node) is `false`. The e2e `gujaratiOn` option (`apps/web/e2e/test.ts`) sets it before the page loads; the `gujarati` project and the two Gujarati specs use it; `account.spec.ts` keeps one check that it is hidden by default.

**Consequences.** Anyone can preview Gujarati on one phone by setting that key; it shows only words already shipped, so nothing is exposed. Turning Gujarati on for everyone is still a code change (default `true`, or drop the flag), as R25 intends.
