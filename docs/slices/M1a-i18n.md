# M1a-i18n — Translation layer (M5 from the review, SPEC §7)

## Goal

There is no translation layer: every UI string is hard-coded English and there is no catalogue.
Add i18next with an `en` catalogue and a `gu` (Gujarati) placeholder catalogue, extract the
existing copy into keys, initialise the language from the tenant (`/config.language`), and turn
on a lint rule so a new hard-coded UI string fails CI. Real Gujarati translations are an external
input (SPEC 1.11) — ship the `gu` catalogue as a placeholder with an English fallback and a
"needs translation" gap list.

## Approach (verify the library's current API before wiring)

- `i18next` + `react-i18next` (MIT) — a `apps/web/src/i18n/index.ts` that initialises with the
  `en` catalogue (`fallbackLng: 'en'`) and resources for `en` + `gu`; `apps/web/src/i18n/en.ts`
  (the extracted strings) and `gu.ts` (placeholder: same keys, `TODO`/English).
- A provider in `main.tsx`; `useTranslation()` in the screens; the language comes from the
  tenant config (`getConfig().language`, default `en`) and can be switched in dev.
- Extract **every user-visible string** in `apps/web/src/**/*.tsx` (labels, buttons, headings,
  empty/error states, aria-labels, banner/draft text, share-text labels are NOT UI copy — leave
  them unless they render) into the `en` catalogue with stable dotted keys (e.g. `floor.title`).
- Lint: add a no-literal-string rule for `apps/web/src/**/*.tsx` (check `eslint-plugin-i18next`'s
  current rule name in its docs — e.g. `i18next/no-literal-string`), configured for JSX text +
  attributes, failing CI. Keep it out of `apps/server`/`packages`.

## Files and write scope (one worker — the catalogue is shared, so no two writers)

- `apps/web/src/i18n/index.ts`, `apps/web/src/i18n/en.ts`, `apps/web/src/i18n/gu.ts` (new)
- `apps/web/src/main.tsx` (provider)
- every `apps/web/src/**/*.tsx` that renders copy (extraction — a mechanical replace with `t()`)
- `apps/web/package.json` (+ `i18next`, `react-i18next`; + `eslint-plugin-i18next` dev),
  `THIRD_PARTY.md`, `eslint.config.js` (the rule), `pnpm-lock.yaml`
- `apps/web/src/i18n/i18n.test.ts` (new) — the catalogue covers the keys used and a `gu` switch
  falls back to English for untranslated keys.

## Test cases

1. Unit: `en` and `gu` have the same key set (no missing keys); a `gu` key that is `TODO` falls
   back to English (or renders the key in dev — match i18next's fallback).
2. Lint: a deliberate hard-coded JSX string in a test fixture (or the rule config verified with
   a temporary literal) fails; the real tree passes.
3. `pnpm verify` + `pnpm test:e2e` green (the extracted screens still render/serve and the e2e
   specs still find their labels — the e2e text selectors may need to read the en copy).

## Out of scope

Real Gujarati translations (external, SPEC 1.11), Hindi (M5), translating server messages/errors
(those stay server-side English for now), the document `<title>`.
