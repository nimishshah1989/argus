# 10 — One design kit

Issue: [#79](https://github.com/nimishshah1989/argus/issues/79) · Milestone M0 · Blocked by: 01 (done) · Branch
`claude/t10-design-kit`. One PR, labels `size:large` (kit + gallery + guard in one installable slice) and
`no-parity` (no v3 behaviour row changes). The PR body contains `Closes #79`.

## 1. Goal

Every future screen is built from one installed kit, and Nimish can open `/gallery` on a phone-width screen to
see every colour, component and status in English and in placeholder Gujarati, and switch between two accent
colours.

## 2. Decisions (technical; the orchestrator records them)

1. **One ADR, D20.**
   - Two runtime packages, pinned exact in `apps/web/package.json`:
     - `radix-ui` **1.8.1** (MIT). It is the unified Radix package, so later primitives need no new
       dependency.
     - `lucide-react` **1.72.0** (ISC). Every D04 icon name was checked against 1.72.0 and exists.
   - shadcn/ui is copied by hand: no CLI, no package.
   - The baseline image is `mcr.microsoft.com/playwright:v1.65.0-noble`. 1.65.0 is the installed
     `@playwright/test`, read from `node_modules` and `pnpm-lock.yaml`.
   - **Rejected:**
     - `clsx`, `tailwind-merge`, `class-variance-authority`. Kit components never accept `className`, so
       nothing needs merging, and variants are plain objects.
     - `@fontsource/noto-sans-gujarati`. Phones ship Noto Sans Gujarati, and the image gets the OS font
       `fonts-noto-core`.
2. **The kit has five components, the minimum the first rebuilt screens (tickets 11, 15, 16) need. Each is
   at most 150 lines.**
   - `Button`: primary and secondary only (DESIGN: one primary action).
   - `Input` and `Label` in one file. An input without a label fails axe.
   - `Card`: the ticket card in 15 and 16.
   - `Sheet`: Radix Dialog, for `FormSheet` in 11. Focus trap and Escape come from Radix.
   - `StatusPill`.

   **Cut** (rule of two): Badge (StatusPill covers it), Dialog (Sheet is the one modal), Tabs, Select.

3. **Tokens.**
   - `ui/tokens.css` is the only file with raw values. The existing `@theme` block moves out of `style.css`
     unchanged. The old status names become aliases of the D04 tones with the same values, so existing
     screens look exactly as they do today.
   - The type scale uses new names (caption, footnote, body, title3, title2, title1). Redefining Tailwind's
     `text-lg` and similar classes would restyle existing screens.
   - Spacing is Tailwind's 4 px base. The D04 set (4, 8, 12, 16, 24, 32, 48 px) is enforced by the `Space`
     type.
   - The floor body size is left to ticket 15.
4. **Accent switch: two options, `data-accent` on `<html>`.**
   - **Blue** is the default (no attribute): `--color-accent` and `--color-accent-strong` are both `#0a66c2`.
   - **Deep teal** is `:root[data-accent='teal']`: `#0d9488`, and `#0f766e` for accent-strong (D04).
   - Fills behind white text use `accent-strong`; focus rings and icons use `accent`.
   - Only the gallery sets the attribute (`?accent=teal`), and it removes it when the gallery unmounts.
     Nimish's choice later changes the default in `tokens.css`.
5. **Gujarati mode** (`?lang=gu`).
   - It calls the existing `setLanguage('gu')` and sets `document.documentElement.lang = 'gu'`, so the font
     stack falls back to Noto Sans Gujarati.
   - Product status labels show their English fallback, because the catalogue is empty (N5).
   - The gallery's own `gallery` i18n namespace has a Gujarati bundle (§5) with a marked script sample, not a
     translation. Nothing is machine-translated.
6. **"Production answers 404 on `/gallery`".** Production is Caddy `try_files {path} /index.html`, and the
   service worker also falls back to `index.html`. Staging and production share that Caddyfile, and `infra/`
   is out of scope, so an HTTP 404 status is not possible and would also hide staging's gallery.
   - The 404 is decided at build time. `App.tsx` lazy-loads the gallery only when `import.meta.env.DEV ||
import.meta.env.VITE_GALLERY === 'on'`. In a production build that is the constant `false`, so the
     bundler drops the import.
   - Otherwise `/gallery` renders `<Page title={t('kit.notFound')} />` ("Page not found"). The `*` redirect
     to `/floor` is untouched.
   - Ticket 13 sets `VITE_GALLERY=on` for staging.
7. **Gallery tests use their own Playwright config, with no database.**
   - `playwright.gallery.config.ts` starts two `webServer`s:
     - command `pnpm --filter @uptimo/web exec vite --host 127.0.0.1 --port 3100 --strictPort`, url
       `http://127.0.0.1:3100`;
     - command `pnpm build:web && pnpm --filter @uptimo/web exec vite preview --host 127.0.0.1 --port 3101
--strictPort`, url `http://127.0.0.1:3101`.

     Each has `reuseExistingServer: !process.env.CI` and `timeout: 120_000`.

   - The default `playwright.config.ts` ignores `**/gallery/**`.
   - The gallery specs import `test` from `@playwright/test`: there is no tenant to seed.
8. **Repeatable screenshots.**
   - One environment: the image named in decision 1, plus `fonts-noto-core`, both in CI and for local
     baselines.
   - Fixed page conditions: viewport 360×800 at `deviceScaleFactor: 1`, `reducedMotion: 'reduce'`, `locale:
'en-US'`, `timezoneId: 'Asia/Kolkata'`.
   - Capture settings: `toHaveScreenshot` uses `animations: 'disabled'`, `caret: 'hide'`, `scale: 'css'`,
     after `document.fonts.ready`. `retries: 0`.
   - Content: the gallery data is fixed (no dates, no randomness).
   - Snapshot path: `{testDir}/__screenshots__/{arg}{ext}`.
   - `updateSnapshots: 'none'` always, so a missing baseline fails everywhere. Only `gallery:update`
     overrides it, with `--update-snapshots=all`.
9. **How baselines are made.** The coder runs `pnpm gallery:update:docker` locally: the same image as CI, so
   the PNGs are byte-identical to CI's. Then the coder looks at them and commits them.
   - `--grep-invert @planted` keeps T12's deliberately changed image from ever being saved.
   - If the image's Node major version is below 24 (the repo's `engines`), the coder stops and returns the
     question.
