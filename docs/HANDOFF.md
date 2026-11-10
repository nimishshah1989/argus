# Where things stand

Under 50 lines. Read first, rewrite at session end.

## Live (merged on main)

- **M0 foundation**: schema v1 + `app_api` RLS role (#5/#7/#42), auth (#9), settings/config (#11), Cosmos seed (#12), walking skeleton (#14). Terraform is authored and validated (#13/#20/#22) — **not applied**.
- **M1a ticket core**: domain figures/permissions/state (#15–#18), tickets API (#23), floor (#26), desk (#27), lists (#29), polish (#31), e2e harness (#33).
- **M1b shipped early**: breakdown report form (#35), live board + kiosk (#36), breakdown PDF (#37), WhatsApp share text + PWA shell (#40), **offline outbox with cached reads + 409 drafts (#47)**, **web push with the acting-person re-subscribe rule (#48)**.
- **Core-issue fixes**: C1 RLS on the request path (#42), C2/M1/M2 clocks (#41), C3/M3 corrections (#43), M4 idempotency binding (#44), duplicate-raise race (#38).
- **Process/CI (#45)**: e2e runs in CI, migration immutability + parity-update guards, parity ledger backfilled (13 done / 35 in-progress / 3 external), STATUS/README/CHANGELOG/backlog/PR template refreshed.
- Verification: `pnpm verify` green (161 tests / 24 files); `pnpm test:e2e` green (12 tests on the real stack).

## In flight

- Nothing.

## Next

- **M5 (i18n)** — the big remaining review item: add an i18n layer (en + a `gu` placeholder catalogue), extract the UI strings, and turn on a no-literal-string lint rule.
- M1b parity gaps: day-report PDF, needs-report list, floor cancel-own, desk join/leave actions, account sheet, admin correct/restore faces, Views 1–7 completion.
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
