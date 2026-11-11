# Where things stand

Under 50 lines. Read first, rewrite at session end.

## RESUME HERE (new session, on Bedrock)

**State**: `main` is clean at #67 (67 PRs merged). One branch is in flight and **fully green**:

- `m1b-import` — **M1b importer (SPEC 1.10)** `pnpm import:bhavin <file.json> --tenant <slug>` +
  `import:undo <batch>`: opens an `import_batch`, one `import_row` per ticket, zod per row,
  idempotent on `(tenant, ref)` (duplicate → skipped), machine-code alias map (MEC→M, NI/INT/FS/PP/
  UTI→MIS, ELE/HYD/ROT→inactive), persons resolved by name (unknown → pending `production`), events/
  crew/segments/breakdown_report inserts, deferred parent link, reconciliation stats, undo.
  - **Verified**: `pnpm verify` green (214 tests / 30 files, 4 migrations), `pnpm test:e2e` green
    (16), `pnpm build` green, `pnpm size` green. Uncommitted at handoff — commit + push it first.
  - **Next**: run the reviewer on it (`docs/slices/M1b-import.md`), fix anything, open a PR,
    squash-merge on green, then memory for #68.

**Switch to Bedrock**: the profile default is already `amazon-bedrock / qwen.qwen3-coder-480b-a35b-v1:0`
(`~/.dsh/profiles/desktop/cordis.patch.yml`). A **new session** starts on it and stays there; the
model chip mid-conversation works for a quick single turn but has bounced back to DeepSeek in this
session. If the Bedrock key is wrong/absent, the chip falls back — check Settings → Models and that
`AMAZON_BEDROCK_API_KEY` is set (in the sandbox it may need `danger-full-access`).

**Then** (small buildable items only): the day-report team variant (and constrain `plant_head` to
their team), WhatsApp delivery of the day report, `getShellTitles`/`.ts` copy extraction for real
Gujarati, the shared-login account-sheet E2E. Everything else needs the external inputs (NEEDS.md
N1/N11/N12/N5) or is M2–M5.

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
- **Quality-bar paydown (#60)**: `api.ts` 398→178 (+`api-types` 239), `Desk` 331→97 (+`desk/Board` 236), `TicketDetail` 312→189 (+`TicketFacts` 129), `ReportForm` 309→184 (+`ReportSections` 134); account sheet shows the login on a shared phone; domain `leave` gained its `canWork` guard; needs-report also matches the ticket lead.
- **Desk Views (#62)**: Team (Working now by person, Waiting, Not started, Cancelled 24h, Closed 30 days with monthly per-person totals) and Mine (in-progress, waiting, closed 30 days, **day-report download**); pure `views.ts` aggregation + 8 unit tests.
- **Exact cancel time (#64)**: migration 0004 `cancelled_at`; the domain sets it on cancel and clears it on restore; the desk's 24h window now uses it (fallback only for pre-migration rows); the PDF test suite now applies all migrations.
- **Exact per-person minutes (#66)**: the `/tickets` list carries `figures.perPerson` from one grouped `work_segment` query (no N+1), so the Team monthly primary/support split is exact.
- **Panel reset (#68, in flight on `m1b-import`)**: see RESUME HERE above.
- **Process/CI (#45)**: e2e runs in CI, migration immutability + parity-update guards, parity ledger backfilled (16 done / 33 in-progress / 3 external), STATUS/README/CHANGELOG/backlog/PR template refreshed.
- Verification: `pnpm verify` green (214 tests / 30 files, 4 migrations); `pnpm test:e2e` green (16 tests on the real stack).

## In flight

- Branch `m1b-import` (M1b importer) — verified, uncommitted at the DeepSeek→Bedrock handoff. Commit + push, review, merge.

## Next

- Day-report follow-ups: the team variant (and constrain `plant_head` to their team then), WhatsApp delivery.
- Shared-login e2e for the account sheet (needs the shared-login person picker in the fixture).
- **Split the over-budget screens**: done (#60) — re-check after future slices.
- Domain `leave` still lacks a `canWork` guard (pre-existing, PR #23 gap) — **done in #60**.
- Needs-report scope is "closer OR active crew"; optionally also include the lead (reviewer note) — **done in #60**.
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