10. **UI check scope.**
    - `tsx tools/check-ui.ts [webSrc]`, default `apps/web/src`.
    - Faces rules apply to `<webSrc>/faces/**/*.{ts,tsx}`:
      - no `className=` or `style=` (ARCHITECTURE.md:156, row :195);
      - no raw colour: `#` plus 3–8 hex digits, or `rgb(`, `rgba(`, `hsl(`, `hsla(`, `oklch(`;
      - a `.tsx` file at most 120 lines.
    - **Narrowing of :195:** raw colours are checked only in `faces/`, not "outside `ui/`", and arbitrary
      Tailwind values are not checked. This is the ticket's scope; widening it is a later ticket.
    - The Lucide rule (ARCHITECTURE.md:196) stays global: no `lucide-react` import outside `ui/icon.ts`. It is
      cheap: the same file walk and one regex.
    - An absent `faces/` passes. There are no existing violators, so no exception list is built (LEAN).

## 3. Files

Per orchestrator ruling, these wiring edits belong to this lane:

- `ci.yml`: only the new `gallery` job and a `ui:check` step in `static`;
- the root `package.json`, `playwright.config.ts`, `tsconfig.json`, `THIRD_PARTY.md`;
- `App.tsx`, `en.ts`, `vite-env.d.ts`, `style.css`.

**ADR and dependencies**

- `docs/decisions/D20-design-kit-install.md` (new): decisions 1, 2 and 4, plus the image from decision 8,
  each with what was rejected.
- `THIRD_PARTY.md`: three rows change.
  - `Radix UI primitives` → ``Radix UI primitives (`radix-ui` 1.8.1)``.
  - `Lucide` → ``Lucide (`lucide-react` 1.72.0)``.
  - `shadcn/ui (copied components)` → `shadcn/ui (copied by hand, no package)`.

  `check-deps` splits the first cell on the backticks, so both package names match.

