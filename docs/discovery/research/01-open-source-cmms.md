# Research: open-source CMMS / EAM bases (checked 27 Oct 2026)

Licence notes are a plain reading, not legal advice. GitHub API was blocked; stars/dates from repo web pages.

| Project | Licence | Closed-SaaS implication | Stack | Activity | Multi-tenant | Fit |
|---|---|---|---|---|---|---|
| Atlas CMMS (github.com/Grashjs/cmms) | AGPL-3.0 + commercial licence | Network clause: modified version served to users must offer source | Java Spring Boot, React/TS, React Native (Expo), Postgres, MinIO | ~760-830 stars; v1.8.0 31 Jul 2026; updated 13 Oct 2026 | Yes, row-per-Company (CompanyAudit) | Strongest feature fit (WO, PM time/meter, checklists, parts, asset tree, mobile) |
| openMAINT | AGPL; mobile app + portal proprietary | AGPL + closed mobile | CMDBuild (Java) | SourceForge | ? | Facilities, not machine shops |
| Odoo Maintenance (Community) | LGPL-3 | Can build closed modules on top; Enterprise proprietary | Python/Odoo, Postgres | 55.3k stars | multi-DB | Basic |
| ERPNext Asset Maintenance | GPL-3.0 | SaaS OK; on-prem install = distribution | Frappe, MariaDB | 38.6k; v16.52.1 22 Oct 2026 | Frappe sites | Thin |
| Frappe Framework | MIT | Fully permissive | Python + JS | 10.7k; v16.33.1 | DB per site | Platform, not CMMS |
| Frappe Helpdesk | AGPL-3.0 | Network clause | Frappe + Vue | 3.4k | sites | SLA, assignment; no native WhatsApp |
| CalemEAM | Custom copyleft | Avoid | ? | Community R2.1e 2016 | ? | Dead |
| Shelf.nu | AGPL-3.0; mobile app PolyForm Internal Use | AGPL | React Router, Prisma, Supabase | 3.0k | workspaces | Asset/QR only |
| Zammad | AGPLv3 | AGPL | Rails/Vue | 5.9k | ? | Helpdesk with WhatsApp via Cloud API |
| Chatwoot | MIT core; enterprise/ proprietary | Avoid enterprise dir | Rails/Vue | 37.3k | accounts | Omnichannel inbox |
| frappe_whatsapp (shridarpatil) | MIT | Permissive | Frappe | 476 stars | - | WhatsApp Cloud API for Frappe |

## Key findings
- Atlas is the only serious active open-source CMMS that fits, BUT: open-core licence gating inside repo (LicenseService + Keygen; LicenseEntitlement enum: ASSET_HIERARCHY, CONDITION_BASED_PM, API_ACCESS, BRANDING, MULTI_INSTANCE...), AGPL, and the authors sell SaaS at Free / $10 / $15 / $40 per user/month (atlas-cmms.com).
- Frappe is the best permissive platform (MIT, DB per tenant) but its maintenance logic is thin and UI is desktop-ERP style.
- Ticketing tools (Zammad, Chatwoot, Helpdesk) have no asset/PM model; a breakdown ticket is a work order on a machine.

## Recommendation
Build fresh on a mainstream stack (Postgres + RLS, Next.js, PWA, WhatsApp Cloud API). Use Atlas as a **reference spec only** (data model: Asset->Location, PM with meter triggers, Checklist, Part, Company tenancy) — do not copy code (AGPL follows copied code). Frappe is the credible alternative if ERP/GST/inventory matter early.

Sources: https://github.com/Grashjs/cmms · https://atlas-cmms.com · https://raw.githubusercontent.com/Grashjs/cmms/main/api/src/main/java/com/grash/service/LicenseService.java · https://github.com/frappe/frappe · https://docs.frappe.io/framework/user/en/basics/sites · https://docs.frappe.io/erpnext/user/asset-maintenance · https://github.com/shridarpatil/frappe_whatsapp · https://admin-docs.zammad.org/en/latest/channels/whatsapp/index.html · https://raw.githubusercontent.com/chatwoot/chatwoot/develop/LICENSE
