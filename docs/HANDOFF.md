# Where things stand

Under 50 lines. Read first, rewrite at session end.

## Live (merged on main)

- **M0 foundation**: schema v1 + `app_api` RLS role (#5/#7/#42), auth (#9), settings/config (#11), Cosmos seed (#12), walking skeleton (#14). Terraform is authored and validated (#13/#20/#22) — **not applied**.
- **M1a ticket core**: domain figures/permissions/state (#15–#18), tickets API (#23), floor (#26), desk (#27), lists (#29), polish (#31), e2e harness (#33).
- **M1b shipped early**: breakdown report form (#35), live board + kiosk (#36), breakdown PDF (#37), WhatsApp share text + PWA shell (#40), **offline outbox with cached reads + 409 drafts (#47)**, **web push with the acting-person re-subscribe rule (#48)**.
- **Core-issue fixes**: C1 RLS on the request path (#42), C2/M1/M2 clocks (#41), C3/M3 corrections (#43), M4 idempotency binding (#44), duplicate-raise race (#38).
- **i18n layer (M5, #50)**: i18next + react-i18next, a 202-key `en` catalogue and a `gu` placeholder (falls back to English), every web `.tsx` string extracted, and the `i18next/no-literal-string` lint rule enforced for web `.tsx`.
- **M1b actions (#52)**: desk Join/Leave (crew-aware, the lead counts as crew) and Cancel from working; floor Cancel-own for the caller's not-started ticket; 11 action unit tests + a join→leave desk E2E step.
- **Needs-report list (#54)**: `GET /state` gains `needReport` (closed no-report, last 7 days, acting-person scoped; management sees the tenant list); the desk shows a hidden-when-empty "Needs report" segment, cleared by filing the late report.
- **Day report PDF (#56)**: `GET /reports/day.pdf?date=&personId=&shift=day|night` renders a per-person day report (clipped minutes, day total, pending-at-end), stored through the same file store; role-gated (`canDayReport`) and technicians see only their own day.
- **Account sheet + admin faces (#58)**: a header account sheet (name/title/role, acting person, sign out) and an admin panel on the ticket detail — Restore a cancelled ticket and Correct a ticket's facts, each with a reason.
- **Process/CI (#45)**: e2e runs in CI, migration immutability + parity-update guards, parity ledger backfilled (14 done / 35 in-progress / 3 external), STATUS/README/CHANGELOG/backlog/PR template refreshed.
- Verification: `pnpm verify` green (195 tests / 28 files); `pnpm test:e2e` green (16 tests on the real stack).

## In flight

- Nothing.

## Next

- M1b parity gaps: Views 1–7 completion (the desk lists beyond Open/Mine/Team).
- Account-sheet follow-up: on a shared login, show the login `username` (the person `name` is the acting person), per the reviewer.
- Day-report follow-ups: the web download button, the team variant (and constrain `plant_head` to their team then), WhatsApp delivery.
- **Split the over-budget screens**: `TicketDetail.tsx` (310), `ReportForm.tsx` (309), `Desk.tsx` (327) — pre-existing from the i18n migration.
- Domain `leave` still lacks a `canWork` guard (pre-existing, PR #23 gap).
- Needs-report scope is "closer OR active crew"; optionally also include the lead (reviewer note).
- **i18n follow-ups**: move the remaining rendered copy out of `.ts` files to keys (`components/actions.ts` action labels, `components/format.ts` units/elapsed, `screens/board/data.ts` tile statuses); then real Gujarati translations (external, SPEC 1.11).
- Wire web push to ticket events (M2 escalation) and make `sendPush` tenant-aware; iOS install guidance.
- Import/cutover: Bhavin export + Worker (external), Gujarati strings (external), runbook.
- M2 SLA/escalation, then M4 analytics (needs Bhavin's platform file + Excel export).
- **P1** (trim the process harness) needs Nimish's go-ahead; **M9** (verify/remove the Bedrock plugin, rotate the key) is Nimish's action.

## Known deferrals (see slice plans)

- Past-breakdown form/overrides (the domain records overrides; the server must persist them to the `overrides` jsonb), child tasks on close, PDF jobs, `/state` extra buckets, acknowledge/handback (M2), i18n/Gujarati, board cancelled-24h tile, `GET /files/{id}` streaming + PDF cache, Noto Sans Gujarati in the image, `ticket-pdf.test.ts` onto the shared harness, `ShareButton`/`api.ts` deep import → `@uptimo/shared` workspace dep + api type split, route-scoped web manifest, Workbox `precacheAndRoute` if desired.

## Models

- The Bedrock plugin is installed and configured; it is blocked only by the session model-selection policy (add providers in Settings → Models). The M9 key check is Nimish's.

## Blocked / questions for Nimish

- Domain: **uptimo.in** registration; raise AWS spend limit; confirm management-root MFA.
- After apply: GitHub secrets `AWS_ROLE_ARN`; bootstrap `/opt/uptimo`; rename the GitHub repo `argus → uptimo`.
- Bhavin export/Worker (M1b gate); shifts; legacy code aliases; Sarvam keys + consented Gujarati notes; legacy PDF corpus; Excel export.

## Parallel rule

One orchestrator session. Children get fresh contexts and disjoint files; contract-first; never two writers on one file.