- `apps/web/package.json`: `dependencies` gains `"radix-ui": "1.8.1"` and `"lucide-react": "1.72.0"`; then
  `pnpm install`.

**Kit (`apps/web/src/ui/`, all new)**

- `tokens.css`, `@theme` block:
  - font stack `-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, 'Noto Sans Gujarati', sans-serif`;
  - `--color-accent: #0a66c2`, `--color-accent-strong: #0a66c2`, `--color-surface: #ffffff`;
  - the 10 neutrals, unchanged;
  - the tones `--color-danger #dc2626`, `--color-info #2563eb`, `--color-warning #b45309`,
    `--color-hold #c2410c`, `--color-moved #7c3aed`, `--color-ok #15803d`, `--color-muted #6e6e73`;
  - aliases `--color-stopped: var(--color-danger)`, `--color-in-progress: var(--color-info)`,
    `--color-support: var(--color-warning)`, `--color-waiting: var(--color-hold)`,
    `--color-running: var(--color-muted)`, `--color-transferred: var(--color-moved)`;
  - type `--text-caption 12px`, `--text-footnote 14px`, `--text-body 16px`, `--text-title3 20px`,
    `--text-title2 24px`, `--text-title1 32px`;
  - radius `--radius-lg 8px`, `--radius-xl 12px`, `--radius-2xl 16px`;
  - shadows `--shadow-card: 0 1px 2px rgb(0 0 0 / 0.06), 0 1px 3px rgb(0 0 0 / 0.1)` and
    `--shadow-sheet: 0 -8px 24px rgb(0 0 0 / 0.16)`;
  - target size `--spacing-target: 52px`.

  Outside `@theme`:
  - `:root { --motion-fast: 150ms; --motion-slow: 250ms }`, both `0ms` under `prefers-reduced-motion:
reduce`;
  - `:root[data-accent='teal'] { --color-accent: #0d9488; --color-accent-strong: #0f766e }`.

- `icon.ts`: the only `lucide-react` import. Re-exports the 31 D04 icons and `X`, plus `type IconComponent =
LucideIcon`.
- `layout.tsx`: `Page`, `Stack`, `Inline`, `Grid` (§4). Gaps come from a static map (`1` → `gap-1` … `12` →
  `gap-12`).
- `button.tsx`: primary `bg-accent-strong text-white`; secondary `bg-surface border border-neutral-300
text-neutral-900`; both `min-h-target rounded-xl px-4 text-body font-semibold`.
- `input.tsx`: `Input` (`min-h-target`, `border-neutral-300`, `rounded-lg`) and `Label` (native, `text-footnote
font-medium`).
- `card.tsx`: a `<section>` with `bg-surface rounded-2xl shadow-card p-4` and an optional `<h3>` title.
- `sheet.tsx`, on the `radix-ui` `Dialog`:
  - overlay, bottom-anchored content with `max-h-[85dvh]` and `shadow-sheet`;
  - `Dialog.Title`;
  - a close button with the `X` icon and `aria-label={t('kit.sheet.close')}`;
  - `aria-describedby={undefined}`;
  - transition `duration-(--motion-slow)`.
- `status/{ticket,severity,clock,handback,pm,forecast,sync}.ts`: the exact D04 rows, `id → { tone, icon,
label }`, typed with `satisfies Record<string, StatusDef>`.
- `status/index.ts`: the §4 types and `STATUS`.
- `status/status-pill.tsx`:
  - `<span data-status="<group>.<id>">` with `inline-flex items-center gap-1 rounded-lg border bg-surface
px-2 py-1 text-footnote font-medium`;
  - tone text and border colour;
  - the icon (`aria-hidden`, size 16) and `t(label)`.

**Strings and app**

- `apps/web/src/i18n/kit.en.ts` (new): `export const kitEn` with the 31 labels (§5), `kit.sheet.close:
'Close'` and `kit.notFound: 'Page not found'`. A separate file keeps `en.ts` (375 lines) under 400.
- `apps/web/src/i18n/en.ts`: `import { kitEn } from './kit.en.js';` and `...kitEn,` as the last entry. `gu.ts`
  derives its keys from `en`, so it is unchanged.
