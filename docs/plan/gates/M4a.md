# M4a gate: Analytics parity (19 Nov 2026)

**Asked:** every platform figure Cosmos uses, exact and drillable — ten figures spot-checked against Bhavin's platform.

## Goals met

| Goal              | Evidence                                                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Answer key frozen | ticket 36 #267 (key), #268 (migration A); the 11 Nov build is authority                                                       |
| Ten figures exact | 37–43 #265–#357; Action Center 44 #358/#359; monthly #363 and annual #366 — whole-key `toEqual`, no tolerance, no re-rounding |
| Their screens     | 38 #297/#299, 39 #305/#311, 40 #322/#325, 41 #340/#342, 42 #350, 43 #357, 44 #361, reports #367                               |
| Workbook and PDFs | writer under ADR 0008 #364, 17 sheets #365, three routes #369; `m4a.workbook-export` done                                     |
| The Guide         | the key's 36 headings, our prose, every figure explained once #368                                                            |

**Proof.** `pnpm parity` 119 rows / M4a 34 / 0 problems; `pnpm boundaries` 212 files / 0; 2,803 local unit and integration tests green (only `tools/backup-dump` and `tools/staging-deploy` fail on a checkout path containing a space — 26 tests, green on CI's path). Keys: `fixtures/answer-key/*.json`; whole-key tests `packages/domain/test/analytics-*.test.ts`; routes `apps/server/test/report-*.test.ts`.

## What Nimish checks on staging

1. Today's banner opens the Action Center; acknowledge a nudge with owner, due date and note, snooze another, reload, reopen.
2. Analytics → Reports: switch Monthly ↔ Annual, then `Download PDF` and `Export the whole data set (Excel)`.
3. Print a monthly PDF and say whether the tables read without page numbers.
4. Open the Guide and follow "14. Reports (Monthly and Annual)".

## Product calls waiting for him

- Do the printed reports need headline tiles or a short prose summary? (The keys have none.)
- Should management commentary and actions persist per month?
- Must the workbook restore a plant, and must the sheets carry the `DOC. NO.` line?
  **CI:** Actions is blocked at the account level (every job ends in 1–2 s: "recent account payments have failed or your spending limit needs to be increased"). Every merge here was verified locally instead; the fix is Settings → Billing → Actions, or making the repo public.
