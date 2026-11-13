# D24 — Charts: ECharts 6.1.0, lazy, SVG, two series, token palette

Date: 13 November 2026 · Status: proposed (slice planner, ticket 12); builds on ARCHITECTURE §5 "Charts", D4, D5, D6

## Decision

- **Package:** `echarts` 6.1.0, pinned exactly in `apps/web/package.json`. Licence Apache-2.0 (its package.json and
  LICENSE file, checked 13 November 2026). It brings `zrender` 6.1.0 (BSD-3-Clause) and `tslib` 2.3.0 (0BSD), both
  on the allowlist.
- **One door:** `apps/web/src/ui/chart/use-chart.ts` is the only file that names `echarts`, and only through
  `import type` and `import()`. A guard test fails on any other import, and a build test fails if ECharts reaches
  the start-up files.
- **Modules and size:** `echarts/core` with `BarChart`, `LineChart`, `GridComponent` and `SVGRenderer` only. Bundled
  and minified (esbuild 0.28.2, 13 November 2026), that is 506,793 bytes, or 174,113 gzipped. The full `echarts`
  package is 1,141,536 bytes (382,585 gzipped). The chunk loads the first time a chart is shown; until then the
  numbers table is already on screen.
- **SVG renderer:** text is drawn in the system font, stays sharp when zoomed, and screenshots are stable. Our charts
  have tens of points, not thousands.
- **No tooltip and no legend:** lines carry end labels, bars carry value labels, and every chart has a table of its
  numbers. Fewer modules, and nothing that needs hover on a phone.
- **No animation:** the ECharts default (1 s) breaks DESIGN's "under 300 ms".
- **Palette from tokens:** `--color-chart-1` (the accent), `--color-chart-2` (neutral 600), axis (neutral 600) and grid
  (neutral 200) in `ui/tokens.css`. At most two series. The second is also dashed with triangle markers, so colour
  never carries meaning alone. There is no dark mode, so there are no dark values.

## Also decided in ticket 12

- **`CrudPage`:** a plain `<table>` and the existing `FormSheet`. D5's TanStack Table and react-hook-form are deferred,
  not rejected. The trigger to adopt them is the first resource that needs sorting, column choice, more rows than fit
  one page, or schema field errors.
- **No `useDisable`:** switching off is `useUpdate` with `active: false` (the shared schemas' `active` flag). The
  data layer has no delete.

## Rejected

- **Recharts (MIT):** a second charting model (React components over D3 modules). The M4a heatmap, calendar and Pareto
  charts are not built in. SPEC §5a lists it as rejected.
- **visx (MIT):** low-level primitives, so we would write the chart code, which the BRIEF forbids ("no custom chart
  code").
- **Chart.js (MIT):** canvas only, so the text is not in the page. Heatmaps and calendars need extra plugins.
- **Hand-rolled SVG:** custom chart code (BRIEF; ARCHITECTURE §5 budget "custom chart code: zero").
- **The full `echarts` import:** 2.2 times the bytes for charts we do not use.
- **The ECharts canvas renderer:** blurrier text at zoom and less stable screenshots; we gain nothing at our sizes.