- `apps/web/src/vite-env.d.ts`: `interface ImportMetaEnv { readonly VITE_GALLERY?: 'on' }`.
- `apps/web/src/style.css`: delete `@theme`; add `@import './ui/tokens.css';` after `@import 'tailwindcss';`.
- `apps/web/src/App.tsx`: the `Gallery` lazy constant and the `/gallery` route (decision 6), `Suspense
fallback={null}`, and `useTranslation()`.

**Gallery (`apps/web/src/gallery/`, all new)**

- `strings.ts`: `galleryEn`, `galleryGu` and `registerGalleryStrings()`, which calls `i18n.addResourceBundle`
  for `en` and `gu` under namespace `gallery`.
- `Gallery.tsx` (default export):
  - reads `lang` and `accent` from `useSearchParams` and applies them in an effect;
  - on unmount, sets `lang='en'`, deletes `data-accent` and calls `setLanguage('en')`;
  - renders `<div data-testid="gallery-root">`, then `Page`, then the language and accent switchers
    (`aria-pressed` buttons that update the search params);
  - shows the banner and specimen when `lang=gu`, then the four sections.
- `tokens-section.tsx`: `data-testid="gallery-tokens"`. Swatches by token name; a `style={{ background:
'var(--…)' }}` swatch is allowed, since this is not `faces/`. Also the type scale, 7 spaces, 3 radii,
  2 shadows, 2 motion values and the target size.
- `kit-section.tsx`:
  - `data-testid="gallery-components"`: both Buttons, Label + Input, Card, and the Sheet trigger
    `data-testid="gallery-sheet-open"`;
  - `data-testid="gallery-layout"`: Page, Stack, Inline and Grid with sample boxes.
- `status-section.tsx`: `data-testid="gallery-status"`, with one `h3` per group and every pill.

**Guard, tests, CI, records**

- `tools/check-ui.ts` (new): decision 10, exports in §4. `main` prints `ui: <n> files, <m> problem(s)` and
  exits 1 on any problem. It runs only when executed directly, like `check-changelog.ts`.
- `tools/ui.test.ts` (new): T1–T6.
- `tools/gallery-baselines.sh` (new; it runs inside the container, §4).
- Root `package.json` scripts:
  - `"ui:check": "tsx tools/check-ui.ts"`;
  - `"gallery:test": "playwright test -c playwright.gallery.config.ts"`;
  - `"gallery:update": "playwright test -c playwright.gallery.config.ts --update-snapshots=all --grep-invert
@planted"`;
  - `"gallery:update:docker"` (§4).

  `verify` gains `&& pnpm ui:check` after `pnpm migrations:check`.

- `playwright.gallery.config.ts` (new): decisions 7–8.
  - `testDir: './apps/web/e2e/gallery'`, `fullyParallel: true`, `retries: 0`, `reporter: 'list'`,
    `timeout: 60_000`.
  - `outputDir: 'test-results/gallery'`, `updateSnapshots: 'none'`.
  - One project `chromium` (`devices['Desktop Chrome']` plus the decision 8 overrides),
    `baseURL: 'http://127.0.0.1:3100'`.
- `playwright.config.ts`: add `testIgnore: '**/gallery/**',` and nothing else.
- `tsconfig.json`: add `"playwright.gallery.config.ts"` to `include`.
- `apps/web/e2e/gallery/gallery.spec.ts` (new): T7–T12.
- `apps/web/e2e/gallery/gallery-prod.spec.ts` (new): T13.
- `apps/web/e2e/gallery/__screenshots__/` (new): `{tokens,components,layout,status}-{en,gu}.png` and
  `sheet-open-{en,gu}.png`, 10 files from `gallery:update:docker`.
- `.github/workflows/ci.yml`: `static` gains `- run: pnpm ui:check` after `pnpm migrations:check`, plus the
  new `gallery` job (§4).
- `changes/79-design-kit.md` (new): §7.
- `docs/plan/MILESTONES.md`: row 10 becomes `done` with `#<PR>` filled in once the PR is open.

