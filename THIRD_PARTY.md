# Third-party dependencies and licences

Every dependency is listed here with its licence. CI checks the allowlist; an addition that is not permissive fails the build and needs an ADR.

**Allowed:** MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD, MPL-2.0, OFL-1.1 (fonts), CC0-1.0 / CC-BY-4.0 (data). **Not allowed:** AGPL, GPL, LGPL for linked code, SSPL, BSL, Elastic, Sustainable Use, or any source-available licence.

## Product libraries (planned; versions pinned at install)

| Dependency                                                                                      | Layer               | Licence          |
| ----------------------------------------------------------------------------------------------- | ------------------- | ---------------- |
| Fastify                                                                                         | server              | MIT              |
| @fastify/rate-limit                                                                             | rate limiting       | MIT              |
| @node-rs/argon2                                                                                 | password hashing    | MIT              |
| Zod                                                                                             | shared schemas      | MIT              |
| pg-boss 12.38.2                                                                                 | jobs                | MIT              |
| Pino                                                                                            | logging             | MIT              |
| pg (node-postgres)                                                                              | database driver     | MIT              |
| React, react-dom                                                                                | web                 | MIT              |
| Vite                                                                                            | web build           | MIT              |
| React Router                                                                                    | web routing         | MIT              |
| react-router-dom                                                                                | web routing         | MIT              |
| TanStack Query (`@tanstack/react-query`), TanStack Table                                        | web data/table      | MIT              |
| Tailwind CSS                                                                                    | web styles          | MIT              |
| i18next                                                                                         | web i18n            | MIT              |
| react-i18next                                                                                   | web i18n            | MIT              |
| shadcn/ui (copied by hand, no package)                                                          | web UI              | MIT              |
| Radix UI primitives (`radix-ui` 1.8.1)                                                          | web accessibility   | MIT              |
| Lucide (`lucide-react` 1.72.0)                                                                  | icons               | ISC              |
| Apache ECharts (`echarts` 6.1.0; brings `zrender` 6.1.0, BSD-3-Clause, and `tslib` 2.3.0, 0BSD) | charts              | Apache-2.0       |
| FullCalendar 7.1.5 (`@fullcalendar/react`) and `temporal-polyfill` 1.0.8                        | PM calendar         | MIT              |
| vis-timeline                                                                                    | resource timeline   | Apache-2.0 / MIT |
| react-grid-layout                                                                               | dashboard layout    | MIT              |
| Playwright                                                                                      | E2E and PDF         | Apache-2.0       |
| Noto Sans Gujarati / Devanagari                                                                 | PDF/UI fonts        | OFL-1.1          |
| whatsapp-api-js                                                                                 | WhatsApp adapter    | MIT              |
| fastify-raw-body                                                                                | webhook signature   | MIT              |
| SheetJS Community Edition 0.20.x                                                                | import              | Apache-2.0       |
| PapaParse                                                                                       | CSV                 | MIT              |
| Fuse.js                                                                                         | fuzzy matching      | Apache-2.0       |
| vite-plugin-pwa                                                                                 | PWA                 | MIT              |
| Workbox                                                                                         | service worker      | MIT              |
| idb                                                                                             | offline outbox      | ISC              |
| web-push                                                                                        | push                | MPL-2.0          |
| qrcode (node-qrcode)                                                                            | QR generation       | MIT              |
| zxing-wasm + barcode-detector                                                                   | QR scanning         | MIT              |
| Vitest                                                                                          | tests               | MIT              |
| Testcontainers                                                                                  | database tests      | MIT              |
| axe-core                                                                                        | accessibility tests | MPL-2.0          |
| @axe-core/playwright                                                                            | accessibility tests | MPL-2.0          |
| fast-check                                                                                      | property tests      | MIT              |
| pdf-parse                                                                                       | PDF text tests      | MIT              |

FullCalendar 7.1.5 is the `@fullcalendar/react` entry; it brings `@fullcalendar/core` 7.1.5 and
`@full-ui/headless-calendar` 7.1.5 (both MIT), and `temporal-polyfill` 1.0.8 is its MIT peer.

## Tools and infrastructure (not shipped as code)

| Tool                                                                                                                                                                                               | Use                       | Licence            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------ |
| TypeScript, ESLint, Prettier, tsx, yaml                                                                                                                                                            | build/dev                 | MIT / ISC          |
| eslint-plugin-i18next                                                                                                                                                                              | lint                      | MIT                |
| Terraform                                                                                                                                                                                          | infrastructure as code    | MPL-2.0            |
| Caddy                                                                                                                                                                                              | TLS and static files      | Apache-2.0         |
| Docker / Docker Compose                                                                                                                                                                            | packaging                 | Apache-2.0         |
| PostgreSQL                                                                                                                                                                                         | database                  | PostgreSQL License |
| LocalStack (community) or s3rver                                                                                                                                                                   | local S3                  | Apache-2.0 / MIT   |
| Ubuntu 24.04 LTS or Amazon Linux 2023                                                                                                                                                              | server OS                 | free               |
| Ponytail skills (core adapted; review and audit as published)                                                                                                                                      | coding discipline         | MIT                |
| Anthropic `claude-for-manufacturing` plugin 1.0.0 (text adapted into our prompt files and tests; not installed; each derived file names the source and says it was changed)                        | AI prompts and test rules | Apache-2.0         |
| SecLists `xato-net-10-million-passwords-1000.txt` and `Pwdb_top-1000.txt` (entries of 8+ characters, lower-cased, profanity removed, in `packages/domain/src/common-passwords.ts`; data, not code) | refusing common passwords | MIT                |

## Outside services (not code)

AWS (EC2, RDS, S3, SES, Secrets Manager, CloudWatch, Route 53), Meta WhatsApp Cloud API, Sarvam speech-to-text, browser push services, Anthropic Claude API (M6). Each is behind an adapter and has a data-protection note in ADR 0002; the note for Claude is in ADR 0007. The Claude adapter uses Node's `fetch`, so no SDK is added.

## Not used, with reason

- **better-auth** — evaluated and rejected in the M0 auth spike (schema/RLS/shared-phone mismatch; ADR 0003).
- **MinIO** — AGPL-3.0; use LocalStack (Apache-2.0) or s3rver (MIT) for local S3.
- **Atlas CMMS, Odoo, ERPNext, GLPI, Zammad, Metabase, NocoDB, ToolJet, Budibase** — AGPL/GPL; read-only references.
- **Paid BI, paid PDF, paid queue, paid auth, paid feature flags** — replaced by the open-source choices above.
- **npm `xlsx@0.18.5`** — frozen and CVE-prone; use SheetJS CE 0.20.x from cdn.sheetjs.com, pinned.

This file is checked in CI against the installed production dependencies. A version bump that changes a licence fails the build.
