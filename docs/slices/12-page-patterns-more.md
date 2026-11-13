# 12 — Page patterns: wizard, settings, dashboard, board

Issue: [#88](https://github.com/nimishshah1989/argus/issues/88) · Milestone M0 · Blocked by: 11 (#86, merged) ·
Branch `claude/t12-page-patterns-more`. One PR, labels `no-parity` (reason: gallery-only patterns, built only in
development and staging; no v3 behaviour row changes; floor, desk and board screens look and behave exactly as
today) and `size:large` (one dependency, four patterns, the chart layer, their gallery sections and 8 binary PNG
baselines must land together to be usable). The PR body contains `Closes #88`.

## 1. Goal

Nimish can open `/gallery` on a phone and use a settings page that was generated from one short description (list,
add, edit, switch off and on again, never delete), walk a three-step wizard to its result, filter a live board, and
read a dashboard whose charts load only when shown and always come with a table of their numbers, in English and
placeholder Gujarati.

| Label  | Ticket text (MILESTONES "12")                                                                                                                                    |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G1** | [Browser] One `ResourceSpec` (≤ 60 lines, no JSX) generates a working `CrudPage` that lists, creates, edits and switches off a gallery resource through its API. |
| **G2** | [Browser] `WizardPage`, `BoardPage` and `DashboardPage` with `useChart` (ECharts lazy-loaded under an ADR, token palette) are in the gallery, axe clean.         |

Plus, from the orchestrator: a guard test that `echarts` is imported only inside the `useChart` module (planted
violation included), and a bundle check that `echarts` is not in the start-up files.

**Two readings of "switches off … through its API".** (a) A dedicated disable request (`DELETE`, or
`POST …/disable`); (b) the same `PUT` an edit uses, with `active: false`. Chosen: **(b)**. The shared schemas say
`active: boolean` (`packages/shared/src/config.ts:47, 84, 135, 189`), and the only real switch today,
`putWaitReason` (`apps/web/src/api.ts:158`), sends the whole item with `active` on a `PUT`. So the switch sends the
row's spec fields plus the flipped `active`, which also works against an upsert route. There is no delete method in
the data layer, so no `DELETE` can be sent.

## 2. Decisions (technical)

1. **`CrudSpec` extends ticket 11's `ResourceSpec`** (`{ key, path, transport? }` in `data/resource.ts`) with
   `titleKey`, `emptyKey` and `fields`. The ticket and ARCHITECTURE call the page description "ResourceSpec". That
   name is taken by the data layer, and a page description is a resource description plus page facts, so
   `CrudSpec extends ResourceSpec` reuses the type instead of adding a second one. **D:** D5's `schema`,
   `columns` and `permission` are not in it yet:
   - `schema`: the web has no `zod` (ticket 11, decision 4).
   - `columns`: `fields` serves as both table columns and form fields until a resource needs them to differ (rule
     of two).
   - `permission`: the server is the gate; the client permission model arrives with the first real settings
     screen.
2. **Label keys are typed.** `type LabelKey = MessageKey | \`gallery:${string}\``. An English literal in a spec fails
typecheck (D7). Gallery keys use i18next's namespace prefix (`gallery:crud.title`), which the default `t()`
   resolves.
3. **Data layer: two mutation hooks, no new request.** `Resource` gains `useCreate()` and `useUpdate()`
   (TanStack `useMutation`). On success each awaits `invalidateQueries({ queryKey: [key] })`, so keys and
   invalidation stay inside `data/` (ARCHITECTURE: "no query key elsewhere"). **D:** no `useDisable`: it would be a
   one-line alias of `useUpdate` (D6 lists it; rule of two). `fetch-guard.test.ts` passes unchanged: the
   mutations call the same `send` inside `data/`.
4. **`CrudPage` uses a plain accessible `<table>` and the existing `FormSheet`** (orchestrator ruling). **D:**
   this departs from D5's TanStack Table and react-hook-form. Recorded in D23 as a deferral with a trigger, plus a
   one-line pointer in D05 (question 1 for the orchestrator). `FormSheet` gains one optional prop, `initial`, so
   an edit opens prefilled. `CrudPage` mounts the sheet only while it is open, so every opening starts from
   `initial`.
5. **Errors in `CrudPage`.** One `error` state holds `t('kit.crud.error')`. It shows inside the sheet (`FormSheet`'s
   `error`) while the sheet is open, and otherwise as `<p role="alert">` above the table. Opening the sheet or
   pressing a switch clears it. A failed write is never retried silently and the row keeps the server's value: the
   table only changes after the refetch.
6. **Charts (D23).** `echarts` 6.1.0 is pinned exactly.
   - **One file touches it:** `ui/chart/use-chart.ts`, through `import type` and `import()` of `echarts/core`,
     `echarts/charts` (`BarChart`, `LineChart`), `echarts/components` (`GridComponent`) and `echarts/renderers`
     (`SVGRenderer`). The loader promise is cached in that module and reset on failure.
   - **Rendering:** `animation: false` (DESIGN: motion under 300 ms; the ECharts default is 1 s), SVG renderer, no
     tooltip, no legend.
   - **Colour is never the only signal:**
     - a line chart has at most two series; the second is dashed with triangle markers (the first is solid with
       circles), and each line carries its name as an end label;
     - a bar chart has one series with value labels on the bars;
     - every chart has a `<details>` table of its numbers, and its `role="img"` label points to that table.
   - **Palette:** read at draw time with `getComputedStyle` from four new tokens in `ui/tokens.css`, so the teal
     accent switch carries through. There is no dark mode in the repo, so there are no dark variants.
7. **"Not in the start-up files" is proven on a real build.** K3 runs `vite build` with `VITE_GALLERY=on` (the only
   build that contains a chart) into a temp folder:
   - neither the entry script nor any `modulepreload` named in `index.html` contains the ECharts marker
     `_echarts_instance_`, and neither does the `Gallery-*.js` chunk;
   - some other emitted chunk does contain it, so the check is not vacuous.

   The plain production build has no chart at all (gallery off); `gallery-prod.spec.ts` keeps proving that.

8. **Patterns follow ticket 11.** Each is a `<section>` via `PatternFrame` (with `SyncStatus`), gets translated
   strings from the caller, and uses `viewState`/`StateNotice` for loading, empty, error and offline where they
   apply:
   - `WizardPage` reads no data, so its states are sending, error and offline (`offlineNotice` on the last step);
   - `DashboardPage` uses empty only for a `not_found` answer, as `DetailPage` does.
9. **Selected state on the kit `Button`** (filters, wizard choices). The secondary variant gains
   `aria-pressed:ring-2 aria-pressed:ring-accent-strong aria-pressed:text-accent-strong`. The ring is a shape cue
   as well as a colour cue, and `accent-strong` keeps text at 5.5:1 or more with teal. Only `aria-pressed="true"`
   matches. No existing secondary button is pressed (the gallery `Switcher` uses `primary` for the selected one),
   so no existing baseline changes.
10. **Dev server:** `apps/web/vite.config.ts` gains
    `optimizeDeps: { include: ['echarts/core', 'echarts/charts', 'echarts/components', 'echarts/renderers'] }`.
    This avoids Vite's "new dependencies optimized, reloading" page reload on the first chart, which would flake
    the gallery run. It has no effect on the production build.

## 3. Files

Write area: `apps/web/**`, `packages/shared/src/i18n/common.en.ts`, `packages/shared/test/fixtures/en-before-05.json`
(append only, as tickets 05, 06 and 11 did), `THIRD_PARTY.md` (one row), `pnpm-lock.yaml`, `docs/decisions/D23-*.md`,
one line in `docs/decisions/D05-*.md`, `changes/88-page-patterns-more.md`, this plan.

**Not touched:** `apps/server/**`, `packages/db/**`, any migration, `packages/shared/src/config.ts`, `tools/**`,
`docs/plan/**` (ledger, MILESTONES), `docs/ARCHITECTURE.md`, `docs/spec/parity.yaml`, `screens/**`, `components/**`,
`offline/**`, `api.ts`, `data/index.ts`, every existing test and the 22 existing PNGs.

**Data layer**

| File               | Change                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data/resource.ts` | Import `useMutation`, `useQueryClient`, `type UseMutationResult`. Lift the returned `create` and `update` bodies into local consts (as `one`/`list` are); add `useCreate` and `useUpdate` to `Resource` and to the returned object (§4). One-line doc comment updated to "the request builders, two read hooks and two write hooks". About 110 lines. `ResourceSpec` and every existing member unchanged. |

**Chart layer (`apps/web/src/ui/chart/`, new)**

| File                  | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `use-chart.ts`        | The only file that names `echarts`. It exports `ChartSeries`, `ChartSpec`, `ChartState` and `useChart` (§4). About 120 lines; every function under 60.<br>**`loadEcharts()`:** a module-level cached `Promise.all([import('echarts/core'), import('echarts/charts'), import('echarts/components'), import('echarts/renderers')])`. It calls `core.use([charts.BarChart, charts.LineChart, components.GridComponent, renderers.SVGRenderer])` and returns `core`. On rejection it clears the cache, so a later mount can try again.<br>**`palette(el)`:** reads `--color-chart-1`, `--color-chart-2`, `--color-chart-axis`, `--color-chart-grid` and `--font-sans` from `getComputedStyle(el)`, each `.trim()`.<br>**`chartOption(spec, p)`:** pure; types from `import type` of `echarts/core` (`ComposeOption`), `echarts/charts` (`BarSeriesOption`, `LineSeriesOption`) and `echarts/components` (`GridComponentOption`). It returns:<ul><li>`animation: false`;</li><li>`textStyle: { fontFamily: p.font, fontSize: 12, color: p.axis }` (12 = `--text-caption`);</li><li>`grid: { left: 8, top: 24, bottom: 8, right, containLabel: true }`, where `right` = `16 + 7 * longest series name length` for `line` and `16` for `bar` (room for end labels; about 7 px per character at 12 px);</li><li>`xAxis: { type: 'category', data: spec.categories, axisTick: { show: false }, axisLine: { lineStyle: { color: p.grid } }, axisLabel: { color: p.axis } }`;</li><li>`yAxis: { type: 'value', splitLine: { lineStyle: { color: p.grid } }, axisLabel: { color: p.axis } }`;</li><li>`series[i]` for `bar`: `{ type: 'bar', name, data: values, color: p.series[0], label: { show: true, position: 'top', color: p.axis } }`;</li><li>`series[i]` for `line`: `{ type: 'line', name, data: values, color: p.series[i], symbol: ['circle', 'triangle'][i], symbolSize: 8, showAllSymbol: true, lineStyle: { width: 2, type: ['solid', 'dashed'][i] }, endLabel: { show: true, formatter: '{a}', color: p.series[i] } }`.</li></ul>**`useChart(spec)`:** a `ref` and a `state` (`'loading'`, then `'ready'` or `'error'`). Its effect is keyed on `JSON.stringify(spec)`, so a new object with the same content does not redraw. On load it calls `init(ref.current, null, { renderer: 'svg' })`, then `setOption(chartOption(spec, palette(ref.current)))`, then sets `'ready'`. It listens to window `resize` (calls `chart.resize()`). Cleanup sets a `live` flag false, removes the listener and calls `dispose()`, which is safe under StrictMode's double effect. A load failure sets `'error'`. |
| `chart.tsx`           | `Chart({ spec })` (kit component: no `className`/`style` prop). About 70 lines. Renders `<figure className="flex flex-col gap-2">`:<ul><li>`<figcaption className="text-body font-semibold">{spec.title}</figcaption>`;</li><li>`<div ref data-testid="chart" data-chart-state={state} role="img" aria-label={t('kit.chart.label', { title: spec.title })} className="h-48 w-full" />`;</li><li>when `state === 'error'`, `<p className="text-footnote text-neutral-600">{t('kit.chart.unavailable')}</p>`;</li><li>`<details>` with `<summary className="flex min-h-target cursor-pointer items-center text-body font-semibold text-accent-strong">{t('kit.chart.table')}</summary>` and `<table className="w-full text-left text-footnote">`: a `<thead>` row with `<th scope="col">{spec.categoryLabel}</th>` and one `<th scope="col">` per series name; then per category a `<tr>` with `<th scope="row">{category}</th>` and one `<td className="tabular-nums">` per series value. Cells use `p-2`; body rows use `border-t border-neutral-200`.</li></ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `chart-guard.test.ts` | K1-K3 (§6).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

**Kit edits**

| File            | Change                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ui/button.tsx` | `VARIANT.secondary` becomes `'bg-surface border border-neutral-300 text-neutral-900 aria-pressed:ring-2 aria-pressed:ring-accent-strong aria-pressed:text-accent-strong'` (decision 9). Nothing else.                                                                                                                                                                                                                          |
| `ui/tokens.css` | Append to the existing `:root { … }` block (not `@theme`: these are read by script, not used as utilities): `--color-chart-1: var(--color-accent);` `--color-chart-2: var(--color-neutral-600);` `--color-chart-axis: var(--color-neutral-600);` `--color-chart-grid: var(--color-neutral-200);` with the comment `/* Charts (D23): series 1 and 2, axis text, grid lines. Series 2 is also dashed with triangle markers. */`. |

**Patterns (`apps/web/src/patterns/`; each new file under 250 lines, every function under 60)**

| File                       | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `form-sheet.tsx` (edit)    | `FormSheetProps` gains `initial?: Record<string, string>`; `useState<Record<string, string>>(p.initial ?? {})`. Nothing else (the gallery's form examples pass none: same as today).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `crud-page.tsx` (new)      | `LabelKey`, `CrudRow`, `CrudField`, `CrudSpec`, `CrudPage` (§4). About 150 lines. Three functions:<br>**`useCrud(spec)`** (state and handlers):<ul><li>`resource = useMemo(() => defineResource<unknown, Row>(spec), [spec])`, then `list = resource.useList()`, `create = resource.useCreate()`, `update = resource.useUpdate()`;</li><li>`sheet: { row: Row \| null } \| null` and `error: string \| null` (both `useState`);</li><li>`valuesOf(row)` = `Object.fromEntries(spec.fields.map((f) => [f.name, String(row[f.name] ?? '')]))`;</li><li>`save(values)`: clear the error; when editing, `await update.mutateAsync({ id: row.id, body: { ...values, active: row.active } })`, otherwise `await create.mutateAsync(values)`; return `true`. On a throw, set `t('kit.crud.error')` and return `false`;</li><li>`toggle(row)`: clear the error; `await update.mutateAsync({ id: row.id, body: { ...valuesOf(row), active: !row.active } })`; on a throw, set `t('kit.crud.error')`;</li><li>`open(row)`: clear the error and set the sheet.</li></ul>**`CrudPage({ spec })`** renders `PatternFrame title={t(spec.titleKey)}`:<ul><li>a primary `Button` `t('kit.crud.add')` → `open(null)`;</li><li>when the sheet is closed and there is an error, `<p role="alert" className="text-body font-medium text-neutral-900">{error}</p>`;</li><li>`viewState({ online: useOnline(), hasData, isEmpty, error: list.error })`; `ready` → `CrudTable`, otherwise `StateNotice` with `empty={t(spec.emptyKey)}` and `onRetry` = `list.refetch()`;</li><li>`{sheet ? <FormSheet open … /> : null}` with `onOpenChange={(o) => { if (!o) setSheet(null); }}`, `title` = `t('kit.crud.add')` for a new row or `t('kit.crud.editTitle', { name: valuesOf(row)[spec.fields[0].name] })` for an edit, `submitLabel={t('kit.crud.save')}`, `fields` = `spec.fields` mapped to `{ name, label: t(labelKey), required }`, `initial={row ? valuesOf(row) : {}}`, `offlineAllowed={false}`, `pending={create.isPending \|\| update.isPending}`, `error={error}`, `onSubmit={save}`.</li></ul>**`CrudTable`** renders `<div className="overflow-x-auto">` → `<table className="w-full text-left text-footnote">`:<ul><li>`<thead>`: one `<th scope="col" className="p-2 font-medium text-neutral-600">` per field (`t(labelKey)`), one for `t('kit.crud.status')`, and one holding `<span className="sr-only">{t('kit.crud.actions')}</span>`;</li><li>`<tbody>`: per row `<tr key={row.id} className="border-t border-neutral-200">`. The first field is `<th scope="row" className="p-2 font-medium">`, the others `<td className="p-2">`. Then the status `<td className="p-2">` with `row.active ? t('kit.crud.on') : t('kit.crud.off')`. Then a `<td className="p-2">` holding `Stack gap={2}` with two secondary Buttons: `t('kit.crud.edit')` → `open(row)`, and `row.active ? t('kit.crud.switchOff') : t('kit.crud.switchOn')` → `toggle(row)` with `disabled={update.isPending}`.</li></ul> |
| `wizard-page.tsx` (new)    | `WizardStep`, `WizardPageProps`, `WizardPage` (§4). About 110 lines. State: `index`, `pending`, `failed`, `done`.<ul><li>`last = index === steps.length - 1`; `notice = last ? offlineNotice(useOnline(), offlineAllowed) : null`.</li><li>**Primary:** not last → `index + 1`. Last → `pending = true`, `failed = false`, `await onFinish()`, then `done = true`; a throw sets `failed = true`; `pending = false` in `finally`.</li><li>**Back** (secondary, `t('common.back')`) shows when `index > 0 && !pending`. It goes to `index - 1` and clears `failed`.</li><li>**Focus:** after a user move (a ref flag set by Primary and Back, never on first render), focus goes to the step `<h3 tabIndex={-1}>`, or to the result wrapper `<div tabIndex={-1}>` once done.</li><li>**Render** (`PatternFrame title`): when done, only the result wrapper. Otherwise `Stack gap={3}` holding, in order:<ul><li>`<p className="text-footnote text-neutral-600">{t('kit.wizard.step', { n: index + 1, total })}</p>`;</li><li>`<h3 className="text-title3 font-semibold">{step.title}</h3>`;</li><li>`step.body`;</li><li>when `notice`, `<p role="status" className="text-footnote text-neutral-600">{t(notice)}</p>`;</li><li>when `failed`, `<p role="alert" className="text-body font-medium text-neutral-900">{t('kit.wizard.error')}</p>`;</li><li>`Inline gap={2}` with Back, then the primary `Button`: `disabled={!step.ready \|\| pending \|\| notice === 'kit.form.needsConnection'}`, text `pending ? t('common.sending') : step.action`.</li></ul></li></ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `board-page.tsx` (new)     | `BoardGroup`, `BoardFilter`, `BoardPageProps`, `BoardPage` (§4). About 100 lines. `filterId` state starts at `filters[0].id`; `list = resource.useList(current.query)`; items = all pages flattened (first page only is fetched: no "load more" on a board).<ul><li>**Always** (so a filter that empties the board can be undone): `<div role="group" aria-label={t('kit.board.filter')}>` → `Inline gap={2}` → one secondary `Button` per filter, `aria-pressed={f.id === filterId}`, `onClick` sets `filterId`.</li><li>**`ready`:** per group `<section aria-labelledby={headingId}>` → `Stack gap={2}` → `<h3 id className="text-title3 font-semibold">{t('kit.board.group', { title: g.title, count })}</h3>`, then, when `count > 0`, `<ul className="flex flex-col gap-3">` of `<li key={rowKey(row)}>{tile(row)}</li>` for that group's rows. Heading ids come from `useId()` plus the group id.</li><li>**Other states:** `StateNotice` with `onRetry` = `refetch()`.</li></ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `dashboard-page.tsx` (new) | `KpiTile`, `DashboardPageProps`, `DashboardPage` (§4). About 80 lines. `one = resource.useOne()`; `viewState` with `isEmpty: false`; otherwise `StateNotice`.<ul><li>**`ready`, KPI list:** `<ul className="grid grid-cols-2 gap-3">`, one `<li key={label}>` per tile.<ul><li>With `to`: `<Link to={to} className="flex min-h-target flex-col gap-1 rounded-2xl bg-surface p-4 shadow-card focus-visible:outline-2 focus-visible:outline-accent-strong">`.</li><li>Without: a `<div>` with the same classes minus `focus-visible:*`.</li><li>Inside either: `<span className="text-footnote text-neutral-600">{label}</span>` and `<span className="text-title1 font-semibold tabular-nums">{value}</span>`.</li></ul></li><li>**`ready`, charts:** one `<Card>` (no title) per chart spec, holding `<Chart spec={spec} />`, keyed by `spec.title`.</li></ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

**Gallery (`apps/web/src/gallery/`)**

| File                          | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `patterns-data.ts` (edit)     | `export` on `never` and `failing`. `resources` becomes `export function resources<TOne, TItem, S extends string>(kind: string, transports: Record<S, Transport>, path = '/gallery/tickets'): Record<S, Resource<TOne, TItem>>`, built from `Object.entries(transports)` (key `gallery-<kind>-<state>`, the given `path`). The `queueResources` and `detailResources` calls are unchanged (same keys, same path).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `patterns-section.tsx` (edit) | `export const galleryQueries` (add `export`). Nothing else.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `crud-data.ts` (new)          | The fake machines API (§4 "Gallery fixtures"): `GalleryMachine`, `GalleryRequest`, `requests`, `machinesTransport`. No JSX.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `crud-spec.ts` (new)          | The one declarative spec, at most 60 lines, no JSX: `export const machinesSpec: CrudSpec<GalleryMachine> = { key: 'gallery-machines', path: '/gallery/machines', transport: machinesTransport, titleKey: 'gallery:crud.title', emptyKey: 'gallery:crud.empty', fields: [{ name: 'code', labelKey: 'gallery:crud.field.code', required: true }, { name: 'name', labelKey: 'gallery:crud.field.name', required: true }] };`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `more-data.ts` (new)          | Board and dashboard fixtures and resources, and the wizard's choices (§4 "Gallery fixtures"). No JSX.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `crud-section.tsx` (new)      | `CrudSection`: `<QueryClientProvider client={galleryQueries}>` → `<section data-testid="gallery-crud" aria-labelledby="gallery-crud-h">` → `Stack` → `<h2 id="gallery-crud-h" className="text-title3 font-semibold">{t('section.crud')}</h2>` and `<CrudPage spec={machinesSpec} />`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `wizard-section.tsx` (new)    | `WizardSection`: `<section data-testid="gallery-wizard" aria-labelledby="gallery-wizard-h">`, `h2` `t('section.wizard')`, then three `<div data-testid="gallery-wizard-<state>">` for `ready`, `error`, `offline`. Each holds a `WizardPage` titled `t('example', { name: t('wizard.name'), state: t('state.<state>') })`, with `offlineAllowed={false}` and `result={<p className="text-body">{t('wizard.sent')}</p>}`.<ul><li>**`ready`** (three steps; `machine` and `problem` are `useState<string \| null>(null)`):<ol><li>`t('wizard.machine')`: an `Inline gap={2}` of secondary Buttons per `WIZARD_MACHINES`, `aria-pressed={m === machine}`; action `t('wizard.next')`; `ready: machine !== null`.</li><li>`t('wizard.problem')`: a `Stack gap={2}` of secondary Buttons per `WIZARD_PROBLEMS` (`t(key)`, `aria-pressed`); action `t('wizard.next')`; `ready: problem !== null`.</li><li>`t('wizard.check')`: `<p className="text-body">{machine} · {t(problem)}</p>`; action `t('wizard.send')`; `ready: true`.</li></ol>`onFinish = async () => undefined`.</li><li>**`error`:** one step, `t('wizard.check')`, body `<p className="text-body">CNC-07 · {t('queue.problem.1')}</p>` (the code comes from `WIZARD_MACHINES[0]`), action `t('wizard.send')`, `ready: true`; `onFinish = () => Promise.reject(new Error('Sample error'))`.</li><li>**`offline`:** the same single step and `onFinish` as `ready`, inside `<OnlineContext.Provider value={false}>`.</li></ul> |
| `board-section.tsx` (new)     | `BoardSection`: provider `galleryQueries`; `<section data-testid="gallery-board" aria-labelledby="gallery-board-h">`, `h2` `t('section.board')`, then one `<div data-testid="gallery-board-<state>">` per `EXAMPLES` state (`offline` inside `<OnlineContext.Provider value={false}>`). Each holds a `BoardPage<BoardRow>`:<ul><li>`title` = `t('example', { name: t('board.name'), state: t('state.<state>') })`, `resource={boardResources[state]}`;</li><li>`groups` = `stopped`, `in_progress`, `waiting`, titled `t('translation:status.ticket.stopped' \| '…inProgress' \| '…waiting')`; `groupOf={(r) => r.status}`;</li><li>`filters` = `{ id: 'all', label: t('board.filter.all'), query: {} }`, `{ id: 'cnc', label: t('segment.cnc'), query: { segment: 'cnc' } }`, `{ id: 'conventional', label: t('segment.conventional'), query: { segment: 'conventional' } }`;</li><li>`tile={(r) => <Card title={r.ref}><p className="text-body">{r.machine} · {t(r.problemKey)}</p></Card>}`, `rowKey={(r) => r.id}`, `empty={t('board.empty')}`.</li></ul>                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `dashboard-section.tsx` (new) | `DashboardSection`: provider `galleryQueries`; `<section data-testid="gallery-dashboard" aria-labelledby="gallery-dashboard-h">`, `h2` `t('section.dashboard')`, then one `<div data-testid="gallery-dashboard-<state>">` per `DASHBOARD_EXAMPLES` (`offline` inside `<OnlineContext.Provider value={false}>`). Each holds a `DashboardPage<GalleryDashboard>` with `title` = `t('example', { name: t('dashboard.name'), state: t('state.<state>') })`, `resource={dashboardResources[state]}`, `empty={t('dashboard.empty')}`.<ul><li>**`kpis`:**<ul><li>`{ label: t('dashboard.kpi.open'), value: String(d.open), to: { search: useLocation().search, hash: '#gallery-queue' } }`;</li><li>`{ label: t('dashboard.kpi.stopped'), value: String(d.stopped) }`;</li><li>`{ label: t('dashboard.kpi.repair'), value: d.repair }`.</li></ul></li><li>**`charts`:**<ol><li>`{ kind: 'bar', title: t('dashboard.chart.bySegment'), categoryLabel: t('dashboard.axis.segment'), categories: SEGMENTS.map((s) => t(\`segment.${s}\`)), series: [{ name: t('dashboard.series.breakdowns'), values: d.bySegment }] }`;</li><li>`{ kind: 'line', title: t('dashboard.chart.downtime'), categoryLabel: t('dashboard.axis.week'), categories: d.weeks, series: [{ name: t('segment.cnc'), values: d.downtime.cnc }, { name: t('segment.conventional'), values: d.downtime.conventional }] }`.</li></ol></li></ul>                                                                                |
| `Gallery.tsx` (edit)          | Import and render `<CrudSection />`, `<WizardSection />`, `<BoardSection />`, `<DashboardSection />` after `<FormSection />`, in that order. Nothing else.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `strings.ts` (edit)           | `galleryEn` gains the 32 keys of §5 (`galleryGu` derives them).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

**Lint (`i18next/no-literal-string`).**

- **Patterns and `ui/chart/chart.tsx`** (as ticket 11): put `{/* eslint-disable-next-line i18next/no-literal-string -- prop value, not copy */}` (or the `//` form inside a tag) above each literal `variant=` or `scope=` line.
- **The four new gallery `.tsx` files** start with the same file-level disable that `patterns-section.tsx` uses.
- **`.ts` files are not under the rule.** The data files hold machine codes (`CNC-07`) and week labels (`W41`) as data, never as copy.

**Config, dependency and records**

| File                                               | Change                                                                                                                                                                                                                                                                            |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/package.json`                            | `"echarts": "6.1.0"` in `dependencies` (exact pin, alphabetical after `@uptimo/shared`). `pnpm install` updates `pnpm-lock.yaml`.                                                                                                                                                 |
| `apps/web/vite.config.ts`                          | `optimizeDeps` line of decision 10, after `plugins`.                                                                                                                                                                                                                              |
| `THIRD_PARTY.md`                                   | The row `Apache ECharts` becomes `Apache ECharts (\`echarts\` 6.1.0; brings \`zrender\` 6.1.0, BSD-3-Clause, and \`tslib\` 2.3.0, 0BSD)`·`charts`·`Apache-2.0`. Nothing else.                                                                                                     |
| `packages/shared/src/i18n/common.en.ts`            | The 18 `kit.*` keys of §5, appended after `kit.form.needsConnection`. `common.gu.ts` is `blank(commonEn)`: unchanged.                                                                                                                                                             |
| `packages/shared/test/fixtures/en-before-05.json`  | The same 18 keys and values appended after `kit.form.needsConnection`; no existing line changes; `catalogue.test.ts` untouched (its "changes no existing copy" check reads this file).                                                                                            |
| `docs/decisions/D23-charts-echarts.md` (new)       | §7.                                                                                                                                                                                                                                                                               |
| `docs/decisions/D05-generated-settings-screens.md` | One line appended: `Amended 13 November 2026 by D23 (ticket 12): until a resource needs sorting, column choice, virtualised rows or schema field errors, \`CrudPage\` uses a plain \`<table>\` and \`FormSheet\`; TanStack Table and react-hook-form are deferred, not rejected.` |
| `changes/88-page-patterns-more.md` (new)           | §8.                                                                                                                                                                                                                                                                               |

**Browser tests and baselines**

- `apps/web/e2e/gallery/gallery.spec.ts`: append C1-C5, W1-W2, B1-B2, D1-D3 (§6). No existing test is edited.
  Each test callback stays under 60 lines (the ESLint rule covers `*.spec.ts`). Two helpers go at the end of the
  file's helper block, and the `node:fs` import gains `readFileSync` (C1):
  - `async function crudRequests(page: Page): Promise<{ method: string; path: string; body: unknown }[]>`
    = `page.evaluate((u) => import(/* @vite-ignore */ u).then((m) => m.requests), '/src/gallery/crud-data.ts')`;
  - `const crudRow = (page: Page, code: string) => page.getByTestId('gallery-crud').locator('tbody tr', { hasText: code })`.
- `apps/web/e2e/gallery/__screenshots__/`: 8 new PNGs from `pnpm gallery:update:docker`: `crud-{en,gu}.png`,
  `wizard-{en,gu}.png`, `board-{en,gu}.png` and `dashboard-{en,gu}.png`. The 22 existing PNGs must come out
  byte-identical: the new sections sit below `gallery-forms`, the page-level shots are viewport shots of the page
  top, and no existing secondary button is pressed. If `git diff --stat` shows any of the 22 changed, the coder
  stops and returns the question.

## 4. Interfaces

```ts
// data/resource.ts (added; everything else unchanged)
export interface Resource<TOne, TItem> {
  // …ticket 11's members…
  /** POST path, JSON body; on success awaits invalidateQueries({ queryKey: [key] }). */
  useCreate(): UseMutationResult<unknown, Error, unknown>;
  /** PUT url(id), JSON body; on success awaits invalidateQueries({ queryKey: [key] }). */
  useUpdate(): UseMutationResult<unknown, Error, { id: string; body: unknown }>;
}
// No delete method exists. Switching off is useUpdate with { …fields, active: false }.

// ui/chart/use-chart.ts
export interface ChartSeries {
  name: string; // translated; end label, table header
  values: number[]; // one per category
}
export type ChartSpec =
  | {
      kind: 'bar';
      title: string;
      categoryLabel: string;
      categories: string[];
      series: [ChartSeries];
    }
  | {
      kind: 'line';
      title: string;
      categoryLabel: string;
      categories: string[];
      series: [ChartSeries] | [ChartSeries, ChartSeries];
    };
export type ChartState = 'loading' | 'ready' | 'error';
export function useChart(spec: ChartSpec): {
  ref: RefObject<HTMLDivElement | null>;
  state: ChartState;
};

// ui/chart/chart.tsx
export function Chart(p: { spec: ChartSpec }): JSX.Element;

// patterns/form-sheet.tsx (added)
export interface FormSheetProps {
  // …ticket 11's members…
  initial?: Record<string, string>; // first values of the fields; default {}
}

// patterns/crud-page.tsx
export type LabelKey = MessageKey | `gallery:${string}`;
export interface CrudRow {
  id: string;
  active: boolean;
}
export interface CrudField<Row> {
  name: keyof Row & string;
  labelKey: LabelKey;
  required?: boolean;
}
export interface CrudSpec<Row extends CrudRow> extends ResourceSpec {
  titleKey: LabelKey;
  emptyKey: LabelKey;
  fields: CrudField<Row>[]; // table columns (first = row header) and form fields
}
export function CrudPage<Row extends CrudRow>(p: { spec: CrudSpec<Row> }): JSX.Element;

// patterns/wizard-page.tsx
export interface WizardStep {
  title: string;
  body: ReactNode;
  action: string; // the step's one primary action
  ready: boolean; // primary enabled
}
export interface WizardPageProps {
  title: string;
  steps: WizardStep[]; // in order; the last step's action finishes
  offlineAllowed: boolean;
  onFinish: () => Promise<void>; // a throw shows kit.wizard.error and stays on the last step
  result: ReactNode; // shown alone once onFinish resolves
}
export function WizardPage(p: WizardPageProps): JSX.Element;

// patterns/board-page.tsx
export interface BoardGroup {
  id: string;
  title: string;
}
export interface BoardFilter {
  id: string;
  label: string;
  query: ListQuery;
}
export interface BoardPageProps<Row> {
  title: string;
  resource: Resource<unknown, Row>;
  groups: BoardGroup[]; // in display order; every group shows, even at 0
  groupOf: (row: Row) => string; // a BoardGroup id
  tile: (row: Row) => ReactNode;
  rowKey: (row: Row) => string;
  filters: BoardFilter[]; // the first is selected at start
  empty: string;
}
export function BoardPage<Row>(p: BoardPageProps<Row>): JSX.Element;

// patterns/dashboard-page.tsx
export interface KpiTile {
  label: string;
  value: string; // formatted by the caller
  to?: To; // react-router-dom; the drill-down target
}
export interface DashboardPageProps<T> {
  title: string;
  resource: Resource<T, unknown>;
  kpis: (data: T) => KpiTile[];
  charts: (data: T) => ChartSpec[];
  empty: string; // not_found
}
export function DashboardPage<T>(p: DashboardPageProps<T>): JSX.Element;

// gallery/patterns-data.ts (now exported)
export const never: Transport;
export const failing: Transport;
export function resources<TOne, TItem, S extends string>(
  kind: string,
  transports: Record<S, Transport>,
  path?: string,
): Record<S, Resource<TOne, TItem>>;
export const galleryQueries: QueryClient; // gallery/patterns-section.tsx
```

**Gallery fixtures** (fake codes and phrases only; no names, no phones, no dates, no randomness):

```ts
// gallery/crud-data.ts
export interface GalleryMachine {
  id: string;
  code: string;
  name: string;
  active: boolean;
}
export interface GalleryRequest {
  method: string;
  path: string;
  body: unknown;
}
export const requests: GalleryRequest[] = []; // every call, in order; read by the browser tests
// rows (module state, fresh on each page load):
//   { id: 'm-1', code: 'CNC-07',   name: 'VMC 850',      active: true  }
//   { id: 'm-2', code: 'LATHE-02', name: 'Lathe',        active: true  }
//   { id: 'm-3', code: 'DRILL-01', name: 'Radial drill', active: false }
export const machinesTransport: Transport;
```

`machinesTransport(path, init)`:

1. Push `{ method: init?.method ?? 'GET', path, body: init?.body ? JSON.parse(String(init.body)) : undefined }`.
2. Answer by method:
   - **`GET`:** `{ items: rows.map((r) => ({ ...r })), nextCursor: null }`.
   - **`POST`:** if a row has `body.code`, reject `new ApiError('conflict', 'Code already used')`. Otherwise
     push `{ id: \`m-${rows.length + 1}\`, code: body.code, name: body.name, active: true }` and return a copy.
   - **`PUT`:** `id` = `decodeURIComponent` of the last path segment; no row → reject
     `new ApiError('not_found', 'Not found')`. If `id === 'm-3' && body.active === true`, reject
     `new ApiError('conflict', 'Machine is retired')` (the API's refusal to switch one back on). Otherwise set
     `code`, `name` and `active` from `body` and return a copy.
   - **Any other method:** reject `new ApiError('method_not_allowed', 'Not allowed')`.

```ts
// gallery/more-data.ts
export const WIZARD_MACHINES = ['CNC-07', 'LATHE-02', 'DRILL-01'] as const;
export const WIZARD_PROBLEMS = ['queue.problem.1', 'queue.problem.2', 'queue.problem.3'] as const;
export const SEGMENTS = ['cnc', 'conventional', 'process', 'utilities'] as const;

export interface BoardRow {
  id: string;
  ref: string;
  machine: string;
  segment: 'cnc' | 'conventional';
  status: 'stopped' | 'in_progress' | 'waiting';
  problemKey: string;
}
// BOARD_ROWS:
//   b-1 BD-0101 CNC-07   cnc          stopped     queue.problem.1
//   b-2 BD-0102 LATHE-02 conventional stopped     queue.problem.2
//   b-3 BD-0103 VMC-03   cnc          in_progress queue.problem.3
//   b-4 BD-0104 DRILL-01 conventional in_progress queue.problem.4
//   b-5 BD-0105 CNC-11   cnc          waiting     queue.problem.5
export const boardResources: Record<Example, Resource<unknown, BoardRow>>;
//   resources('board', …, '/gallery/board')
//   ready: reads `segment` from new URL(path, 'http://gallery.invalid'); none → all rows, else
//          rows of that segment; { items, nextCursor: null }
//   empty: { items: [], nextCursor: null }; error: failing; loading and offline: never

export const DASHBOARD_EXAMPLES = ['ready', 'loading', 'error', 'offline'] as const;
export type DashboardExample = (typeof DASHBOARD_EXAMPLES)[number];
export interface GalleryDashboard {
  open: number;
  stopped: number;
  repair: string;
  bySegment: number[]; // in SEGMENTS order
  weeks: string[];
  downtime: { cnc: number[]; conventional: number[] };
}
// DASHBOARD = { open: 5, stopped: 2, repair: '1:40', bySegment: [4, 2, 1, 0],
//   weeks: ['W41', 'W42', 'W43', 'W44', 'W45', 'W46'],
//   downtime: { cnc: [12, 9, 14, 8, 6, 7], conventional: [5, 7, 4, 6, 3, 4] } }
export const dashboardResources: Record<DashboardExample, Resource<GalleryDashboard, unknown>>;
//   resources('dashboard', …, '/gallery/dashboard'); ready → DASHBOARD; error: failing;
//   loading and offline: never
```

## 5. Data and exact strings

No table, column, migration, API route, contract or IndexedDB change. Browser state read or written:

- **TanStack Query cache:** the gallery's own `QueryClient`. New keys: `['gallery-machines', 'list', {}]`,
  `['gallery-board-<state>', 'list', <filter query>]` and `['gallery-dashboard-<state>', 'one', null]`.
  `invalidateQueries({ queryKey: ['gallery-machines'] })` runs after each successful create or update.
- **Module memory (gallery only, reset on reload):** `crud-data.ts` holds the `rows` and the `requests` log.
- **CSS custom properties** read by `useChart`: `--color-chart-1`, `--color-chart-2`, `--color-chart-axis`,
  `--color-chart-grid`, `--font-sans`.

No personal data: machine codes, model-like names, refs and problem phrases only.

**Wire shapes for a `CrudSpec` resource** (what `CrudPage` sends; the gallery's fake answers them):

| Action     | Request                                                                   |
| ---------- | ------------------------------------------------------------------------- |
| List       | `GET <path>` → `CursorPage<Row>`                                          |
| Add        | `POST <path>` with the form values `{ <field>: string … }` → the new row  |
| Edit       | `PUT <path>/<id>` with `{ <every field>: string …, active: <unchanged> }` |
| Switch off | `PUT <path>/<id>` with `{ <every field>: <current> …, active: false }`    |
| Switch on  | `PUT <path>/<id>` with `{ <every field>: <current> …, active: true }`     |

**`common.en.ts` (+18):**

| Key                     | English                                                     |
| ----------------------- | ----------------------------------------------------------- |
| `kit.crud.add`          | Add                                                         |
| `kit.crud.edit`         | Edit                                                        |
| `kit.crud.editTitle`    | Edit {{name}}                                               |
| `kit.crud.save`         | Save                                                        |
| `kit.crud.status`       | Status                                                      |
| `kit.crud.on`           | On                                                          |
| `kit.crud.off`          | Off                                                         |
| `kit.crud.switchOff`    | Switch off                                                  |
| `kit.crud.switchOn`     | Switch on                                                   |
| `kit.crud.actions`      | Actions                                                     |
| `kit.crud.error`        | Could not save. Check the details and try again.            |
| `kit.wizard.step`       | Step {{n}} of {{total}}                                     |
| `kit.wizard.error`      | Could not send. Try again.                                  |
| `kit.board.filter`      | Filter                                                      |
| `kit.board.group`       | {{title}} ({{count}})                                       |
| `kit.chart.label`       | {{title}}. The numbers are in the table below.              |
| `kit.chart.table`       | Show the numbers                                            |
| `kit.chart.unavailable` | The chart could not be drawn. The numbers are in the table. |

Reused: `common.back` (Back), `common.sending` (Sending…), `common.loading`, `kit.pattern.*`,
`kit.form.needsConnection`, `status.ticket.stopped`, `status.ticket.inProgress`, `status.ticket.waiting`,
`status.sync.*`. `common.gu.ts` is blank, so Gujarati shows these in English.

**`galleryEn` (+32):**

- **Sections:** `section.crud` Settings page (generated from one spec) · `section.wizard` Wizard page ·
  `section.board` Board page · `section.dashboard` Dashboard page.
- **CRUD:** `crud.title` Machines · `crud.empty` No machines yet. · `crud.field.code` Code · `crud.field.name` Name.
- **Wizard:** `wizard.name` Report a breakdown · `wizard.machine` Which machine? · `wizard.problem` What is wrong? ·
  `wizard.check` Check and send · `wizard.next` Next · `wizard.send` Send ·
  `wizard.sent` Sent. The maintenance team has been told.
- **Board:** `board.name` Live board · `board.empty` No machines need attention. · `board.filter.all` All segments.
- **Segments:** `segment.cnc` CNC · `segment.conventional` Conventional · `segment.process` Process ·
  `segment.utilities` Utilities.
- **Dashboard:** `dashboard.name` Today · `dashboard.empty` No figures yet. · `dashboard.kpi.open` Open tickets ·
  `dashboard.kpi.stopped` Machines stopped · `dashboard.kpi.repair` Mean time to repair (h:mm) ·
  `dashboard.chart.bySegment` Breakdowns by segment this week · `dashboard.chart.downtime` Downtime hours per week
  · `dashboard.axis.segment` Segment · `dashboard.axis.week` Week · `dashboard.series.breakdowns` Breakdowns.

`galleryGu` derives `ક ખ ગ · <English>` for each, as today.

## 6. Test cases (each fails first)

Order: write each test, see it red, then build. The only tests are G1, G2 and the echarts guard and bundle check.
Every other existing test must stay green unchanged.

**Guard and bundle: `apps/web/src/ui/chart/chart-guard.test.ts`**

Helpers in the file:

- `readSrc()`: as in `fetch-guard.test.ts`. It walks `apps/web/src`, returns `{ path, text }` relative to `src` with
  `/` separators, and skips `*.test.ts`.
- `echartsErrors(files)`: scans each file's whole text with three global regexes and reports line
  `text.slice(0, index).split('\n').length` for each hit:
  - `STATIC = /\b(?:import|export)\s+(type\s+)?[^;'"]*?\bfrom\s*'([^']+)'/g`, multi-line safe;
  - `BARE = /\bimport\s*'([^']+)'/g`;
  - `DYNAMIC = /\bimport\(\s*'([^']+)'\s*\)/g`.

  A specifier matching `/^echarts(?:\/|$)/` gives:
  - in any file other than `ui/chart/use-chart.ts`: `"<path>:<line>: echarts outside ui/chart/use-chart.ts"`;
  - in `ui/chart/use-chart.ts`, a `STATIC` hit without `type`, or any `BARE` hit:
    `"<path>:<line>: static echarts import; use import()"`.

  Results come in file order, then by position.

Write `echartsErrors` as a stub returning `[]` first, so K2 is red too.

1. **K1 `echarts is reached only through import() in ui/chart/use-chart.ts`.**
   - **Given** the real tree.
   - **When** checked.
   - **Then** `echartsErrors(files)` is `[]`, and `ui/chart/use-chart.ts` exists and matches
     `/import\(\s*'echarts\/core'\s*\)/`.
   - Red on `main`: the file does not exist.
2. **K2 `flags a planted echarts import outside the chart module and a static one inside it`.**
   - **Given** these in-memory files:
     - `faces/x.tsx` = `import { init } from 'echarts/core';`
     - `patterns/y.tsx` = `const a = 1;\nconst m = await import('echarts');`
     - `ui/chart/use-chart.ts` = `import type {\n  ComposeOption,\n} from 'echarts/core';\nimport { use } from 'echarts/core';\nconst c = import('echarts/charts');`
     - `gallery/z.ts` = `// echarts is drawn by ui/chart\nimport { Chart } from '../ui/chart/chart.js';`
   - **When** checked.
   - **Then** the result is exactly `['faces/x.tsx:1: echarts outside ui/chart/use-chart.ts',
'patterns/y.tsx:2: echarts outside ui/chart/use-chart.ts', 'ui/chart/use-chart.ts:4: static echarts import;
use import()']`.
3. **K3 `the gallery build keeps echarts out of the start-up files`** (`{ timeout: 60_000 }`).
   - **Given** `out = mkdtempSync(join(tmpdir(), 'uptimo-chart-'))`.
   - **When** `execFileSync(join(WEB, 'node_modules/.bin/vite'), ['build', '--outDir', out, '--emptyOutDir',
'--logLevel', 'error'], { cwd: WEB, env: { ...process.env, NODE_ENV: 'production', VITE_GALLERY: 'on' } })`
     runs (`WEB` = `apps/web`, resolved from `import.meta.url`).
   - **Then**, with `start` = every `/assets/*.js` named in `out/index.html` (the `<script src>` and each
     `rel="modulepreload"` `href`), `marker = '_echarts_instance_'`:
     - no `start` file contains `marker`;
     - the one `assets/Gallery-*.js` file does not contain it;
     - at least one other `assets/*.js` file does.
   - Finally `rmSync(out, { recursive: true, force: true })`.
   - Red on `main`: no file contains the marker.

**G1: one spec generates a working settings page (`apps/web/e2e/gallery/gallery.spec.ts`)**

Every G1 test opens `/gallery?lang=en` with the file's `open()` unless stated. `crud` =
`page.getByTestId('gallery-crud')`.

4. **C1 `crud: one short spec lists the machines and adds one through the API`.**
   - **Given** `readFileSync('apps/web/src/gallery/crud-spec.ts', 'utf8').split('\n').length` ≤ 60 (the gallery
     config runs from the repo root).
   - **Then:**
     - `crud.locator('tbody tr')` has 3 rows;
     - `crudRow(page, 'CNC-07')` contains `VMC 850` and `On`; `crudRow(page, 'DRILL-01')` contains `Off`.
   - **When** `Add` is clicked, `Code` is filled with `MILL-03`, `Name` with `Milling machine`, and `Save` is
     clicked.
   - **Then:**
     - the dialog is hidden;
     - there are 4 rows, and `crudRow(page, 'MILL-03')` contains `Milling machine` and `On`;
     - `(await crudRequests(page)).filter((r) => r.method !== 'GET')` equals
       `[{ method: 'POST', path: '/gallery/machines', body: { code: 'MILL-03', name: 'Milling machine' } }]`;
     - the first request is `{ method: 'GET', path: '/gallery/machines' }` (`toMatchObject`).
5. **C2 `crud: edits a machine through the API`.**
   - **When** `Edit` in `crudRow(page, 'LATHE-02')` is clicked.
   - **Then** `getByRole('dialog', { name: 'Edit LATHE-02' })` is visible with focus inside, and `Name` has value
     `Lathe`.
   - **When** `Name` is filled with `Lathe (CNC)` and `Save` is clicked.
   - **Then:**
     - the dialog is hidden;
     - `crudRow(page, 'LATHE-02')` contains `Lathe (CNC)` and `On`;
     - the non-GET requests equal `[{ method: 'PUT', path: '/gallery/machines/m-2', body: { code: 'LATHE-02',
name: 'Lathe (CNC)', active: true } }]`.
6. **C3 `crud: switches a machine off and on again, never deleting`.**
   - **When** `Switch off` in `crudRow(page, 'LATHE-02')` is clicked.
   - **Then** that row contains `Off` and a button `Switch on`, and the table still has 3 rows.
   - **When** `Switch on` in that row is clicked.
   - **Then** it contains `On` and a button `Switch off`.
   - **And:**
     - the non-GET requests equal two `PUT /gallery/machines/m-2` bodies, `{ code: 'LATHE-02', name: 'Lathe',
active: false }` and then the same with `active: true`;
     - no request has method `DELETE`;
     - every method is one of `GET`, `POST`, `PUT`.
7. **C4 `crud: shows the API's refusal and keeps the data`.**
   - **First refusal (switch on):**
     - **When** `Switch on` in `crudRow(page, 'DRILL-01')` is clicked.
     - **Then** `crud.getByRole('alert')` contains `Could not save. Check the details and try again.`, and that row
       still contains `Off`.
   - **Second refusal (duplicate code):**
     - **When** `Add` is clicked (the table alert disappears), then `Code` = `CNC-07`, `Name` = `Duplicate`, `Save`.
     - **Then** the dialog stays visible and its `role=alert` contains `Could not save. Check the details and try
again.`
     - **When** Escape is pressed.
     - **Then** the dialog is hidden and the table has 3 rows.
   - **And** the non-GET requests equal `[{ PUT /gallery/machines/m-3, { code: 'DRILL-01', name: 'Radial drill',
active: true } }, { POST /gallery/machines, { code: 'CNC-07', name: 'Duplicate' } }]`.
8. **C5 `crud <lang>: the generated page matches its baseline at 360 px, axe clean`** (en, gu: 2 tests).
   - **Given** `/gallery?lang=<lang>`.
   - **Then:**
     - `crud` has a button exactly `Add` (gu: shared key, English fallback);
     - a column header contains `Code` (gu: `ક ખ ગ · Code`);
     - `crud` matches `crud-<lang>.png`;
     - axe (`AXE_TAGS`) finds 0 violations.

**G2: wizard, board and dashboard in the gallery (`apps/web/e2e/gallery/gallery.spec.ts`)**

9. **W1 `wizard <lang>: one primary action per step, back, then the result screen`** (en, gu: 2 tests).
   - **Given** `/gallery?lang=<lang>` and `w = getByTestId('gallery-wizard-ready')`.
   - **Then:**
     - `gallery-wizard` matches `wizard-<lang>.png`;
     - axe finds 0 violations;
     - `w` contains `Step 1 of 3`;
     - the button `/Next/` is disabled.
   - **When** `CNC-07` is clicked.
   - **Then** it has `aria-pressed="true"` and `/Next/` is enabled.
   - **When** `/Next/` is clicked.
   - **Then** `w` contains `Step 2 of 3` and the heading `/What is wrong\?/` is focused.
   - **When** `Back` is clicked.
   - **Then** `Step 1 of 3` shows and `CNC-07` is still pressed.
   - **When** `/Next/`, `/Spindle noise on start-up/`, `/Next/` are clicked.
   - **Then** `w` contains `Step 3 of 3` and `CNC-07 ·` and `Spindle noise on start-up`.
   - **When** `/Send/` is clicked.
   - **Then:**
     - `w` contains `Sent. The maintenance team has been told.`;
     - no `/Send/` or `/Next/` button remains in `w`;
     - the result text's wrapper is focused.
10. **W2 `wizard: a refused send shows the error; offline it needs a connection`.**
    - **Given** `/gallery?lang=en`.
    - **When** `/Send/` in `gallery-wizard-error` is clicked.
    - **Then** its `role=alert` contains `Could not send. Try again.` and `/Send/` is enabled again.
    - **And** `gallery-wizard-offline` contains `You are offline. Connect to send this.`, its `/Send/` is disabled
      and its `sync-status` has text `/Offline/`.
11. **B1 `board <lang>: groups, tiles and every state at 360 px, axe clean`** (en, gu: 2 tests).
    - **Given** `/gallery?lang=<lang>`.
    - **Then, in `gallery-board-ready`:**
      - headings `Stopped (2)`, `In progress (2)`, `Waiting (1)` (shared keys, so English in gu as well);
      - 5 `li`;
      - `/All segments/` has `aria-pressed="true"`.
    - **Then, in the other examples:**
      - `gallery-board-loading` contains `Loading…`;
      - `gallery-board-empty` contains `No machines need attention.` and still has the `/All segments/` button;
      - `gallery-board-error` has a `role=alert` with `Could not load. Try again.` and a button `Try again`;
      - `gallery-board-offline` contains `You are offline. This will load when you reconnect.` and its
        `sync-status` reads `/Offline/`.
    - **Then** `gallery-board` matches `board-<lang>.png`, and axe finds 0 violations.
12. **B2 `board: filters by segment`.**
    - **Given** `/gallery?lang=en` and `b = getByTestId('gallery-board-ready')`.
    - **When** `/Conventional/` is clicked.
    - **Then:**
      - it has `aria-pressed="true"` and `/All segments/` has `aria-pressed="false"`;
      - `b` has 2 `li`, containing `BD-0102` and `BD-0104`;
      - a heading reads `Waiting (0)`.
    - **When** `/CNC/` is clicked.
    - **Then** `b` has 3 `li`.
13. **D1 `dashboard <lang>: KPI tiles, two charts and every state at 360 px, axe clean`** (en, gu: 2 tests).
    - **Given** `/gallery?lang=<lang>` and `d = getByTestId('gallery-dashboard-ready')`.
    - **Then, the KPIs:**
      - `d.getByRole('link', { name: /Open tickets/ })` contains `5`;
      - `d` contains `Machines stopped`, `2`, `Mean time to repair (h:mm)` and `1:40`.
    - **Then, the charts:**
      - `d.locator('[data-chart-state="ready"]')` has count 2 (timeout 10 s);
      - `d.getByRole('img', { name: /Breakdowns by segment this week/ })` and
        `d.getByRole('img', { name: /Downtime hours per week/ })` are visible.
    - **Then, the other examples:**
      - `gallery-dashboard-loading` contains `Loading…`;
      - `gallery-dashboard-error` has a `role=alert` with `Could not load. Try again.` and a button `Try again`;
      - `gallery-dashboard-offline` contains `You are offline. This will load when you reconnect.`.
    - **Then** `gallery-dashboard` matches `dashboard-<lang>.png`, and axe finds 0 violations.
14. **D2 `dashboard: charts never rely on colour alone and carry their numbers`.**
    - **Given** `/gallery?lang=en` and `line = getByTestId('gallery-dashboard-ready').locator('figure', { hasText:
'Downtime hours per week' })`, ready (as D1).
    - **Then:**
      - `line.locator('path[stroke-dasharray]')` count > 0 (the second series is dashed);
      - `line.locator('svg text', { hasText: 'Conventional' })` and `{ hasText: 'CNC' }` each have count ≥ 1 (end
        labels).
    - **When** `line.getByText('Show the numbers')` is clicked.
    - **Then:**
      - `line.getByRole('table')` is visible;
      - its column headers are exactly `Week`, `CNC`, `Conventional`;
      - its first body row has `W41`, `12`, `5`;
      - it has 6 body rows.
15. **D3 `dashboard: a KPI tile drills down to its target`.**
    - **Given** `/gallery?lang=gu`.
    - **When** the link `/Open tickets/` in `gallery-dashboard-ready` is clicked.
    - **Then** the URL matches `/\/gallery\?lang=gu#gallery-queue$/`, and the page still shows `gallery-root`.

**Must stay green, unchanged:**

- `fetch-guard.test.ts` (F1: the new files use no `fetch`), `resource.test.ts` (R1, R2) and the i18n and catalogue
  tests;
- every existing gallery test (tests 7-13 of slice 10, G1-G4 of slice 11; their page-wide axe runs now cover the
  new sections too: wider, not weaker) and `gallery-prod.spec.ts` (no echarts and no gallery in the production
  build);
- `pnpm test:e2e` (floor, desk and board screens are not touched).

**Commands.**

1. Red first: `pnpm exec vitest run apps/web/src/ui/chart`, then `pnpm gallery:test`.
2. Then `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm ui:check`, `pnpm size`, `pnpm deps`,
   `pnpm licences`, `pnpm pii:scan`, `pnpm build`, `pnpm test:e2e`.
3. Then `pnpm gallery:update:docker`: commit the 8 new PNGs; the 22 old ones are unchanged.
4. Then `pnpm gallery:test`, `pnpm format:check`, `pnpm verify`.

## 7. ADR text (`docs/decisions/D23-charts-echarts.md`)

```
# D23 — Charts: ECharts 6.1.0, lazy, SVG, two series, token palette

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
```

## 8. Changelog

`changes/88-page-patterns-more.md`:

```
- `/gallery` shows a settings page generated from one short description: it lists, adds, edits and switches machines off and on again through the API, and never deletes.
- `/gallery` shows the wizard, board and dashboard patterns; dashboard charts (ECharts, D23) load only when first shown and each comes with a table of its numbers.
```

## 9. Regression risk

- **`resource.ts`:** additions only; R1 and R2 cover the existing members.
- **`FormSheet.initial`:** optional; the gallery form examples pass none (same baselines).
- **`Button` secondary `aria-pressed` style:** only `aria-pressed="true"` matches. No existing screen uses the kit
  `Button` with it (floor, desk and board use their own buttons), and the gallery `Switcher` uses `primary` when
  pressed.
- **`patterns-data.ts` `resources` generalised:** same keys and path for queue and detail (same baselines; tests
  G1-G2 of slice 11).
- **New dependency:** lockfile and licence check; it is only in the gallery build today. When a production face
  first shows a chart, the service worker's precache (`globPatterns: **/*.js`) will download the chart chunk in the
  background after install. It stays out of the start-up files; whether to exclude it from the precache is decided
  with that face (ticket 46+).
- **Fast tests** gain one `vite build` (about 3-5 s).
- **StrictMode** runs `useChart`'s effect twice in development; cleanup disposes the first instance.
- **Baselines:** 8 new; the 22 existing must not change. **PR size:** above 800 lines → `size:large`.

## 10. Out of scope

- Any real settings, wizard, board or dashboard screen, or moving floor, desk or board onto these patterns (15+).
- Sign-in as a `WizardPage` (21; `Login.tsx` stays a fetch-guard exception).
- D5's `schema`, `columns`, `permission`, search, sorting, audit line and route collection from
  `faces/settings/resources/` (with the first real settings screen).
- Paging in `CrudPage` and `BoardPage` (first page only); optimistic updates; offline writes from `CrudPage`.
- Chart kinds beyond bar and line; a third series; tooltips; legends; chart drill-down by tapping a bar.
- Real Gujarati (24); a dark theme.
- Any server, database, migration or contract change; `docs/spec/parity.yaml` (the `no-parity` label applies).

## 11. Questions

**For the orchestrator (technical rulings to record):**

1. **D5 deviation.** Your ruling (plain `<table>`, `FormSheet`, no TanStack Table, no react-hook-form) departs from
   accepted D5, which names both and rejects the plain table. The harness sends an architecture change back
   through the maker-checker. I have planned it as a dated deferral, recorded in D23 with a one-line pointer in
   D05. Please confirm that the architecture-reviewer's PASS on D23 is enough, or route it.
2. **Dependency outside a Platform PR.** ARCHITECTURE §8 puts `pnpm-lock.yaml` and `THIRD_PARTY.md` changes in a
   Platform PR. The ticket itself asks for ECharts under an ADR, so I have planned it in this PR (as D20 did for the
   kit in ticket 10). Please confirm.
3. **Shared catalogue.** 18 `kit.*` keys go into `common.en.ts`, plus the matching append to `en-before-05.json`,
   exactly as ruled for ticket 11.
4. **Deviations marked D:**
   - `CrudSpec extends ResourceSpec`, not a second `ResourceSpec` (decision 1);
   - no `schema`, `columns` or `permission` yet (decision 1);
   - no `useDisable` (decision 3);
   - `optimizeDeps.include` (decision 10).

**For Nimish (plain English, not blocking):**

1. The new words are "Add", "Edit", "Save", "On", "Off", "Switch off", "Switch on", "Could not save. Check the
   details and try again.", "Step 1 of 3", "Could not send. Try again." and "Show the numbers". Are these the words
   you want?
2. In charts, the main line is in the accent colour and a comparison line is grey and dashed, with the names written
   at the end of each line instead of a legend. Does that read well on your phone when you open the gallery?
3. A switched-off entry stays in the list marked "Off", with a "Switch on" button. Later, with long lists, would you
   rather hide switched-off entries behind a "Show switched off" option?