Not touched: `apps/server/**`, `infra/**`, `apps/web/src/screens/**`, `apps/web/src/components/**`,
`index.html`, `gu.ts`, `i18n/index.ts`, and the existing e2e specs.

## 4. Interfaces

```ts
// ui/layout.tsx
export type Space = 1 | 2 | 3 | 4 | 6 | 8 | 12;
export function Page(p: { title: string; children?: ReactNode }): JSX.Element; // <main> + <h1 text-title2>
export function Stack(p: { gap?: Space; children: ReactNode }): JSX.Element; // flex-col, gap default 4
export function Inline(p: { gap?: Space; wrap?: boolean; children: ReactNode }): JSX.Element; // wrap default true
export function Grid(p: { columns: 2 | 3; gap?: Space; children: ReactNode }): JSX.Element;
// ui/button.tsx (type defaults to 'button')
export type ButtonProps = Omit<ComponentProps<'button'>, 'className' | 'style'> & {
  variant?: 'primary' | 'secondary';
};
export function Button(p: ButtonProps): JSX.Element;
// ui/input.tsx
export function Input(p: Omit<ComponentProps<'input'>, 'className' | 'style'>): JSX.Element;
export function Label(p: Omit<ComponentProps<'label'>, 'className' | 'style'>): JSX.Element;
// ui/card.tsx
export function Card(p: { title?: string; children: ReactNode }): JSX.Element;
// ui/sheet.tsx
export function Sheet(p: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}): JSX.Element;
// ui/status/index.ts
export type Tone = 'danger' | 'info' | 'warning' | 'hold' | 'moved' | 'ok' | 'muted';
export interface StatusDef {
  tone: Tone;
  icon: IconComponent;
  label: keyof typeof kitEn;
}
export const STATUS: { ticket; severity; clock; handback; pm; forecast; sync }; // the group objects
export type StatusGroup = keyof typeof STATUS;
export type StatusId<G extends StatusGroup> = keyof (typeof STATUS)[G] & string;
// ui/status/status-pill.tsx
export function StatusPill<G extends StatusGroup>(p: { group: G; id: StatusId<G> }): JSX.Element;
// gallery/strings.ts
export const galleryEn: Record<string, string>;
export const galleryGu: Record<string, string>;
export function registerGalleryStrings(): void;
// tools/check-ui.ts
export interface UiFile {
  path: string; // relative to webSrc, '/' separators
  text: string;
}
export function readWebSrc(webSrc: string): UiFile[]; // every .ts/.tsx under webSrc, skipping node_modules
export function uiErrors(files: UiFile[]): string[]; // "<path>:<line>: <rule>" or "<path>: <n> lines (faces limit 120)"
```

The rule messages are exactly: `className in faces/`, `style in faces/`, `raw colour in faces/`,
`lucide-react outside ui/icon.ts`.

**`gallery:update:docker`** (one line in `package.json`):

```
docker run --rm --ipc=host -v "$PWD":/src:ro -v "$PWD/apps/web/e2e/gallery/__screenshots__":/out mcr.microsoft.com/playwright:v1.65.0-noble bash /src/tools/gallery-baselines.sh
```

`tools/gallery-baselines.sh` runs these steps under `set -euo pipefail`:

1. `apt-get update && apt-get install -y fonts-noto-core`;
2. `mkdir /work`;
3. `tar -C /src --exclude=node_modules --exclude=.git -cf - . | tar -C /work -xf -` (the host's
   `node_modules` is never touched);
4. `cd /work`;
5. `npm i -g pnpm@10.30.3`;
6. `pnpm install --frozen-lockfile`;
7. `pnpm gallery:update`;
8. `cp apps/web/e2e/gallery/__screenshots__/*.png /out/`.

**CI job `gallery`:** `runs-on: ubuntu-24.04`, `container: { image: mcr.microsoft.com/playwright:v1.65.0-noble,
options: --ipc=host }`, `timeout-minutes: 8`. Steps:

