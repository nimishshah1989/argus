# D0 preview — one clickable design direction for Nimish

## Question

Does the agreed Apple-inspired, white, icon-led direction feel clear and actionable on Floor and Desk?
Build one direction only (Nimish already chose it), with fake data and no saved actions. This is a
throwaway review route, not production UI and not the full D0.2 component library.

## Files / scope

- `apps/web/src/design-preview/DesignPreview.tsx`: route + Floor/Desk switch + visible
  “Design preview — no actions saved” banner.
- `apps/web/src/design-preview/FloorPreview.tsx`: machine → situation → problem → sent memory flow.
- `apps/web/src/design-preview/DeskPreview.tsx`: Open list → working ticket → accessible action/details.
- `apps/web/src/design-preview/components.tsx`: shared preview Button/IconLabel/StatusPair/Card/Field.
- `apps/web/src/design-preview/data.ts`: clearly synthetic people/machines/tickets only.
- `apps/web/src/design-preview/preview.css`: local white/teal/red/amber/green tokens and responsive CSS;
  do not edit production `style.css`.
- `apps/web/src/App.tsx`: add only `/design-preview` route.
- `apps/web/e2e/design-preview.spec.ts`: two behavior tests + 360/1440 evidence captures.
- `apps/web/package.json`, `pnpm-lock.yaml`, `THIRD_PARTY.md`: add `lucide-react` only.
- `docs/adr/0005-design-preview-icons.md`: why Lucide; no custom SVG/emoji/second icon kit.
- `package.json`: add `preview:design` = `pnpm --filter @uptimo/web dev --host 127.0.0.1 --port 4173`.
- `docs/design/PREVIEW-NOTES.md`: question, chosen direction and later verdict placeholder.

No production screen edits, API calls/mutations, persistence, other dependencies, Ladle/Radix/Storybook,
Noto/font package, Board/Management/Settings work, offline implementation or parity-done claim.

## Required behavior / design

- Apple clarity/deference/depth: white body/cards, restrained neutral text/borders, deep-teal actions,
  red stopped, amber support/waiting, green running/success. One primary action per view.
- Lucide outline icons with labels, 52 px targets, keyboard focus, reduced-motion support. No emoji or
  hand-authored SVG. Details/timeline/people stay available through native `<details>` or an accessible
  disclosure, not removed.
- Floor: select VC-17 from search, choose stopped/support, enter/quick-select problem, Send → fake
  BD-0150 confirmation and Report another. My complaints uses the selected fake acting person only.
- Desk: fake Open cards show condition + work (`Stopped · Not started`); open a card, Start →
  `Stopped · In progress`; More actions exposes Pause/Transfer; native disclosure reveals timeline,
  people and figures. Desktop uses list + detail at ≥1024 px, phone keeps list → detail.
- All state is in memory and every visible record is synthetic. No network request is needed by either
  flow. Route works at 360 and 1440 without horizontal overflow.

## Tests (write first)

1. Given `/design-preview`, when a user searches/selects VC-17, chooses stopped, enters a problem and
   sends, then BD-0150 and Report another appear and no API request is made. Capture `floor-360.png` and
   `floor-1440.png` under `docs/design/evidence/preview/`.
2. Given a fake open stopped ticket on Desk, when the user opens it and presses Start, then the status
   pair becomes `Stopped · In progress`; when More actions/details open, then Pause/Transfer and the
   timeline/people/figures are keyboard reachable. Capture `desk-360.png` and `desk-1440.png`.
3. Both tests assert visible focus, 52 px primary targets and no horizontal overflow at 360/1440.
   Run `pnpm exec playwright test apps/web/e2e/design-preview.spec.ts --project=chromium --retries=0`,
   then `pnpm verify` and the complete `pnpm test:e2e --retries=0`.

## Preview / close

Run `pnpm preview:design` as a managed background process and verify `http://127.0.0.1:4173/design-preview`.
Open all four screenshots with an image reader and fix material overlap/contrast/flow issues before
showing Nimish. Record approve/change/no-go in PREVIEW-NOTES; absorb approved primitives into D0.2 or
delete this route afterward. Do not merge it as production UI.
