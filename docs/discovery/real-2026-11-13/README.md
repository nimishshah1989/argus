# Real Cosmos data and Bhavin's source — 13 November 2026

The real-data test set. Product owner decision (13 Nov): build and test on Cosmos's real data; Cosmos permissions are in place. Reference only — never copied into product code.

| Path | What |
| --- | --- |
| `bhavin-source/` | Bhavin's source kit, 11 Nov (app 10.4, server v10): `server/worker.js` (the exact figure semantics), `phone_tool/` (live ticket screens), `tests/`. `site/`, `build/`, `docs/` named in its README were not in the kit. |
| `cosmos_platform-2026-11-11.html` | The current analytics platform (answer-key source, M4a). |
| `cosmos-export-2026-11-11.xlsx` | The platform's Excel export at the same date: machine registers, Breakdown Log (1,354 rows), PM Plan, PM Reports, AMC & Warranty, Legal Compliance, Why-Why, Settings, App Settings, Analytics 1–4. |
| `live/tickets-export.json` | Every live ticket (275, 27 Oct–13 Nov) with its 1,153 events and Bhavin's computed figures, from `GET /api/export` (read-only). |
| `live/users.json`, `live/config.json` | The 26 live logins (no password data) and the live app configuration. |
