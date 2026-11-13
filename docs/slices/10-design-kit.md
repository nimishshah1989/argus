# 10 — One design kit

Issue: [#79](https://github.com/nimishshah1989/argus/issues/79) · Milestone M0 · Blocked by: 01 (done) · Branch
`claude/t10-design-kit`. One PR, labels `size:large` (kit + gallery + guard in one installable slice) and
`no-parity` (no v3 behaviour row changes). The PR body contains `Closes #79`.

## 1. Goal

Every future screen is built from one installed kit, and Nimish can open `/gallery` on a phone-width screen to
see every colour, component and status in English and in placeholder Gujarati, and choose between three
accent colours.

## 2. Decisions (technical; the orchestrator records them)

1. **One ADR, D19.** Two runtime packages, pinned exact in `apps/web/package.json`: `radix-ui` **1.8.1** (MIT;
   the unified Radix package, so later primitives need no new dependency) and `lucide-react` **1.72.0** (ISC).
   Every D04 icon name was checked against 1.72.0 and exists. shadcn/ui is copied by hand: no CLI, no package.
   **Rejected:** `clsx`, `tailwind-merge`, `class-variance-authority`. Kit components never accept `className`,
   so nothing needs merging, and variants are plain objects. Also rejected: `@fontsource/noto-sans-gujarati`.
   Phones ship Noto Sans Gujarati and CI installs the OS font, so the font is a name in the stack, not a
   bundled file.
2. **The kit has five components, the minimum the first rebuilt screens (tickets 11, 15, 16) need. Each is
   at most 150 lines.**
   - `Button`: primary and secondary only (DESIGN: one primary action).
   - `Input` and `Label` in one file. An input without a label fails axe.
   - `Card`: the ticket card in 15 and 16.
   - `Sheet`: Radix Dialog, for `FormSheet` in 11. Focus trap and Escape come from Radix.
   - `StatusPill`.

   **Cut** (rule of two; the ticket that first needs them adds them): Badge (StatusPill covers it), Dialog
   (Sheet is the one modal), Tabs, Select.

3. **Tokens.**
   - `ui/tokens.css` is the only file with raw values. The existing `@theme` block moves out of `style.css`
     unchanged. The old status names (`--color-stopped` and the rest) become aliases of the D04 tones with
     the same values, so existing screens look exactly as they do today.
   - The type scale uses new names (caption, footnote, body, title3, title2, title1). Redefining Tailwind's
     `text-lg` and similar classes would restyle existing screens.
   - Spacing is Tailwind's 4 px base. The D04 set 4/8/12/16/24/32/48 is enforced by the `Space` type
     (1|2|3|4|6|8|12).
   - The floor body size (D04 gives a range, 18–26) is left to ticket 15.
4. **Accent switch: `data-accent` on `<html>`.** No attribute means blue, the D04 default.
   `[data-accent='teal']` and `[data-accent='graphite']` override `--color-accent` and `--color-accent-strong`
   in `tokens.css`. Fills behind white text use `accent-strong`; focus rings and icons use `accent`.
   - **Blue:** `#0a66c2` / `#0a66c2`.
   - **Deep teal:** `#0d9488` / `#0f766e` (D04).
   - **Graphite:** `#1d1d1f` / `#1d1d1f`. It is offered because it is the only option that shares no hue with
     any status colour (blue sits next to info `#2563eb`), white text on it is about 16.9:1, and it fits the
     Apple-like restraint Nimish asked for.

   Only the gallery sets the attribute today (the `?accent=` URL parameter), and it removes it when the
   gallery unmounts. Nimish's choice later changes the default in `tokens.css`.

5. **Gujarati mode.** `?lang=gu` calls the existing `setLanguage('gu')` and sets `document.documentElement.lang
= 'gu'`, so the font stack falls back to Noto Sans Gujarati.
   - The product catalogue is still empty (N5), so status labels show their English fallback. This is
     honest, not faked.
   - The gallery's own `gallery` i18n namespace has a Gujarati bundle in which every value is
     `ક ખ ગ · <English>`: Gujarati letters, then the English. This is a script sample, not a translation.
   - A banner reads "Gujarati placeholder: sample letters only, not translations. Real Gujarati arrives with
     ticket 24."
   - A specimen line shows Gujarati vowels, consonants and the digits ૦–૯.
   - Nothing is machine-translated.
6. **"Production answers 404 on `/gallery`".** Production is Caddy `try_files {path} /index.html`, and the
   service worker also falls back to `index.html`. Staging and production share that Caddyfile, and
   `infra/` is out of scope, so an HTTP 404 status from the server is not possible and would also hide
   staging's gallery. The 404 is decided at build time instead:
   - `App.tsx` lazy-loads the gallery only when `import.meta.env.DEV || import.meta.env.VITE_GALLERY ===
'on'`. In a production build that condition is the constant `false`, so the bundler drops the import
     and no gallery code ships.
   - Otherwise `/gallery` renders `<Page title={t('kit.notFound')} />` ("Page not found"). The existing `*`
     redirect to `/floor` is untouched.
   - Ticket 13 sets `VITE_GALLERY=on` for the staging web build.
7. **Gallery tests run in their own Playwright config and CI job; the database stack is not needed.**
   - `playwright.gallery.config.ts` has two `webServer`s: Vite dev on `127.0.0.1:3100`, and
     `pnpm build:web && vite preview` on `127.0.0.1:3101`.
   - The default `playwright.config.ts` ignores `**/gallery/**`.
   - The gallery specs import `test` from `@playwright/test`, not `e2e/test.ts`: there is no tenant to seed.
8. **Making screenshots repeatable.**
   - Pinned environment: runner `ubuntu-24.04` (not `-latest`). Chromium is pinned by the lockfile's
     `@playwright/test`. `fonts-noto-core` is installed with apt (it provides Noto Sans Gujarati).
   - Fixed page conditions: viewport 360×800 at `deviceScaleFactor: 1`, `reducedMotion: 'reduce'`, `locale:
'en-US'`, `timezoneId: 'Asia/Kolkata'`.
   - Capture settings: `toHaveScreenshot` uses `animations: 'disabled'`, `caret: 'hide'`, `scale: 'css'`, and
     waits for `document.fonts.ready` first. `retries: 0`.
   - Content: the gallery data is fixed (no dates, no randomness).
   - Snapshot path: `{testDir}/__screenshots__/{arg}{ext}`, with no platform suffix, so CI Linux is the only
     source of truth.
   - Under `CI`, `updateSnapshots: 'none'`, so a missing baseline fails.
9. **How baselines are made.** Only in CI, never on a laptop.
   - Add the PR label `gallery:update`. The `gallery` job then runs `pnpm gallery:update`, uploads
     `apps/web/e2e/gallery/__screenshots__` as artifact `gallery-baselines`, and fails on purpose.
   - The coder runs `gh run download <run> -n gallery-baselines -D apps/web/e2e/gallery/__screenshots__`,
     looks at the images, commits them and removes the label.
   - The update run excludes `@planted` (T12), so the deliberately changed screenshot is never saved as a
     baseline.
10. **The UI check takes the web source root**: `tsx tools/check-ui.ts [webSrc]`, default `apps/web/src`.
    - Faces rules apply to `<webSrc>/faces/**/*.{ts,tsx}`: no `className=` or `style=`; no raw colour (`#hex`
      with 3–8 digits, or `rgb(`, `rgba(`, `hsl(`, `hsla(`, `oklch(`); a `.tsx` file at most 120 lines.
    - The icon rule applies to `<webSrc>/**`: `lucide-react` may be imported only in `ui/icon.ts`.
    - An absent `faces/` folder is 0 files and passes.
    - There are no existing violators (`faces/` does not exist and Lucide is new), so no exception list is
      built (LEAN; add one dated entry only if a violator ever appears).
    - Tests plant violations in a `mkdtemp` folder.

## 3. Files

| File                                                                                  | Change                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/decisions/D19-design-kit-install.md` (new)                                      | Decisions 1–2 and 4: packages and versions with licences, the five components and the cuts, the accent switch, what was rejected and why.                                                                                                                                                                                                                                       |
| `THIRD_PARTY.md`                                                                      | Row `Radix UI primitives` becomes ``Radix UI primitives (`radix-ui` 1.8.1)``. Row `Lucide` becomes ``Lucide (`lucide-react` 1.72.0)``. Row `shadcn/ui (copied components)` becomes `shadcn/ui (copied by hand, no package)`. `check-deps` splits the first cell on the backticks, so `radix-ui` and `lucide-react` match.                                                       |
| `apps/web/package.json`                                                               | `dependencies`: `"radix-ui": "1.8.1"`, `"lucide-react": "1.72.0"`. Then run `pnpm install` (lockfile).                                                                                                                                                                                                                                                                          |
| `apps/web/src/ui/tokens.css` (new)                                                    | `@theme`: font stack plus `'Noto Sans Gujarati'` before `sans-serif`; `--color-accent`, `--color-accent-strong`, `--color-surface #ffffff`, the 10 neutrals (`--color-neutral-50…900`, same values as today), the 7 tones (`--color-danger                                                                                                                                      | info | warning | hold | moved | ok  | muted`, D04 values), the legacy aliases (`--color-stopped: var(--color-danger)`, `in-progress→info`, `support→warning`, `waiting→hold`, `running→muted`, `transferred→moved`), `--text-caption 12px`, `--text-footnote 14px`, `--text-body 16px`, `--text-title3 20px`, `--text-title2 24px`, `--text-title1 32px`, `--radius-lg 8px`, `--radius-xl 12px`, `--radius-2xl 16px`, `--shadow-card`, `--shadow-sheet`, `--spacing-target 52px`. Outside `@theme`: `:root { --motion-fast: 150ms; --motion-slow: 250ms }`, which become `0ms`under`prefers-reduced-motion: reduce`; the two `:root[data-accent=…]` blocks. |
| `apps/web/src/style.css`                                                              | Delete the `@theme` block. Add `@import './ui/tokens.css';` after `@import 'tailwindcss';`. The `@layer base` stays.                                                                                                                                                                                                                                                            |
| `apps/web/src/ui/icon.ts` (new)                                                       | The only `lucide-react` import. Re-exports the 31 D04 status icons and `X` by their Lucide names, plus `export type IconComponent = LucideIcon`.                                                                                                                                                                                                                                |
| `apps/web/src/ui/layout.tsx` (new)                                                    | `Page`, `Stack`, `Inline`, `Grid` (§4). Gap classes come from a static map `{1:'gap-1',…,12:'gap-12'}`.                                                                                                                                                                                                                                                                         |
| `apps/web/src/ui/button.tsx` (new)                                                    | `Button`. Primary: `bg-accent-strong text-white`. Secondary: `bg-surface border border-neutral-300 text-neutral-900`. Both `min-h-target rounded-xl px-4 text-body font-semibold`, with focus via the base `:focus-visible`.                                                                                                                                                    |
| `apps/web/src/ui/input.tsx` (new)                                                     | `Input` (`min-h-target`, neutral-300 border, `rounded-lg`) and `Label` (native `<label>`, `text-footnote font-medium`).                                                                                                                                                                                                                                                         |
| `apps/web/src/ui/card.tsx` (new)                                                      | `Card`: `<section>` with `bg-surface rounded-2xl shadow-card p-4`, and an optional `<h3>` title.                                                                                                                                                                                                                                                                                |
| `apps/web/src/ui/sheet.tsx` (new)                                                     | `Sheet` on the `radix-ui` `Dialog`: overlay, bottom-anchored content (`max-h-[85dvh]`), `Dialog.Title`, a close button with the `X` icon and `aria-label={t('kit.sheet.close')}`, `aria-describedby={undefined}`, transition `duration-(--motion-slow)`.                                                                                                                        |
| `apps/web/src/ui/status/{ticket,severity,clock,handback,pm,forecast,sync}.ts` (7 new) | One object per group, the exact D04 rows: `id → { tone, icon, label }`, typed with `satisfies Record<string, StatusDef>`.                                                                                                                                                                                                                                                       |
| `apps/web/src/ui/status/index.ts` (new)                                               | `Tone`, `StatusDef`, `STATUS`, `StatusGroup`, `StatusId` (§4).                                                                                                                                                                                                                                                                                                                  |
| `apps/web/src/ui/status/status-pill.tsx` (new)                                        | `StatusPill`: `inline-flex items-center gap-1 rounded-lg border bg-surface px-2 py-1 text-footnote font-medium`, with tone text and border colour, `data-status="<group>.<id>"`, the icon (`aria-hidden`, 16 px) and `t(label)`. White background, so every tone keeps its about 4.8–5.7:1 contrast.                                                                                                          |
| `apps/web/src/i18n/kit.en.ts` (new)                                                   | `export const kitEn`: the 31 `status.<group>.<id>` labels (English as D04 names them, e.g. `status.ticket.inProgress: 'In progress'`, `status.severity.s1: 'S1'`, `status.handback.timedOut: 'Timed out'`), `kit.sheet.close: 'Close'`, `kit.notFound: 'Page not found'`. A separate file keeps `en.ts` (375 lines) under the 400-line limit.                                   |
| `apps/web/src/i18n/en.ts`                                                             | Add `import { kitEn } from './kit.en.js';` and `...kitEn,` as the last entry. `gu.ts` derives its keys from `en`, so it is unchanged.                                                                                                                                                                                                                                           |
| `apps/web/src/vite-env.d.ts`                                                          | Add `interface ImportMetaEnv { readonly VITE_GALLERY?: 'on' }`.                                                                                                                                                                                                                                                                                                                 |
| `apps/web/src/App.tsx`                                                                | Add the `Gallery` lazy constant and the `/gallery` route (decision 6), `Suspense` with `fallback={null}`, and `useTranslation()` for `kit.notFound`. No other route changes.                                                                                                                                                                                                    |
| `apps/web/src/gallery/strings.ts` (new)                                               | `galleryEn` (≈25 keys: title, language and accent switcher labels, four section headings, sample texts, `guBanner`, `guSpecimen`); `galleryGu` (decision 5); `registerGalleryStrings()` calls `i18n.addResourceBundle(lang, 'gallery', …)` for `en` and `gu`.                                                                                                                   |
| `apps/web/src/gallery/Gallery.tsx` (new, default export)                              | Reads `lang` and `accent` from `useSearchParams`, applies them in an effect, and cleans up on unmount (`lang='en'`, removes `data-accent`, `setLanguage('en')`). Renders `<div data-testid="gallery-root">` → `Page` → the switchers (buttons with `aria-pressed` that update the search params), the Gujarati banner and specimen when `lang=gu`, and the four sections.       |
| `apps/web/src/gallery/tokens-section.tsx` (new)                                       | `data-testid="gallery-tokens"`. Colour swatches by token name (a `style={{ background: 'var(--…)' }}` swatch is allowed here: the gallery is not `faces/`), the type scale, the 7 spaces, 3 radii, 2 shadows, 2 motion values and the target size.                                                                                                                              |
| `apps/web/src/gallery/kit-section.tsx` (new)                                          | `data-testid="gallery-components"`: Button ×2, Label + Input, Card, and a Sheet trigger with `data-testid="gallery-sheet-open"`. `data-testid="gallery-layout"`: Page, Stack, Inline and Grid with sample boxes.                                                                                                                                                                |
| `apps/web/src/gallery/status-section.tsx` (new)                                       | `data-testid="gallery-status"`: for each group in `STATUS`, an `h3` with the group id and every pill.                                                                                                                                                                                                                                                                           |
| `tools/check-ui.ts` (new)                                                             | Decision 10. Exports `uiErrors`, `readWebSrc`. `main` prints `ui: <n> files, <m> problem(s)` and sets exit code 1 on any problem. Runs only when executed directly (same guard as `check-changelog.ts`).                                                                                                                                                                        |
| `tools/ui.test.ts` (new)                                                              | T1–T6.                                                                                                                                                                                                                                                                                                                                                                          |
| `package.json`                                                                        | Scripts `"ui:check": "tsx tools/check-ui.ts"`, `"gallery:test": "playwright test -c playwright.gallery.config.ts"`, `"gallery:update": "playwright test -c playwright.gallery.config.ts --update-snapshots=all --grep-invert @planted"`. In `verify`, add `&& pnpm ui:check` after `pnpm migrations:check`.                                                                     |
| `playwright.gallery.config.ts` (new)                                                  | Decisions 7–8. `testDir: './apps/web/e2e/gallery'`, `fullyParallel: true`, `retries: 0`, `reporter: 'list'`, `timeout: 60_000`, `outputDir: 'test-results/gallery'`. One project, `chromium` (`devices['Desktop Chrome']` with the decision 8 overrides), `baseURL: 'http://127.0.0.1:3100'`. Each webServer has `reuseExistingServer: !process.env.CI` and `timeout: 120_000`. |
| `playwright.config.ts`                                                                | Add `testIgnore: '**/gallery/**',`. Nothing else.                                                                                                                                                                                                                                                                                                                               |
| `tsconfig.json`                                                                       | Add `"playwright.gallery.config.ts"` to `include`.                                                                                                                                                                                                                                                                                                                              |
| `apps/web/e2e/gallery/gallery.spec.ts` (new)                                          | T7–T12.                                                                                                                                                                                                                                                                                                                                                                         |
| `apps/web/e2e/gallery/gallery-prod.spec.ts` (new)                                     | T13.                                                                                                                                                                                                                                                                                                                                                                            |
| `apps/web/e2e/gallery/__screenshots__/*.png` (new, from CI)                           | `{tokens,components,layout,status}-{en,gu}.png` and `sheet-open-{en,gu}.png`: 10 files.                                                                                                                                                                                                                                                                                         |
| `.github/workflows/ci.yml`                                                            | `static`: add `- run: pnpm ui:check` after `pnpm migrations:check`. New job `gallery` (§4).                                                                                                                                                                                                                                                                                     |
| `changes/79-design-kit.md` (new)                                                      | Three bullets (§7).                                                                                                                                                                                                                                                                                                                                                             |
| `docs/plan/MILESTONES.md`                                                             | Row 10 becomes `\| 10 \| One design kit \| M0 \| done \| #<PR> \|`, with the real PR number filled in once the PR is open.                                                                                                                                                                                                                                                      |

Not touched: `apps/server/**`, `infra/**`, `apps/web/src/screens/**`, `apps/web/src/components/**`,
`apps/web/index.html`, `gu.ts`, `i18n/index.ts`, and the existing e2e specs.

## 4. Interfaces

```ts
// ui/layout.tsx
export type Space = 1 | 2 | 3 | 4 | 6 | 8 | 12;
export function Page(p: { title: string; children?: ReactNode }): JSX.Element; // <main> + <h1 text-title2>
export function Stack(p: { gap?: Space; children: ReactNode }): JSX.Element; // flex-col, gap default 4
export function Inline(p: { gap?: Space; wrap?: boolean; children: ReactNode }): JSX.Element; // wrap default true
export function Grid(p: { columns: 2 | 3; gap?: Space; children: ReactNode }): JSX.Element;
// ui/button.tsx
export type ButtonProps = Omit<ComponentProps<'button'>, 'className' | 'style'> & {
  variant?: 'primary' | 'secondary';
}; // type defaults to 'button'
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
  path: string;
  text: string;
} // path relative to webSrc, '/' separators
export function readWebSrc(webSrc: string): UiFile[]; // every .ts/.tsx under webSrc, skipping node_modules
export function uiErrors(files: UiFile[]): string[]; // "<path>:<line>: <rule>"; for size: "<path>: 121 lines (faces limit 120)"
```

Rule messages (exact): `className in faces/`, `style in faces/`, `raw colour in faces/`,
`lucide-react outside ui/icon.ts`.

CI job `gallery` (in `ci.yml`): `runs-on: ubuntu-24.04`, `timeout-minutes: 8`. Steps:

1. checkout, pnpm, node 24 and `pnpm install --frozen-lockfile`, as in `browser`;
2. `sudo apt-get update && sudo apt-get install -y fonts-noto-core`;
3. `pnpm exec playwright install --with-deps chromium`;
4. `pnpm gallery:test`, with `if: ${{ !contains(github.event.pull_request.labels.*.name, 'gallery:update') }}`;
5. `pnpm gallery:update` followed by `echo "::error::baselines regenerated; download gallery-baselines and
commit them"; exit 1`, with `if:` the label is present;
6. `actions/upload-artifact@v4` with `if: always()`, `name: gallery-baselines`, path
   `apps/web/e2e/gallery/__screenshots__`;
7. a second upload with `if: failure()`, `name: gallery-diffs`, path `test-results/gallery`.

## 5. Data

No table, column, migration or API change. Browser-only state:

- `document.documentElement.lang` (`'en' | 'gu'`) and `document.documentElement.dataset.accent`
  (`'teal' | 'graphite' | undefined`): set and cleared by `Gallery`.
- URL search parameters `lang` and `accent` on `/gallery`.
- i18next resources: `translation` gains the 33 `kitEn` keys. The new `gallery` namespace is registered only
  when the gallery chunk loads.
- Build environment variable `VITE_GALLERY` (`'on'` or unset).

There is no personal data. The gallery samples are fake (`Machine`, `Search machines`).

## 6. Test cases (all fail first: nothing below exists on `main`)

`tools/ui.test.ts`, `describe('check-ui')`. Each test writes files into `mkdtempSync(join(tmpdir(), 'ui-'))`
and calls `uiErrors(readWebSrc(dir))`.

1. **`flags className in a faces file`.** Given `faces/desk/open.tsx` containing `<Stack className="p-4" />`,
   when checked, then the result is `['faces/desk/open.tsx:1: className in faces/']`.
2. **`flags a style attribute in a faces file`.** Given `faces/desk/open.tsx` containing `<Stack style={{}} />`,
   when checked, then the result contains `faces/desk/open.tsx:1: style in faces/`.
3. **`flags raw colours in faces`.** Given `faces/floor/a.ts` with `const c = '#dc2626';` on line 1 and
   `faces/floor/b.tsx` with `rgb(0, 0, 0)` on line 2, when checked, then both
   `faces/floor/a.ts:1: raw colour in faces/` and `faces/floor/b.tsx:2: raw colour in faces/` are reported.
4. **`flags a faces screen over 120 lines`.** Given `faces/desk/long.tsx` with 121 lines and
   `faces/desk/ok.tsx` with 120 lines, when checked, then the only error is
   `faces/desk/long.tsx: 121 lines (faces limit 120)`.
5. **`flags lucide-react outside ui/icon.ts`.** Given `screens/x.tsx` and `ui/icon.ts`, both with
   `import { Ban } from 'lucide-react';`, when checked, then the only error is
   `screens/x.tsx:1: lucide-react outside ui/icon.ts`.
6. **`passes a clean tree and an absent faces folder`.** Given `faces/desk/ok.tsx` using only `<Stack gap={4}>`,
   and separately a folder with no `faces/`, when each is checked, then both results are `[]`.

`apps/web/e2e/gallery/gallery.spec.ts`. Each test calls `page.goto(...)` and then waits for
`document.fonts.ready`.

7. **`gallery en: every section matches its baseline at 360 px`.**
   - Given the dev server, when `/gallery?lang=en` is open, then `html[lang=en]`.
   - `gallery-status` holds exactly 31 pills (`[data-status]`, which `StatusPill` sets to `<group>.<id>`),
     each with an `svg` and non-empty text.
   - Each of `gallery-tokens`, `gallery-components`, `gallery-layout` and `gallery-status` matches
     `<section>-en.png`.
8. **`gallery gu: placeholder Gujarati renders and matches its baseline`.**
   - Given `/gallery?lang=gu`, then `html[lang=gu]`.
   - The banner text `Gujarati placeholder` is visible.
   - The specimen contains `ક` and `૯`.
   - The primary sample button's text starts with `ક ખ ગ ·`.
   - The four sections match `<section>-gu.png`.
9. **`gallery <lang>: the open sheet matches its baseline` (en, gu).** Given the gallery, when
   `gallery-sheet-open` is clicked, then a `dialog` with the sample title is visible and focused inside, the page
   matches `sheet-open-<lang>.png`, axe finds 0 violations, and Escape closes the dialog.
10. **`gallery <lang> <accent>: axe clean` (2 languages × blue, teal, graphite).**
    - Given `/gallery?lang=<lang>&accent=<accent>`, then `html` has `data-accent` = `<accent>` (absent for
      blue).
    - The primary sample button's computed `background-color` is `rgb(10, 102, 194)`, `rgb(15, 118, 110)` or
      `rgb(29, 29, 31)` respectively.
    - `AxeBuilder.withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa'])` finds 0 violations.
11. **`accent switcher changes the accent token`.** Given `/gallery`, when the "Deep teal" switcher button is
    clicked, then it has `aria-pressed=true`, the URL contains `accent=teal` and `html[data-accent=teal]`. When
    the gallery is left (`goto('/floor')`), then `data-accent` is gone.
12. **`@planted a changed token fails the screenshot`.** Given `/gallery?lang=en`, when
    `page.addStyleTag({ content: ':root{--color-danger:#000}' })`, then
    `await expect(expect(page.getByTestId('gallery-status')).toHaveScreenshot('status-en.png')).rejects.toThrow()`.

`apps/web/e2e/gallery/gallery-prod.spec.ts`

13. **`production build answers 404 on /gallery`.** Given the production build served by `vite preview` on
    :3101, when `http://127.0.0.1:3101/gallery` is opened, then the heading `Page not found` is visible, the URL
    is still `/gallery`, and `gallery-root` has count 0. Also, no file in `apps/web/dist/assets/*.js` contains
    `gallery-root`.

The existing suites guard against regressions. `apps/web/src/i18n/i18n.test.ts` keeps `gu` and `en` keys
identical (the kit keys included), and `pnpm test:e2e` keeps every screen flow green after the tokens move.

**Commands.**

- Red first: `pnpm exec vitest run tools/ui.test.ts`, then `pnpm gallery:test`.
- Then: `pnpm install`, `pnpm ui:check`, `pnpm deps`, `pnpm licences`, `pnpm lint`, `pnpm typecheck`,
  `pnpm size`, `pnpm build`, `pnpm test`, `pnpm test:e2e`, `pnpm format:check`.
- Baselines come from CI (decision 9). Locally, `pnpm gallery:test` passes T10–T11 and T13; the screenshot
  tests need the CI images.

## 7. Changelog and records

`changes/79-design-kit.md`:

```
- One design kit: tokens, five components, Lucide icons and the status vocabulary (D19).
- `/gallery` (development and staging builds) shows the kit at phone width in English and placeholder Gujarati, with three accent options.
- CI fails on a changed gallery screenshot and on hand styling or raw colours in `faces/`.
```

At the end of the slice: MILESTONES row 10 is updated (§3), one line is appended to `wiki/log.md`, and the top
of `docs/HANDOFF.md` is rewritten (the gate: Nimish picks the accent on `/gallery` before ticket 15).

## 8. Regression risk

- **Tokens move out of `style.css`:** same values and the old names kept as aliases. Covered by `pnpm
test:e2e`, and by reading the built CSS for `--color-stopped`.
- **Font stack gains `'Noto Sans Gujarati'`:** it comes after `system-ui`, so Latin text does not change.
- **`en` gains 33 keys:** none collide with the existing `status.open|working|waiting|closed|cancelled` keys.
- **`playwright.config.ts` `testIgnore`:** the browser shards run exactly the specs they ran before.
- **PR size:** above 800 lines. Use the `size:large` label; the reason is "kit, gallery and guard must land
  together to be usable".

## 9. Out of scope

- Moving or restyling any existing screen or component. `StatusBadge` and `SeverityBadge` stay until the M1
  tickets.
- Patterns (11, 12), `displayStatus`, `MessageKey` and the per-namespace catalogues (05).
- Real Gujarati (24).
- Turning on the staging gallery (`VITE_GALLERY=on`, 13). Any `infra/` or server change.
- Extending `check-size` for the 150, 250 and 60-line budgets: the ticket that brings patterns and
  `ResourceSpec` adds them.
- The floor body type size (15).
- Chart tokens (12).
- The `theme-color` meta tag.

## 10. Questions for orchestrator

1. **Rulings to record, not product questions:**
   - Decision 6. "Answers 404" means an in-app "Page not found" with no gallery code in the production
     bundle, not an HTTP 404 status, because staging and production share one Caddyfile and `infra/` is out
     of scope.
   - Decision 9. Baselines are produced only by the label-driven CI job.
2. **For Nimish, not blocking:** does he want to give about 10 short real Gujarati phrases (for example
   "Machine stopped", "Send") for the gallery now? Long real words would show wrapping at 360 px earlier than
   ticket 24. Without them the gallery shows the marked letter samples only.
3. **For Nimish, at the gate:** blue sits close to the "in progress" blue. If he picks blue, a later ticket may
   need to tell the action colour and the status colour apart. Graphite and teal avoid this.
