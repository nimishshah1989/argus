# Zerodown (maintenance platform) — source kit

Private source. Keep two copies (PC + external drive), ideally in a password-protected zip or encrypted drive.
Contains no secrets: the access key, database and alert keys live in Cloudflare settings, not here.

## What is where
| Folder | What |
|---|---|
| platform/cosmos_platform.html | The platform (single file people open in a browser). Contains the company data built in and, inside it, a copy of the site and server files for the "Download site folder" button. |
| (platform) | The platform file is the source of truth for the platform code. |
| phone_tool/base/index_base.html | Original breakdown report form the phone tool is built on. |
| phone_tool/parts/ui.js, ui.css | Live ticket screens (report, open, mine, live, transfer, updates, alerts). |
| site/ | Built site ready for Cloudflare: index.html, floor.html, maint.html (phone tool), live.html (TV board), guide.html, sw.js, icons, lib/. No company data: pages carry __CID__ and __API__, filled in by the platform's Download site folder. |
| server/worker.js | Cloudflare Worker (server version 10, app 10.4): sign-in (users, sessions, roles: report, maint, board, supervisor, admin; PBKDF2 passwords, 30-day sliding sessions, lockout), tickets, events, transfer, pause/resume, work requests, company settings sync, reports, push alerts, indexes, rate limits, CORS limited to ALLOWED_ORIGIN and the platform. Needs a D1 database bound as DB and the CLIENT_KEYS secret (platform only). |
| build/build_live.py | Builds site/index.html, floor.html, maint.html from phone_tool/base + parts. Paths inside point to the original workspace; adjust the paths at the top before running. |
| build/embed_site.py | Embeds site/ and server/worker.js into the platform file for its download button. |
| tests/ | Test scripts (Playwright + local wrangler). tests/stage2: run2.sh starts a local server with ALLOWED_ORIGIN, seed.py adds a test company and logins, mksite.sh serves a test copy of the site, apitest.py / e2e.py / plat_e2e.py check the server, phones, board and platform. |
| design-refs/ | Mobile native and Break UI checklists (Emil Kowalski, MIT licence). |
| docs/ | To-do and decision list; board mockup generator. |

## Build and deploy (current process)
1. Edit phone_tool/parts or site/live.html.
2. Run build/build_live.py (rebuilds the phone pages), then build/embed_site.py (puts them into the platform).
3. Open the platform, Settings > Phone tool & live board > Download site folder, upload the "site" folder to Cloudflare (new deployment).
4. Server change only: paste server/worker.js into the Worker in Cloudflare and Deploy.

## Version
Source kit of 11 Nov 2026 = update 10.4 (follow-up box on closed breakdowns; includes 10, 10.1 to 10.3). App version is APP_VER in phone_tool/parts/ui.js; the portal has no version label yet (planned). Plan and parked ideas (cell access, sortable tables, document numbers, analytics): docs/next_update_plan.md.
Tests: tests/stage2 (v10_*.py, regress.sh, runall.sh); run mksite.sh after every build, then run7.sh <test>.py.

## History
Local copies only (PC + external drive). This kit has no Git history; earlier kits are kept as dated zips.
