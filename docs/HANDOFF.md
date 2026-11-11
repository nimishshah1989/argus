# Where things stand

Under 50 lines. Read first, rewrite at session end.

## Live (merged on main)

- **M0 foundation**: schema v1 + `app_api` RLS (#5/#7/#42), auth (#9), settings/config (#11), Cosmos seed (#12), walking skeleton (#14). Terraform is authored/validated (#13/#20/#22), not applied.
- **M1a ticket core**: domain figures/permissions/state (#15–#18), tickets API (#23), floor (#26), desk (#27), lists (#29), polish (#31), E2E harness (#33).
- **M1b shipped early**: report form (#35), live board/kiosk (#36), breakdown PDF (#37), WhatsApp share + PWA (#40), four close/report offline writes + cached reads + 409 drafts (#47), web push (#48).
- **Core fixes**: request-path RLS (#42), clocks (#41), corrections (#43), idempotency binding (#44), duplicate-raise race (#38).
- **i18n (#50)**: i18next/react-i18next, English catalogue and Gujarati placeholder fallback; real Gujarati remains external.
- **M1b actions/views**: Join/Leave/Cancel (#52), acting-person needs-report (#54), per-person day PDF (#56), account + admin restore/correct (#58), Team/Mine (#62), exact cancel time (#64), exact per-person list minutes (#66); quality splits (#60).
- **Process/CI (#45+)**: E2E in CI, migration immutability and parity-update guards. The pre-D0.1 merged baseline was 211 Vitest tests and 16 regular E2E tests.

## In flight

- **D0.1 on local `design-d01`**: PRODUCT, current-truth v3/all-four-inventory map, seven role journeys, prototype decisions, usability script, authoritative visual/status specs, Q24/D19 and 80 parity rows. No PR, merge or staging deployment.
- Evidence: nine fake-data PNGs + `visualApproval: false` manifest; expected missing-manifest RED, then baseline **2/2 GREEN** without capture, regular E2E **16/16**, `pnpm verify` **211/211**, parity **80 rows**, all with no retries/skips.
- **Visual limitation:** this builder called `read_image` on every PNG, but the model lacks image input. Structural/route checks are not visual inspection; independent image-capable review and D0.1 gate-manual review remain pending. No visual approval or offline new-raise implementation is claimed.

## Next

- Finish D0.1 gate-manual and independent image review; keep it `in-progress` until then. D0.2/D0.3 are isolated artifacts only; production migration waits for Nimish's explicit D0.3 alignment.
- Implement Q24 separately in M1: queued stopped/support only, visible pending, persisted/reused client idempotency, duplicate-open resolution and needs-attention; general/other-work stays online-only.
- Preserve existing acting-person My complaints filtering; prototype/test shared-phone no-device-history and no-Desk-link presentation before marking `v3.views.07` done.
- M1b: importer/cutover, real Gujarati, team day-report variant and constrained plant-head team view, WhatsApp delivery, update banner and remaining ledger gaps.
- M2 SLA/escalation/handback, then M4 analytics. P1 harness trim needs Nimish's go-ahead; M9 plugin/key check is Nimish's action.

## Known deferrals (see slice plans)

- Past-breakdown form/overrides persistence, child tasks on close, PDF jobs/cache, `/state` extra buckets, Board cancelled-24h tile, `GET /files/{id}` streaming, Noto in the deploy image, route-scoped manifests and remaining `.ts` copy extraction.
- No Board/Management/Settings rebuild, role-shell change, real Gujarati translation, offline new-raise queue or copied discovery implementation in D0.1.

## Blocked / questions for Nimish

- Domain `uptimo.in`, AWS spend limit/apply, management-root MFA and GitHub AWS secrets; Terraform remains unapplied.
- Bhavin export/Worker, current analytics file + Excel, shifts and legacy aliases; Sarvam keys + consented Gujarati notes; legacy PDF corpus.

## Parallel rule

One orchestrator session. Children get fresh contexts and disjoint files; contract-first; never two writers on one file.
