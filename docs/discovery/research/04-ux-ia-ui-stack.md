# Research: UX, information architecture and UI stack (27 Oct 2026)

## What competitors ship
- UpKeep web nav: Core (Work Orders, PM, Scheduler, Requests) · Data & Analytics (Analytics, Meters, Edge) · Resources (Assets, Locations, People & Teams, Checklists, Files, Import & Export) · Procurement (Parts, POs, Vendors). Mobile home: WOs by status/due today/priority, quick create, asset scan, notifications. https://help.onupkeep.com/en/articles/13636442-navigating-the-left-navigation-panel-in-upkeep
- Limble: location-centric nav; new mobile app bottom bar Tasks/Assets/More with Scan QR / Start WO / Submit WR; offline bookmark up to 10 tasks, no offline QR. Limble's 27 languages exclude Hindi and Gujarati. https://help.limblecmms.com/en/articles/11698403-using-the-new-limble-mobile-app · https://help.limblecmms.com/en/articles/5423202-languages-supported-by-limble
- MaintainX: user types Requester (free), Operator, Full User, Administrator; asset page tabs Insights / Details / History (Machine 360 precedent); CoPilot voice → work summary. https://help.getmaintainx.com/user-types-and-permissions
- Request portals (MaintainX, Limble, UpKeep, Fracttal) all: no login, QR per asset/location, minimal fields, status visible to requester.

## IA proposal
Three surfaces on one backend: Operator "Report" (one screen), Technician app (My Work / Scan / Machines / Me), Supervisor console (Inbox / Work Orders / PM Planner / Machines / Team / Reliability), Manager console (Overview / Reliability / Cost & Energy / Machines / Reports), Tenant Admin (Setup / Users & Roles / Codes / PM templates / Notifications / Languages / Billing). Action-first homes. Max 2 levels of disclosure (NN/g).
Collapse prototype pages into: Inbox/Action Center · Work Orders · PM Planner · Machine 360 · Reliability workspace · Cost & Energy · Team · Reports.

## Shop-floor rules
48x48dp minimum targets (bigger for gloves = judgement, test it); colour never alone (WCAG 1.4.1); ISA-101 grey-first, colour only for abnormal; store raw audio + transcript; QR prefills machine; low-literacy: single column, linear, no fly-outs (NN/g).

## Data viz rules
Every KPI vs target and history (sparkline + bullet); bars/lines/scatter over pies/gauges; operational vs analytical dashboards separated (Stephen Few; NN/g preattentive).

## Front-end stack
shadcn/ui + Tailwind (MIT) · Recharts 3 via shadcn charts (MIT) · Apache ECharts 6.1 for heatmaps/Pareto/large series (Apache-2.0) · TanStack Table v9 + Virtual (MIT) · AG Grid Community only if needed (grouping/pivot/Excel export are Enterprise) · FullCalendar Standard (MIT; drag-drop free; resource timeline by technician/machine is Premium from $480) or react-big-calendar (MIT) · next-intl (MIT) · Noto Sans Gujarati/Devanagari (OFL). Avoid Tremor npm (last publish Jan 2025 after Vercel acquisition); Nivo slow cadence.

## Notification ladder (design judgement)
In-app/push immediately → WhatsApp utility template after N minutes unacknowledged → SMS fallback (needs DLT registration in India) → email digest to managers. N configurable by criticality. Meta pricing page (fetched 27 Oct 2026): "Utility template messages sent within an open customer service window are free."