1. `actions/checkout@v4` with `fetch-depth: 0`, then `git config --global --add safe.directory "$GITHUB_WORKSPACE"`.
2. Step `paths` (`id: paths`):
   - on `push`, it sets `run=true`;
   - on `pull_request`, it sets `run=true` only if `git diff --name-only origin/${{ github.base_ref }}...HEAD`
     matches `^(apps/web/|playwright\.gallery\.config\.ts$|tools/check-ui\.ts$|tools/gallery-baselines\.sh$|package\.json$|pnpm-lock\.yaml$)`.

   It writes `run=…` to `$GITHUB_OUTPUT`. Every later step has `if: steps.paths.outputs.run == 'true'`.

3. `apt-get update && apt-get install -y fonts-noto-core`.
4. `npm i -g pnpm@10.30.3`, then `pnpm install --frozen-lockfile`.
5. `pnpm gallery:test`.
6. `actions/upload-artifact@v4` with `if: failure()`, `name: gallery-diffs`, path `test-results/gallery`.

## 5. Data and exact strings

No table, column, migration or API change. Browser-only state:

- `document.documentElement.lang` (`'en'` or `'gu'`) and `dataset.accent` (`'teal'` or absent): set and
  cleared by `Gallery`.
- The URL search parameters `lang` and `accent`.
- `VITE_GALLERY`: a build environment variable.
- The i18next `translation` namespace gains 33 keys. The `gallery` namespace is registered only when the
  gallery chunk loads.

There is no personal data.

**Status labels (`kitEn`, 31):**

- ticket:
  - `status.ticket.stopped` Stopped
  - `status.ticket.inProgress` In progress
  - `status.ticket.support` Support
  - `status.ticket.waiting` Waiting
  - `status.ticket.transferred` Transferred
  - `status.ticket.running` Running
  - `status.ticket.closed` Closed
  - `status.ticket.cancelled` Cancelled
- severity: `status.severity.s1` S1 · `s2` S2 · `s3` S3 · `s4` S4.
- clock:
  - `status.clock.ok` On time
  - `status.clock.dueSoon` Due soon
  - `status.clock.overdue` Overdue
  - `status.clock.paused` Paused
  - `status.clock.stopped` Stopped
- handback:
  - `status.handback.requested` Requested
  - `status.handback.confirmed` Confirmed
  - `status.handback.disputed` Disputed
  - `status.handback.timedOut` Timed out
- pm: `status.pm.due` Due · `status.pm.overdue` Overdue · `status.pm.done` Done.
- forecast: `status.forecast.hot` Hot · `status.forecast.watch` Watch · `status.forecast.normal` Normal.
- sync:
  - `status.sync.online` Online
  - `status.sync.offline` Offline
  - `status.sync.sending` Sending
  - `status.sync.draft` Draft

**`galleryEn`:**

- `title` Design gallery
- `language` Language · `language.en` English · `language.gu` Gujarati (placeholder)
- `accent` Accent · `accent.blue` Blue · `accent.teal` Deep teal
- `section.tokens` Tokens · `section.components` Components · `section.layout` Layout · `section.status` Status
- `tokens.colours` Colours · `tokens.type` Type · `tokens.typeSample` Machine stopped 08:30 · `tokens.space`
  Space · `tokens.radius` Radius · `tokens.shadow` Shadow · `tokens.motion` Motion · `tokens.target` Target size
- `sample.primary` Primary action · `sample.secondary` Secondary action
- `sample.label` Machine · `sample.placeholder` Search machines
- `sample.cardTitle` Card title · `sample.cardBody` Card content sits on a white surface.
- `sample.openSheet` Open sheet · `sample.sheetTitle` Sheet title · `sample.sheetBody` Sheet content.
- `sample.box` Box
- `guBanner` Gujarati placeholder: sample letters only, not translations. Real Gujarati arrives with ticket 24.
- `guSpecimen` is exactly:

  `અ આ ઇ ઈ ઉ ઊ એ ઐ ઓ ઔ ક ખ ગ ઘ ચ છ જ ઝ ટ ઠ ડ ઢ ણ ત થ દ ધ ન પ ફ બ ભ મ ય ર લ વ શ સ હ ૦ ૧ ૨ ૩ ૪ ૫ ૬ ૭ ૮ ૯`

