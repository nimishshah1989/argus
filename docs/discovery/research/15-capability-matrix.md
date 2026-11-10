# Capability matrix

We benchmarked 110 capabilities against seven enterprise suites and the leading mid-market and Indian products. Atlas and Bhavin's prototype between them fully cover 41, partly cover 26, and neither has 43. The plan column says when each one lands. Checked 28 October 2026 from vendor pages and documentation. A dash for a vendor means "not found in the sources checked", not proof the feature is missing.

**Legend.** Atlas and prototype columns: ✓ has it · ◐ partly · — no. Enterprise suites: IBM = IBM Maximo, SAP, HxGN = Hexagon EAM (ex-Infor), IFS (Cloud EAM and Ultimo), ORCL = Oracle Fusion Maintenance, MSFT = Microsoft Dynamics 365, AVEVA and GE = GE Vernova APM. Mid-market: MX = MaintainX, UK = UpKeep, LB = Limble, FX = Fiix, EM = eMaint, FR = Fracttal, TR = Tractian, EP = Eptura, BR = Brightly (Siemens), CO = Coast. India: KW = Keep Wisely, OX = OxMaint, CR = Cryotos, TT = TeroTAM, IM = InnoMaint. Many mid-market features sit only in top tiers ("Enterprise").

| Area | Capability | Enterprise suites | Mid-market leaders | Atlas today | Bhavin prototype | Our plan |
| --- | --- | --- | --- | --- | --- | --- |
| Assets | Asset and location hierarchy | All seven | All | ✓ | ✓ | Phase 1; add cells as a second dimension |
| Assets | Machine moves with effective dates | - | - | — | ✓ | Phase 1 |
| Assets | Spare-parts list (BOM) per machine | HxGN, MSFT, ORCL | LB, EP | ◐ | — | Phase 3 |
| Assets | Documents, manuals, photos on machines | Most | Most | ✓ | — | Phase 1 |
| Assets | Warranty and AMC tracking with alerts | HxGN, ORCL, MSFT | UK, LB, KW, IM | ◐ | — | Phase 2 |
| Assets | Warranty claims | HxGN, ORCL | - | — | — | Later |
| Assets | Meters and run-hours | All seven | Most | ✓ | — | Phase 2 |
| Assets | Criticality grade and risk matrix | IBM, SAP, HxGN, MSFT, GE | MX, FX, FR | — | ◐ | Phase 1 |
| Assets | Health score / condition assessment | IBM, SAP, HxGN, MSFT | MX, UK (sensors) | — | ✓ | Phase 3 |
| Assets | QR, barcode, NFC tags | IBM | All | ✓ | — | Phase 1 |
| Assets | Nameplate photo creates machine record | - | MX, LB, FR | — | — | Phase 2 |
| Assets | Depreciation and fixed-asset link | ORCL, MSFT | MX, UK, LB | ✓ | — | Keep |
| Assets | Floor plan, GIS or 2D layout | IBM, SAP, HxGN | LB, Accruent | ◐ | ✓ | Phase 3 live floor-plan twin |
| Assets | 3D, CAD or BIM models | SAP, HxGN, IFS, AVEVA | EP | — | — | Skip |
| Assets | Linear assets (pipelines, roads) | IBM, SAP, IFS | - | — | — | Skip |
| Work | Request portal and QR request without login | Most | All | ✓ | — | Phase 1 |
| Work | WhatsApp request intake | - | KW, CR (Enterprise); FR notify only | — | — | Phase 1 (differentiator) |
| Work | Voice to work order | IFS, ORCL | MX, UK, EM, TR, CR | ◐ | ◐ | Phase 1 in Gujarati and Hindi |
| Work | Work-order lifecycle and statuses | All seven | All | ✓ | — | Phase 1; add stages |
| Work | Severity from criticality and stopped/running | - | - | — | — | Phase 1 (differentiator) |
| Work | SLA timers and escalation matrix | IBM | MX, LB, CO (Enterprise); KW | — | — | Phase 1 |
| Work | Production handback, dispute and reopen | - | - | — | — | Phase 1 (differentiator) |
| Work | Approval workflows | IBM, SAP, HxGN, IFS | MX, LB | ◐ | — | Phase 2 |
| Work | Job plans and procedure library | All seven | All | ✓ | — | Phase 1 |
| Work | Conditional-logic procedures | - | LB | — | — | Phase 3 |
| Work | Sub-work orders and multi-machine jobs | - | MX, FX | ◐ | — | Phase 2 |
| Work | Assign, teams, claim | All seven | All | ✓ | — | Phase 1; add claim |
| Work | Skills and certifications | IBM, HxGN, IFS, MSFT | FX, KW | — | ◐ | Phase 2 |
| Work | Time and labour tracking | Most | Most | ✓ | ◐ | Phase 1 |
| Work | Comments and chat inside work orders | - | MX, LB, CO | ✓ | — | Keep |
| Work | Photos and voice notes on work orders | IBM, IFS, ORCL | Most | ✓ | — | Phase 1 |
| Work | Signature capture | HxGN, ORCL | Most | ✓ | ✓ | Keep |
| Work | Shift handover log | - | OX | — | — | Phase 2 |
| Work | Share work orders with vendors and contractors | SAP, IFS, ORCL | MX, LB, CO | ◐ | — | Phase 2 |
| Work | Root cause (Why-Why) tooling | IFS, GE | MX, FX (Enterprise) | — | ✓ | Phase 2 |
| Work | Failure codes: component, mode, cause, action | IBM, SAP, ORCL, MSFT | MX, FX (Enterprise) | ◐ | ◐ | Phase 1 |
| Work | Job-card PDF with QR | - | - | ◐ | ✓ | Phase 1 |
| Planning | Scheduling board / Gantt | IBM, SAP, MSFT | FX, LB | ◐ | — | Phase 2 |
| Planning | Optimised scheduling (solver) | IBM, SAP, IFS, MSFT | LB, UK, FX (AI) | — | — | Phase 3 |
| Planning | Capacity and workload levelling | IBM, SAP, MSFT | MX, LB (Enterprise) | ◐ | — | Phase 2 |
| Planning | Backlog and schedule-compliance KPIs | - | - | — | — | Phase 2 |
| Planning | Offline mobile with sync queue | IBM, SAP, HxGN | Most | ◐ | — | Phase 2 |
| Planning | Inspection rounds and routes | HxGN, MSFT | FX, TR | — | — | Phase 3 |
| PM and reliability | Time-based PM | All seven | All | ✓ | ◐ | Phase 1 |
| PM and reliability | Meter-based PM | Most | Most | ✓ | — | Phase 2 |
| PM and reliability | Condition-triggered work | IBM, SAP, ORCL, GE | Most | ◐ | — | Phase 3 |
| PM and reliability | PM calendar with drag and drop | - | MX, FX, LB | ✓ | ◐ | Phase 1 |
| PM and reliability | PM load spreading | - | - | — | ◐ | Phase 2 |
| PM and reliability | PM compliance and PM effectiveness | - | - | — | — | Phase 2 |
| PM and reliability | Nested PMs and maintenance plans | - | MX, FX | — | — | Phase 3 |
| PM and reliability | Operator daily checks and red tags (TPM) | - | - | ◐ | — | Phase 2 |
| PM and reliability | RCM and FMEA tooling | IBM, SAP, IFS, AVEVA, GE | - | — | — | Phase 3 (templates, not full RCM) |
| PM and reliability | Prebuilt strategy library by equipment type | IBM, AVEVA, GE | MX (templates) | — | — | Phase 2 industry packs |
| PM and reliability | Strategy pushed into PM plans automatically | IBM, SAP, GE | - | — | — | Phase 3 |
| PM and reliability | Weibull, Crow-AMSAA, trend tests | HxGN, GE | - | — | ◐ | Phase 2 to 3 |
| PM and reliability | Breakdown forecasting without sensors | IBM (Predict, needs history) | - | — | ✓ | Phase 3 (differentiator) |
| PM and reliability | Bottleneck and what-if outage | - | - | — | ✓ | Phase 3 (differentiator) |
| PM and reliability | Repeat-fault detection | - | - | — | ✓ | Phase 2 |
| PM and reliability | Calibration register | IBM, HxGN, MSFT (preview) | EM | — | — | Phase 2 |
| PM and reliability | Manual condition readings with limits | SAP | - | ✓ | — | Phase 2 |
| Inventory | Parts inventory and low-stock alerts | All seven | All | ✓ | — | Phase 2 |
| Inventory | Multi-location stock | All seven | MX, LB, EM | ◐ | — | Phase 2 |
| Inventory | Purchase orders and approvals | Most | Most | ✓ | — | Phase 3 |
| Inventory | Invoice matching | HxGN | - | — | — | Skip (ERP's job) |
| Inventory | Cycle counts | - | FX, LB, EM | — | — | Later |
| Inventory | Repairable and rotating spares | - | FX | — | — | Later |
| Inventory | Inventory optimisation (intermittent demand, criticality) | IBM, IFS | FX | — | — | Phase 3 |
| Inventory | Critical-spares list from failure history | - | - | — | ◐ | Phase 3 |
| Analytics | KPI dashboards | All seven | All | ◐ | ✓ | Phase 1 to 2 |
| Analytics | MTBF, MTTR, availability on shift calendar | MSFT | MX, LB | ◐ | ✓ | Phase 1 |
| Analytics | OEE | - | TR, KW, CR | — | — | Later (needs production data) |
| Analytics | Downtime Pareto, bad actors, heatmaps | - | - | ◐ | ✓ | Phase 2 |
| Analytics | Cost, TCO and lifecycle cost | IBM, SAP, HxGN, GE | Most | ◐ | ✓ | Phase 3 |
| Analytics | Repair-or-replace economics | HxGN, GE | - | ◐ | ◐ | Phase 3 |
| Analytics | Capital and investment planning | IBM, HxGN, IFS | - | — | — | Later |
| Analytics | Scheduled reports by email and WhatsApp | - | CR | — | ◐ | Phase 1 |
| Analytics | Ask-a-question analytics in plain language | IBM, SAP, IFS, ORCL | MX, EM, FX (add-on) | — | — | Phase 2 |
| Analytics | BI export and Power BI | - | MX, FX, EM | ◐ | ✓ | Phase 2 |
| Analytics | Benchmarks across customers | - | MX (shared knowledge) | — | — | Later (moat) |
| AI | AI-suggested failure codes | IBM, IFS | - | — | — | Phase 1 |
| AI | Similar past jobs and fixes (Fix Finder) | IBM, SAP, IFS | MX | — | ✓ | Phase 2 |
| AI | Troubleshooting answers grounded in manuals | IFS, ORCL, HxGN | MX, EM, BR | — | — | Phase 2 |
| AI | PM and procedure drafts from manuals | IFS | MX, UK, LB, EM | — | — | Phase 3 |
| AI | AI summaries and daily briefings | IFS, MSFT | MX, UK, BR | — | — | Phase 1 |
| AI | Duplicate-request detection | - | LB, BR | — | — | Phase 2 |
| AI | Agents that act (planner, data audit) | SAP, ORCL, IFS | UK, FR | — | — | Phase 3 |
| AI | Computer-vision inspection | IBM, SAP | OX | — | — | Skip |
| AI | AI-generated FMEA | IBM, IFS | - | — | — | Skip for now |
| AI | MCP connector for outside AI tools | - | LB, FR, CO | — | — | Phase 3 (cheap) |
| AI | Indian-language interface and voice | - | MX (Hindi only) | — | ◐ | Phase 1 (differentiator) |
| Platform | Multi-site and multi-company | All seven | Enterprise tiers | ✓ | — | Phase 1 |
| Platform | Custom roles and permissions | All seven | Enterprise tiers | ✓ | — | Phase 1 |
| Platform | SSO and LDAP | IBM | Enterprise tiers | ✓ | — | Keep |
| Platform | Phone or WhatsApp login for operators | - | - | — | — | Phase 1 |
| Platform | REST API and webhooks | Most | Most | ✓ | — | Keep |
| Platform | Workflow automation rules | Most | Most | ◐ | — | Phase 1; add timers |
| Platform | OT and IoT (MQTT, OPC UA, MTConnect) | IBM, SAP, ORCL, MSFT, AVEVA | MX, TR, FR | — | — | Phase 4; sensor pilot earlier |
| Platform | ERP and Tally integration | All seven | Enterprise tiers | — | — | Phase 4 |
| Platform | WhatsApp, SMS and email notifications | - | FR (WhatsApp), CR | ◐ | — | Phase 1 |
| Platform | Full audit trail | IBM, HxGN, IFS | FX, CO | ◐ | ◐ | Phase 1 |
| Platform | E-signatures and 21 CFR Part 11 | HxGN, ORCL | LB, EM | ◐ | — | Later (pharma) |
| Platform | White-label | - | LB, FX | ✓ | — | Keep |
| Platform | Self-hosted or on-premise option | IBM, GE | KW, OX | ✓ | — | Option later |
| Platform | Data import and export | All seven | All | ✓ | ✓ | Phase 1; AI drop inbox Phase 2 |
| Safety and compliance | Lockout / isolation checklist | IBM, HxGN, IFS | CO | — | — | Phase 2 |
| Safety and compliance | Permit-to-work | SAP, HxGN, IFS | CR, TT | — | — | Phase 3 |
| Safety and compliance | Management of change | IFS | - | — | — | Skip |
| Safety and compliance | EHS incidents | IFS, IBM (partial) | UK, CO | — | — | Later |
| Safety and compliance | Energy and emissions | IBM, HxGN, IFS | UK, TR | — | ◐ | Phase 3 with meters |
| Safety and compliance | ISO register formats and audit exports | - | - | — | ✓ | Phase 1 |

**Sources (main ones; full lists in handoff research notes 13 and 14)**

- Enterprise: [IBM Maximo Manage 9.1](https://www.ibm.com/docs/SSLPL8_cd/com.ibm.mam.doc/overview/c_wn_manage_91.html), [IBM Reliability Strategies](https://www.ibm.com/downloads/documents/us-en/10a99803c82fdae0), [IBM MRO Inventory Optimization](https://www.ibm.com/products/supply-chain-intelligence-suite/mro-inventory-optimization), [SAP APM](https://www.sap.com/products/scm/apm/features.html), [SAP Maintenance Planner Agent](https://www.sap.com/products/erp/maintenance-planner-agent.html), [Hexagon EAM overview](https://docs.hexagonppm.com/r/en-US/EAM-System-Overview/12.2/1271406), [IFS Cloud 25R2](https://www.ifs.com/-/media10/project/ifs/ifs/assets/ifs_fs_whats-new-in-ifs-cloud-25r2-new2pdf.pdf), [IFS Ultimo AI](https://www.ultimo.com/ai), [Oracle Maintenance agents](https://docs.oracle.com/en/cloud/saas/readiness/scm/25d/maint25d/25D-maintenance-wn-f40778.htm), [Microsoft Dynamics 365 Asset Management](https://learn.microsoft.com/en-us/dynamics365/supply-chain/asset-management/), [AVEVA Asset Strategy Optimization](https://www.aveva.com/en/products/asset-strategy-optimization/), [GE Vernova APM Strategy](https://gevernova.com/software/sites/default/files/2024-10/datasheet-asset-performance-management-strategy.pdf)
- Mid-market and India: [MaintainX pricing](https://www.getmaintainx.com/pricing), [MaintainX Sep 2026 release](https://www.getmaintainx.com/blog/whats-new-at-maintainx-september-2026), [UpKeep pricing](https://upkeep.com/pricing/), [Limble pricing](https://limble.com/pricing/), [Fiix pricing](https://fiixsoftware.com/pricing/), [eMaint pricing](https://www.emaint.com/pricing), [Fracttal AI](https://www.fracttal.com/en/fracttal-ai), [Tractian Omni Trac](https://tractian.com/en/solutions/omni-trac), [Eptura Asset](https://eptura.com/our-platform/eptura-asset/), [Siemens Asset Essentials](https://www.assetmanagement.siemens.com/products/asset-essentials), [Coast pricing](https://www.coastapp.com/pricing/), [Keep Wisely](https://www.keepwisely.com/), [OxMaint pricing](https://oxmaint.com/pricing), [Cryotos pricing](https://www.cryotos.com/pricing)
- Atlas: checked directly in the source code (commit 588c1e2).