# Atlas proof of concept — Cosmos data in a forked Atlas (28 Oct 2026)

## What was done
1. Cloned Atlas CMMS (github.com/Grashjs/cmms) at commit `588c1e2` (27 Oct 2026). The full source is public under AGPLv3 — no reverse engineering was needed.
2. Forked it on branch `maintenance-os` with three commits (patches in this folder):
   - `0001` — `ALL_FEATURES_ENABLED` flag (default true): every licence entitlement granted without a key; `NOTICE-FORK.md` records the modification as AGPL s.5(a) requires.
   - `0002` — work-order import keeps the historical completion date (upstream stamps "now").
   - `0003` — local build files: `api/Dockerfile.local` (pre-built jar), `frontend/Dockerfile.local` (static build), `docker-compose.override.yml`.
3. Built backend (Maven, host) and frontend (CRA, host), ran Postgres + MinIO + API + frontend + nginx with docker compose.
4. Loaded Cosmos's prototype seed: 1 company, 26 locations (plant → area → cell), 191 assets, 1,158 breakdowns as completed work orders (29 categories = Cosmos codes), 987 downtime events.

## Results
| Check | Result |
|---|---|
| Licence state with no key | valid, plan "Maintenance OS", 34 entitlements |
| Asset hierarchy (previously gated) | works (TC-23 under TC-10, then reverted) |
| Tenant isolation | second company sees 0 of Cosmos's 191 assets and 0 work orders; direct read of a Cosmos asset ID → 403 |
| Reliability dashboard | real downtime: 90.6 h, 69 events in the last 30 days |
| Per-machine statistics | MTBF/MTTR/uptime shown, but on Atlas's own definitions (see gaps) |

## Reproduce
```bash
git clone https://github.com/Grashjs/cmms.git && cd cmms && git checkout 588c1e2 && git checkout -b maintenance-os
git am /path/to/atlas-poc/000*.patch
cp .env.example .env   # set JWT_SECRET_KEY, POSTGRES_PWD, MINIO_PASSWORD; add ALL_FEATURES_ENABLED=true, RATE_LIMIT_ENABLED=false (local loads only)
(cd api && mvn -B clean package -DskipTests && mkdir -p dist && cp target/app.jar dist/)
(cd frontend && npm ci --legacy-peer-deps && NODE_OPTIONS=--max_old_space_size=4096 npm run build)
# write frontend/build/runtime-env.js with window.__RUNTIME_CONFIG__ = {"API_URL":"/api", ...}
docker compose up -d --build
python3 load_cosmos.py cosmos.json http://localhost:8080 && python3 downtimes.py cosmos.json && python3 checks.py
```
`cosmos.json` is extracted from lines 533-540 of `source/cosmos_platform.html` (INIT_* arrays).

## Fit-gap: what Atlas gives us vs what the scope needs
**Covered by Atlas today (verified in code, most exercised in the PoC):**
multi-company tenancy with isolation; location tree; asset register (categories, specs, parent/child, QR/NFC, files, meters, in-service date, status up/down); work orders (open / in progress / on hold / complete, assignment, teams, priority, categories, labour time, parts, costs, signature, linking, history); requests and a no-login request portal with voice-note upload; PM schedules (time and meter based), PM calendar, checklists; parts inventory, purchase orders, vendors; roles incl. custom roles; workflow automation; webhooks and API keys; CSV/Excel import for assets, locations, work orders, parts, meters, PMs; downtime tracking; basic analytics (work-order status/analysis/aging/time-cost, reliability downtime/availability, asset MTBF/MTTR/uptime/cost/useful life, parts consumption, requests); shift configuration; React Native mobile app; 16 UI languages.

**Gaps found (build these on top):**
1. Import drops history: completion date (fixed in 0002), creation date and downtime are not created from imports → extend the importer (we patched data by SQL in the PoC).
2. Cells are a second dimension: Cosmos cell 3 spans areas 434 and 445; Atlas has one location tree → add a cell/production-line tag or a second hierarchy.
3. No effective-dated location history (cell moves) → new table + analytics attribution.
4. Analytics definitions differ: availability on a 24-hour clock (not shift calendar), MTTR only from logged labour, no NO DT concept → our analytics engine computes KPIs from downtime + shift calendar.
5. Breakdown-specific fields missing: shift, observed-by operator, E/M tag, failure mode/mechanism/cause codes, stopped vs running-degraded, Why-Why/RCA → custom fields first, then proper entities.
6. Users require email; operators are phone/WhatsApp-only → phone OTP / WhatsApp identity.
7. No WhatsApp, no speech-to-text (voice notes are stored, not transcribed), no Hindi or Gujarati.
8. None of Bhavin's advanced analytics: forecast, health score, bottleneck, Action Center, Team Focus, Fix Finder, Money Matters, trend tests → separate analytics service reading Atlas's database.
9. Data validation: 9 Cosmos breakdowns predate the machine's purchase date and were rejected — surface these in a data-health check rather than failing.
10. Ops defaults: API rate limit 100 req/min per user (raise for our integration services); "Powered by Intelloop" branding and $ currency → rebrand (keep AGPL legal notices) and INR.

## Architecture implication
The core becomes Atlas (Java 17 / Spring Boot, React, React Native, Postgres, MinIO), hosted as containers in India (AWS ap-south-1 or GCP asia-south1). Supabase/Vercel from the earlier brief no longer apply to the core. Our proprietary services (WhatsApp + Gujarati intake, analytics engine, AI onboarding, copilot) run beside it and integrate through Atlas's API, webhooks and a read-only database role.

## Open items before production
- Lawyer review: disabling the licence gate under AGPL; the separate-services boundary; trademark/branding.
- Decide public fork location (AGPL s.13 source offer).
- Email contact@atlas-cmms.com for Enterprise SaaS licence pricing as an alternative.