**`galleryGu`:** the same keys. Every value is `` `ક ખ ગ · ${galleryEn[key]}` ``, except `guBanner` and
`guSpecimen`, which are identical to English.

## 6. Test cases (all fail first: nothing below exists on `main`)

`tools/ui.test.ts`, `describe('check-ui')`. Each test writes into `mkdtempSync(join(tmpdir(), 'ui-'))` and
calls `uiErrors(readWebSrc(dir))`.

1. **`flags className in a faces file`.** Given `faces/desk/open.tsx` containing `<Stack className="p-4" />`,
   when checked, then the result is `['faces/desk/open.tsx:1: className in faces/']`.
2. **`flags a style attribute in a faces file`** (ARCHITECTURE.md:156). Given `faces/desk/open.tsx` containing
   `<Stack style={{}} />`, when checked, then the result contains `faces/desk/open.tsx:1: style in faces/`.
3. **`flags raw colours in faces`.** Given `faces/floor/a.ts` with `const c = '#dc2626';` on line 1 and
   `faces/floor/b.tsx` with `rgb(0, 0, 0)` on line 2, when checked, then both
   `faces/floor/a.ts:1: raw colour in faces/` and `faces/floor/b.tsx:2: raw colour in faces/` are reported.
4. **`flags a faces screen over 120 lines`.** Given `faces/desk/long.tsx` with 121 lines and
   `faces/desk/ok.tsx` with 120 lines, when checked, then the only error is
   `faces/desk/long.tsx: 121 lines (faces limit 120)`.
5. **`flags lucide-react outside ui/icon.ts`** (ARCHITECTURE.md:196). Given `screens/x.tsx` and `ui/icon.ts`,
   both with `import { Ban } from 'lucide-react';`, when checked, then the only error is
   `screens/x.tsx:1: lucide-react outside ui/icon.ts`.
6. **`passes a clean tree and an absent faces folder`.** Given `faces/desk/ok.tsx` using only `<Stack gap={4}>`,
   and separately a folder with no `faces/`, when each is checked, then both results are `[]`.

`apps/web/e2e/gallery/gallery.spec.ts`. Every test opens its page and waits for `document.fonts.ready`.

7. **`gallery en: every section matches its baseline at 360 px`.**
   - Given `/gallery?lang=en`, then `html[lang=en]`.
   - `gallery-status` holds exactly 31 `[data-status]` pills, each with an `svg` and non-empty text.
   - `gallery-tokens`, `gallery-components`, `gallery-layout` and `gallery-status` each match
     `<section>-en.png`.
8. **`gallery gu: placeholder Gujarati renders and matches its baseline`.**
   - Given `/gallery?lang=gu`, then `html[lang=gu]`.
   - `Gujarati placeholder` is visible.
   - The specimen contains `ક` and `૯`.
   - The primary sample button's text starts with `ક ખ ગ ·`.
   - The four sections match `<section>-gu.png`.
9. **`gallery <lang>: the open sheet matches its baseline` (en, gu).** Given the gallery, when
   `gallery-sheet-open` is clicked, then:
   - a `dialog` with the sample title is visible, with focus inside it;
   - the page matches `sheet-open-<lang>.png`;
   - axe finds 0 violations;
   - Escape closes the dialog.
10. **`gallery <lang> <accent>: axe clean` (2 languages × blue, teal: 4 tests).** Given
    `/gallery?lang=<lang>&accent=<accent>`, then:
    - `html` has `data-accent="teal"` for teal and no `data-accent` for blue;
    - the primary sample button's computed `background-color` is `rgb(10, 102, 194)` (blue) or
      `rgb(15, 118, 110)` (teal);
    - `AxeBuilder.withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa'])` finds 0 violations.
11. **`accent switcher changes the accent token and leaving resets it`.**
    - Given `/gallery?lang=gu`, when the "Deep teal" switcher is clicked, then it has `aria-pressed=true`, the
      URL contains `accent=teal`, and `html[data-accent=teal]`.
    - When the page leaves the gallery by client-side navigation
      (`page.evaluate(() => { history.pushState({}, '', '/floor'); dispatchEvent(new PopStateEvent('popstate')); })`),
      then `gallery-root` has count 0, `html` has no `data-accent`, and `html[lang=en]`.
