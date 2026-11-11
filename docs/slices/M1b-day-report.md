# M1b-day-report — Day report PDF (SPEC 1.6 / Reports)

## Goal

A server-rendered **day report PDF** per person (or team), by day or shift, with
**pending-at-end** — so it can be sent on WhatsApp and stored like the breakdown PDF.

## Contract

- `GET /api/v1/reports/day.pdf?date=YYYY-MM-DD&personId=<uuid|me>&shift=day|night` → `application/pdf`.
  `personId` defaults to the acting person; `shift` defaults to `day`. (A `team` variant can be a
  follow-up.)
- Windows (the real pattern is still open — NEEDS N11): day `08:00–18:30`, night `18:29–05:00`,
  next day — make them constants in one place with a comment pointing at N11, not scattered.
- The report lists every ticket the person touched in the window (from events/work segments):
  ref, machine/general, status, hands-on minutes for that person, and the day totals; then the
  **pending-at-end** list (tickets still open/working/waiting when the window closed).
- Render with the existing `renderPdf` + a new `renderDayReportHtml`; store the bytes like the
  breakdown PDF does (local file store now; S3 later — same `file-store`).
- Auth + tenant-scoped (RLS/`withTenant`); a row in another tenant is a `not_found`.

## Files and write scope

- `apps/server/src/day-report.ts` (new: window + data query + HTML input) or extend
  `apps/server/src/reports.ts`; keep each file ≤400 and functions ≤60 (split the query from the
  template if needed).
- `apps/server/src/pdf-template.ts` (a `renderDayReportHtml` — or a new `day-report-template.ts`).
- `apps/server/src/reports.ts` (register the route; reuse `renderPdf`/file store).
- `apps/server/test/day-report.test.ts` (new): the day query (a person's day across two tickets,
  per-person minutes, pending-at-end) and the PDF endpoint (200, `%PDF`, key text/via the
  browserless text extraction the breakdown test uses).

## Test cases

1. A person who works two tickets in the day window gets both, with per-ticket minutes summing to
   the day total; a ticket still open at the window end is in pending-at-end; someone else's
   work doesn't appear.
2. The PDF endpoint returns a valid PDF for the caller's own day; a foreign tenant is 404.
3. `pnpm verify` + `pnpm test:e2e` green.

## Out of scope

The web download button (follow-up slice), WhatsApp delivery, the team variant, Gujarati labels
in the PDF (the fonts are already bundled for the breakdown PDF).
