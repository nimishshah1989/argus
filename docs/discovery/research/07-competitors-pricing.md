# Research: competitors and pricing (accessed 27 Oct 2026; NP = not published)

| Vendor | Segment | Price | WhatsApp | Indian languages | AI/forecast | Sensors |
|---|---|---|---|---|---|---|
| MaintainX | global | $0 / $20 / $65 per user/mo annual; requesters free | no (3rd-party alerts) | Hindi UI | Assist (fixes from past WOs, voice notes) | ? |
| UpKeep | global SMB | $24 / $55 per user/mo | no | none | Voice Fill, Nova agent | optional |
| Limble | global mid | NP | no | none of 27 | AI PM builder, anomaly | ? |
| Fiix | global mfg | $0 / $45 / $75 per user/mo | no | unspecified | Foresight: history-based cost/time trends, parts, WO delays (not failure prediction) | Asset Health uses sensors |
| eMaint | mid/ent | NP | no | multi | AI suite | Fluke |
| Fracttal | LatAm | NP | outbound only | ? | predictive claims | ? |
| Tractian | industrial | NP | no | ? | WO demand forecast + sensor AI | core |
| Maintenance Connection | mid/ent | $110/user/mo | no | ? | - | IoT |
| IBM Maximo | enterprise | Essentials < US$40K/yr | no | - | Predict history-only mode ranks assets most likely to fail | not required |
| OxMaint | India/global SMB | $19 / $49 per user/mo; "from ₹2,800/month" | no | claims Gujarati, Hindi, Marathi... UI | predictive insights, voice WO | optional |
| InnoMaint | India | NP | sales widget | multi | LLM chatbot, predictive via IoT | IoT |
| TeroTAM (Ahmedabad) | India | NP | add-on? | ? | claims history-based prediction (thin) | IoT |
| MaintWiz (Chennai) | India mfg | NP | no | English | AI/ML claims | IoT |
| Cryotos | India/global | $29 / $39 / $69 per user/mo | Enterprise (direction unverified) | Hindi, Tamil | AI-first claims | IoT PM |
| Keep Wisely | India | ₹799-999 / ₹1,999 per user/mo; requesters free | YES: raise + update WOs (Pro+) | multi (unspecified) | Wisely Bot, AI checklists, self-diagnosis | IoT add-on |
| Fast Maintenance (Pune) | India mfg | NP (INR) | alerts only | ? | Dhruv AI clusters breakdown remarks | no |
| Facilio | FM | NP | Mira takes WhatsApp requests | ? | Atom AI | BMS |
| FacilityBot | FM | NP | WhatsApp fault reporting → tasks | 109 langs chatbot | - | no |
| Infinite Uptime | heavy process | outcome-based | no | DigiLogBook voice | prescriptive | sensors required |
| MachineMetrics | US CNC | per machine NP | no | - | Max AI | edge gateway |

## Answers
1. Sensor-free failure ranking from history: only IBM Maximo Predict verified (ranking, not monthly counts; ~$40K+/yr). Fiix Foresight = cost/time trends, not failure prediction. Nobody verified publishes per-machine monthly breakdown forecast by age band for SMB plants.
2. WhatsApp intake confirmed: Keep Wisely (India), FacilityBot, Facilio. None claims Gujarati/Hindi voice-note intake.
3. "Nobody else has these features" is wrong on: WhatsApp intake, Hindi/Gujarati UI, voice capture, complaint-text clustering (Fast Maintenance), fix suggestions from past WOs (MaintainX), health scores (Maximo, MaintainX), MTTR/MTBF dashboards (commodity), history-based failure ranking (Maximo).
   Genuine gaps: (a) Gujarati/Hindi WhatsApp voice note → structured ticket, no app; (b) two-sided production↔maintenance accountability loop (handback confirmation, disputes/reopens, SLAs per side) — likely, not proven; (c) age-cohort reliability + monthly forecast + bottleneck/what-if packaged for a 100-300 machine sensorless CNC shop at SMB price; (d) per-plant pricing with unlimited operators.
   Caveat: forecasting moat is narrow; the defensible asset is vernacular capture producing clean history.
4. Price anchors: global $19-110/user/mo; India Keep Wisely ₹799-1,999/user/mo; per-machine OEE tools €159/machine/mo (Evocon) etc. Derived: 150-machine plant with 10-15 paid seats ≈ ₹10-30k/month at Keep Wisely rates ≈ ₹70-200/machine/month (inference).

Sources: see doc Sources section; key: https://www.getmaintainx.com/pricing · https://upkeep.com/pricing/ · https://www.fiixsoftware.com/pricing/ · https://fiixsoftware.com/foresight · https://www.ibm.com/products/maximo/pricing · https://community.ibm.com/community/user/blogs/stefan-hoffmanns/2026/01/24/predict-prevent · https://keepwisely.com/pricing · https://keepwisely.com/blog-detail/whatsapp-integration-smart-maintenance- · https://www.fastmaintenancesoftware.com/ · https://oxmaint.com/pricing · https://www.cryotos.com/pricing · https://www.innomaint.com/pricing/ · https://www.terotam.com/pricing