12. **`@planted a changed token fails the screenshot`.**
    - Given `existsSync(testInfo.snapshotPath('status-en.png'))` is `true` (asserted first) and
      `/gallery?lang=en`,
    - when `page.addStyleTag({ content: ':root{--color-danger:#000}' })`,
    - then `await expect(expect(page.getByTestId('gallery-status')).toHaveScreenshot('status-en.png')).rejects.toThrow()`.

`apps/web/e2e/gallery/gallery-prod.spec.ts`

13. **`production build answers 404 on /gallery`.** Given the production build served on :3101, when
    `http://127.0.0.1:3101/gallery` is opened, then:
    - the heading `Page not found` is visible, the path is still `/gallery`, and `gallery-root` has count 0;
    - no `apps/web/dist/assets/*.js` file contains `gallery-root`;
    - some `apps/web/dist/assets/*.css` file contains `--color-stopped` (the alias survived).

The existing suites guard against regressions. `i18n.test.ts` keeps the `gu` and `en` keys identical (the
kit keys included), and `pnpm test:e2e` keeps the screen flows green after the tokens move.

**Commands.**

- Red first: `pnpm exec vitest run tools/ui.test.ts`, then `pnpm gallery:test`.
- Then: `pnpm install`, `pnpm ui:check`, `pnpm deps`, `pnpm licences`, `pnpm lint`, `pnpm typecheck`,
  `pnpm size`, `pnpm build`, `pnpm test`, `pnpm test:e2e`, `pnpm gallery:update:docker` (commit the 10
  PNGs), `pnpm gallery:test`, `pnpm format:check`.

## 7. Changelog and records

`changes/79-design-kit.md`:

```
- One design kit: tokens, five components, Lucide icons and the status vocabulary (D20).
- `/gallery` (development and staging builds) shows the kit at phone width in English and placeholder Gujarati, with two accent options.
- CI fails on a changed gallery screenshot and on hand styling or raw colours in `faces/`.
```

At the end of the slice: MILESTONES row 10 is updated (§3), one line is appended to `wiki/log.md`, and the top
of `docs/HANDOFF.md` is rewritten (the gate: Nimish picks blue or teal on `/gallery` before ticket 15).

## 8. Regression risk

- **Tokens move out of `style.css`:** same values, and the old names are kept as aliases. Covered by T13's
  CSS check and `pnpm test:e2e`.
- **Font stack gains `'Noto Sans Gujarati'`:** it comes after `system-ui`, so Latin text does not change.
- **`en` gains 33 keys:** none collide with `status.open`, `status.working`, `status.waiting`,
  `status.closed` or `status.cancelled`.
- **`testIgnore`:** the browser shards run exactly the specs they ran before.
- **The image's apt font package could change:** if CI and the committed baselines ever differ, rerun
  `gallery:update:docker`.
- **PR size:** above 800 lines. Use the `size:large` label; the reason is "kit, gallery and guard must land
  together to be usable".

## 9. Out of scope

- Moving or restyling any existing screen or component. `StatusBadge` and `SeverityBadge` stay until M1.
- Patterns (11, 12), `displayStatus`, `MessageKey` and the per-namespace catalogues (05).
- Real Gujarati (24).
- Turning on the staging gallery (`VITE_GALLERY=on`, 13). Any `infra/` or server change.
- Raw colours outside `faces/`, arbitrary Tailwind values, and the 150, 250 and 60-line budgets in
  `check-size`: later tickets.
- The floor body size (15), chart tokens (12) and the `theme-color` meta tag.

## 10. Questions for orchestrator

1. **Rulings to record:**
   - Decision 6. "Answers 404" is an in-app "Page not found" with no gallery code in the production bundle,
     not an HTTP status.
   - Decision 10. The raw-colour rule is narrowed to `faces/` (ARCHITECTURE.md:195).
2. **For Nimish, not blocking:** does he want to give about 10 short real Gujarati phrases for the gallery
   now, so wrapping at 360 px shows before ticket 24? Without them the gallery shows the marked letter samples
   only.
