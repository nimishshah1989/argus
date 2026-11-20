# Entity links: one chip for machine, cell, person, decision (kit PR before batch 1)

Nimish, 20 Nov: every place a machine, cell, person or decision code appears is a chip. Click opens that thing's
drawer with an "Open full page" link. Drawer state is in the URL, so browser Back closes it. `ui:check` makes screens
use the chip. This is a kit change; it lands before batch 1 so the five batch-1 screens are born linked.

Data-model note (DATA-MAP): no table, no module. Detail data comes through the existing `useScreenModel` seam as a new
screen key `entity` (fixture now, API adapter later).

## Frozen interfaces

**Kit, `ui/v2/entity-chip.tsx`** (no router import; renders without a Router in tests):

```ts
export type EntityKind = 'machine' | 'cell' | 'person' | 'decision';
export type EntityRef = { kind: EntityKind; id: string };
export type EntityChipProps = EntityRef & {
  label: string;
  cat?: number; /* machine type colour 1..5 */
};
export function EntityChip(props: EntityChipProps): JSX.Element; // a <button>: icon + label; stopPropagation
export const EntityOpenContext: React.Context<(ref: EntityRef) => void>; // default: no-op
```

Look: machine = code in Geist Mono with its type colour (`data-cat`, as `.v2-code` today); cell, person, decision =
name in Inter. Each kind has its own icon in `icons.tsx` (add `cell`, `person`, `decision`; machine exists). Hover and
focus-visible states, pressed `scale(.97)`; `.v2-code` styling moves into the chip's CSS and `.v2-code` is no longer
used anywhere else. The chip is a `<button>`, so it works inside a clickable row (click does not bubble to the row).

**Text carries entities.** `Seg` gains `entity?: EntityChipProps`; `Segs` renders a chip for such a segment (a segment
has `text` or an `entity`; `text` stays the accessible label). The gallery's fixture markup writes it as
`{{machine:TC-12|TC-12}}`, `{{person:neel-s|Neel S}}` (`fixture-text.ts` `pt` parses it). The engine will send the
same segment shape.

**Kit, `ui/v2/drawer.tsx`**: `DrawerSpec` gains optional `fullPage?: { href: string; label: string }`; `Drawer`
renders it as a link "Open full page" in the drawer footer (visible without scrolling, keyboard reachable).

**Screens layer, `screens/v2/entity/`**:

- `url.ts`: `useEntityParam()` returns `{ current: EntityRef | null, open(ref), close() }`. The URL holds one param,
  `?drawer=<kind>:<id>` (id URI-encoded; other params untouched; an unknown kind or malformed value is ignored).
  Open from closed = push, with `state: { drawer: 1 }`. Open while another is open = **replace** (so one Back closes the
  drawer however many items you visited). Close (✕, Esc, same item again) = `navigate(-1)` when the open was ours
  (`state.drawer`), else replace with the param removed (a pasted link). Back / Forward follow the URL.
- `href.ts`: `entityHref(ref): string`, the one place that maps an entity to its full page. machine →
  `/analytics/machines/<id>`; decision → `/analytics/today/action-center?drawer=decision:<id>` (a decision has no page of
  its own: Action Center with it open); person → `/analytics/today?screen=team-focus&drawer=person:<id>`; cell →
  `/analytics/machines?cell=<id>` (register filtered to the cell). These targets are rebuilt as v2 in batches 1 and 2;
  the helper does not change when they are.
- `model.ts` / `fixture.ts`: `Screens.entity = { params: EntityRef; model: EntityModel }`, registered in
  `screens/v2/data.ts`. `EntityModel` is a discriminated union by `kind`; each variant carries everything printed (words
  and figures ready to print, as the Dashboard model does): machine = the existing `MachineData` + words; decision = the
  existing `DecisionData` + words; **cell** (new `ui/v2/domain/cell-detail.tsx`): name, machine count, state mix, the
  month's breakdown hours, its worst machines as chips; **person** (new `ui/v2/domain/person-detail.tsx`): name, role,
  what they are on now (decisions and machines as chips), this month's jobs and hours. Fixture: built from the
  Dashboard fixture's machines, cells and decisions plus a small invented people list (no real names); its figures
  are computed from those, and a test checks the cell's hours equal the sum of its machines.
