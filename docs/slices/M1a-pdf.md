# M1a-pdf — Breakdown report PDF (AC3b, SPEC 1.6)

## Goal

A server-rendered **breakdown report PDF** for a closed ticket: HTML template (ticket facts,
report fields, QR payload) → headless Chromium → PDF → stored as a `file` row → downloadable
from the ticket. Day-report PDF is a later slice.

## Approach and feasibility (validated 10 Nov 2026)

- **Chromium**: reuse the Playwright Chromium already installed for the E2E harness
  (`PLAYWRIGHT_BROWSERS_PATH=/Users/nimishshah/All AI/argus/.tools/ms-playwright`).
  `playwright-core` is not importable from the server (it is only a transitive dev dependency),
  so the browser binary is launched directly (`chromium_headless_shell` with `--print-to-pdf`;
  `CHROMIUM_PATH` / `PLAYWRIGHT_BROWSERS_PATH` override, falling back to `.tools/ms-playwright`
  next to the workspace). Verified: renders a real `%PDF-` buffer in ~0.8 s.
- **QR**: npm `qrcode` (the `node-qrcode` project, MIT — the package name is `qrcode`; the
  `node-qrcode` npm name is an unrelated 2015 package, do not use it). Payload is the platform v1
  shape (`ref.js bdQR`): ASCII-escaped JSON `{v,mid,d,sh,pr,ob,ca,db,sb,dm,mc,bc,sp,ty,tk,rs,rp}`,
  `pr`/`ca`/`sp` shrunk to a ≤650-character text, error level M then L.
- **Storage**: a small storage adapter (`put`/`get`) — local filesystem under a configured dir for
  dev/tests, with the same interface an S3 adapter will implement (no real S3/LocalStack yet).
- **Gujarati**: no Noto Sans Gujarati is installed on this machine, but the macOS system stack has
  real Gujarati-capable fonts (Kohinoor Gujarati, Gujarati Sangam MN, Gujarati MT, .SF Gujarati).
  The template uses that stack; a test export embeds the fonts and `pdftotext` extracts the
  Gujarati text correctly. **Follow-up:** install/bundle Noto Sans Gujarati (OFL-1.1) in the
  deployment image so the glyphs do not depend on the host OS.

## Files and write scope

- `apps/server/src/pdf.ts` (new) — render HTML→PDF via Chromium + QR.
- `apps/server/src/pdf-template.ts` (new) — the HTML template (facts, report, QR).
- `apps/server/src/file-store.ts` (new) — the storage adapter (local FS) + `file` row insert.
- `apps/server/src/reports.ts` (new) or `tickets.ts` — `GET /tickets/{id}/pdf` returning
  `{fileId, url}`; register in `app.ts`.
- `package.json` / dependencies — `node-qrcode` (+ `playwright-core` if needed), with a licence
  entry in `THIRD_PARTY.md`.
- `apps/server/test/ticket-pdf.test.ts` — integration test producing a PDF and asserting the
  `file` row + bytes.

## Test cases

1. `GET /tickets/{id}/pdf` on a closed-with-report ticket creates one `file` row and returns a
   readable PDF (`%PDF-` header, non-trivial size).
2. The QR payload is embedded (assert the SVG/marker is in the template output).
3. No report → 409/422; unknown ticket → 404; another tenant → 404.
4. `pnpm verify` green; the E2E stays green.

## Out of scope

Day-report PDF, signature upload, real S3/LocalStack, Gujarati font bundling if unavailable,
PDF visual diff tests.
