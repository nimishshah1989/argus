## 43a — Compare machines

- New `compare.ts` (page assembly: 0 KPIs, six tables, two charts) and `compare-score.ts` (the age-adjusted health score and peer averages). The scoring module is split out only to keep both files under the 400-line budget.
- The page pins its pair from the data — the plant's most populous CNC category, then its two worst age-adjusted health scores — which reproduces the key's VC-28 vs VC-22 comparison, and drills both machine ids.
- Registered `compare` in `computers.ts`; new `analytics-compare.test.ts` compares the whole `fixtures/answer-key/compare.json` value and derives the drill from the page's own headers.
- Green: `pnpm exec vitest run packages/domain/test` (422 passed), `pnpm precheck`.