- `EntityShell.tsx`: `<EntityShell nav title local? {...ShellProps minus drawer}>`. It wraps the kit `Shell`, provides
  `EntityOpenContext` from `useEntityParam`, loads the current entity with `useScreenModel('entity', ref)` and passes the
  drawer (label, detail content, `fullPage` from `entityHref`, `onClose`) to `Shell`. Loading shows the designed
  skeleton, error and not-found states from `screen-states.tsx` inside the drawer. `local?: (ref: EntityRef) => DrawerSpec['content'] | null`
  lets a screen supply an entity it holds live with its own actions (the Dashboard's decisions keep their Decide
  button); `null` falls through to the port.
- **The Dashboard moves onto it**: delete its `useState` drawer and `drawer.tsx` selection code; its View renders
  `<EntityShell local={...}>`. Its rows, plant-map squares and tables open through `EntityOpenContext`. Everything
  that printed a machine, cell, person or decision code now prints an `EntityChip`: decision rows and detail
  (`codes`), machine table (code and cell columns), machine detail (code, cell), the "Assigned to" person in the
  fixture text. The plant-map squares and the row click keep opening the same drawer.

## `ui:check` rule (`tools/check-ui.ts`, tested in `tools/ui.test.ts`)

1. `v2-code` appears only in `ui/v2/entity-chip.tsx` and its CSS.
2. In `screens/v2/**` and `ui/v2/domain/**` `.tsx`: no `{x.code}` / `{x.codes…}` printed as JSX text (use
   `EntityChip`).
3. In `screens/v2/**/fixture*.ts`: a quoted string that has a space in it and an entity-code word (`[A-Z]{2,5}-\d{1,4}`)
   outside `{{…}}` fails: "entity code in text; write {{machine:CODE|CODE}}". A bare `'VC-67'` is data, not prose,
   and passes. A line may carry `// ui-allow: entity-code <reason>`.
4. A `screens/v2/**/View.tsx` that imports `Shell` from `ui/v2/shell` fails: use `EntityShell`.

## Done means

- Behaviour tests (user-observable, no table names): clicking a machine chip anywhere opens that machine's drawer; the
  URL gains `?drawer=machine:<code>`; Back closes it and the page is as before; Forward reopens; Esc, ✕ and the same
  chip close it, with one history step each, never leaving a dead Back entry; a pasted `?drawer=` link opens it and ✕
  then removes the param without leaving the page; opening another chip while one is open swaps content, and one Back
  closes; "Open full page" goes where `entityHref` says; a chip in a clickable row does not also open the row's item;
  unknown kind or id shows the not-found state, not a crash.
- Rule tests: each `ui:check` rule has a failing and a passing example.
- Gallery: `/gallery?view=v2-dashboard` works unchanged to the eye apart from the chips; add one e2e smoke that clicks a
  chip, checks the URL and the drawer, presses Back and checks it closed. Screenshots (light, dark, phone) of the
  Dashboard with a machine drawer open and with a person drawer open, for the PR.
- Docs: `LANGUAGE.md` gets the recipe lines (use `EntityShell`, never `Shell`; entities in text are segments);
  `UX-RULES.md` rule 18 gets "a code is always a chip" and the Back rule; `changes/<n>-entity-links.md` fragment.
- Budgets: no new dependency; no file over 400 lines; no function over 60. `pnpm lint`, `pnpm precheck`, `pnpm ui:check`
  green before the push.

## Not in this PR

Full pages for cell and person (batch 1 and 2 screens own them); a command palette; dual-pane drawers. Open product
question for Nimish: a decision has no page of its own, so its "Open full page" goes to the Action Center with that
decision open. Is that what he wants?
