# M1a-report — Breakdown report form and storage (AC3a)

## Goal

The breakdown report, first half: a technician closes a ticket **with a report** (or files a
late report on a `no_report` close), the report is validated and stored, and the ticket detail
shows it. The server-rendered PDF is AC3b (separate PR).

## Server contract (schemas in `packages/shared`)

`POST /tickets/{id}/close` gains `report?`; `POST /tickets/{id}/report` takes the same object:

```ts
breakdownReport = {
  problem?, observedBy?, correctiveAction?, doneByPersonIds?, supportedByPersonIds?,
  downtimeMin?, responseMin?, repairMin?, breakdownCategory? ('E'|'M'|'E/M'|'PM'),
  maintCode?, spareUsed?, rootCause?, handoverName?, date? (YYYY-MM-DD), shiftCode?
}
```

Server defaults when omitted: `problem` ← ticket.problem; `doneByPersonIds` ← `[leadPersonId]`;
`downtimeMin`/`responseMin`/`repairMin` ← the ticket figures; `date` ← tenant-local today;
`shiftCode` ← the current shift. Inserts one `breakdown_report` row (+ `breakdown_report_person`
for done/supported), linked to the ticket. `GET /tickets/{id}` adds `report` to its payload.

## Files and write scopes (disjoint)

- **api worker** — `packages/shared/src/ticket.ts` (report schema + `close` gains `report`),
  `apps/server/src/ticket-report.ts` (new: validate/default/insert the report + people),
  `apps/server/src/tickets.ts` (wire close/report; add `report` to the detail payload), and
  `apps/server/test/ticket-report.test.ts` (new integration test).
- **web worker** — `apps/web/src/api.ts` (close/report body types + `report` on `TicketDetail`),
  `apps/web/src/screens/TicketDetail.tsx` (show the report; a "Fill report" action for a
  `no_report` close), and `apps/web/src/components/ReportForm.tsx` (new: the form, pre-filled).

## Web behaviour

- Close → **With report** opens `ReportForm` (pre-filled: problem, downtime, response, repair,
  date, shift, done-by) with the remaining fields; submit closes with the report.
- A closed `no_report` ticket offers **Fill report** → same form → `POST /report`.
- Detail renders the stored report (fields + done/supported people) when present.

## Test cases

1. Close with a report stores one `breakdown_report` + people, and `GET /tickets/{id}` returns it.
2. Defaults applied when fields are omitted (problem, done-by, figures).
3. Late report on a `no_report` close stores the report and flips `closeKind` to `report`.
4. Validation: bad category / negative minutes / unknown person → 422.
5. Close without a report is unchanged.

## Out of scope

Server-rendered PDF, QR payload, signature upload, S3 (AC3b), the day-report sheet.
