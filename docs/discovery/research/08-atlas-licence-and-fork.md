# Atlas CMMS: licence facts and the fork path (checked 28 Oct 2026, repo commit 588c1e2, 27 Oct 2026)

Not legal advice. Get an Indian IP lawyer to confirm before shipping.

## Facts from the repo (github.com/Grashjs/cmms)
- One LICENSE file at the root: GNU AGPL v3. No separately licensed "enterprise" folder.
- COMMERCIAL_LICENSE.MD (Intelloop LLC, effective 8 Jan 2026) says the software is dual-licensed and you choose ONE: AGPLv3, or the paid commercial licence. Section 7.1 confirms "the source code of the Software is publicly available under the AGPLv3". Section 12.2: all commercial versions are also released under AGPLv3 at the same time.
- Feature gating is a runtime licence check (`LicenseService.hasEntitlement`, Keygen.sh key or licence file via the `LICENSE_KEY` env var). With no key, gated features are off.
- About 30 gated entitlements, including: ASSET_HIERARCHY, PM_CALENDAR, CONDITION_BASED_PM, ASSET_DOWNTIME, FILE_ATTACHMENTS, VOICE_NOTES, SIGNATURE_CAPTURE, REQUEST_PORTAL, CUSTOM_ROLES, WORKFLOW, WEBHOOK, API_ACCESS, TIME_TRACKING, COST_TRACKING, LOW_STOCK_ALERTS, FIELD_CONFIGURATION, BRANDING, SSO, MULTI_INSTANCE, and UNLIMITED_ASSETS / USERS / PM_SCHEDULES / CHECKLISTS / METERS / LOCATIONS / PARTS / ACTIVE_WORK_ORDERS.
- Size: ~773 Java files (Spring Boot API), ~470 TS/TSX files (React web), ~289 TS files (React Native/Expo mobile), Postgres, docker-compose. Multi-company tenancy built in (their cloud runs it with `CLOUD_VERSION=true`). UI in 16 languages; no Hindi or Gujarati.

## The commercial licence does not fit a competing SaaS
- 3.5 forbids using it to build a product that "competes directly with Atlas CMMS".
- 3.6 allows serving customers only if the software "is not the primary product"; broader SaaS/OEM rights need a separately negotiated "Enterprise SaaS License".
- Also: per-user limits, audit rights, Moroccan law, Casablanca arbitration, no-circumvention clause (3.4) — which binds only those who choose the commercial licence.

## The AGPL path (our working reading — lawyer to confirm)
- We may use, modify and run the full code commercially, including the gated feature code, because all of it is AGPL. AGPL forbids adding further restrictions, and the no-circumvention clause sits only in the commercial licence. So disabling the licence check in our fork appears permitted. This is NOT reverse engineering: the source is published.
- Obligations: (1) offer the complete source of our modified Atlas to every user who interacts with it over the network (AGPL s.13) — simplest is a public fork; (2) keep copyright notices and the "Appropriate Legal Notices" in the UI; (3) do not use the "Atlas CMMS" name or logo (trademark is separate from copyright).
- Keep our IP outside the AGPL program: WhatsApp + Gujarati voice intake, analytics/forecast engine, AI onboarding, copilot run as separate services talking to Atlas over its API and database events. Whether a given integration counts as "separate" is the question for the lawyer.
- Risks: Intelloop can stop publishing future versions under AGPL (past versions stay AGPL); upstream merges get harder as we diverge; relationship cost of shipping their paid features for free.

## Recommended sequence
1. Fork now at a pinned commit (public fork, our branding).
2. In parallel, email contact@atlas-cmms.com asking the price of an Enterprise SaaS / OEM licence (closed modifications, white label, competing use permitted). If it is affordable, buy it and keep the fork private.
3. Lawyer review (1-2 hours) of: disabling the licence gate under AGPL; the separate-services boundary; trademark.
4. Proof of concept in week 1: run Atlas locally, load Cosmos's machines and 1,158 breakdowns through its API, check what the data model lacks (effective-dated cell moves, downtime vs labour, NO DT, criticality, settings cascade, Gujarati UI).
