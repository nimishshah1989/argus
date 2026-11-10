# Research: standards and canonical data model (27 Oct 2026)

## ISO "digital records mandatory" claim → UNSUPPORTED
- ISO 9001:2026 published 16 Sep 2026 (https://www.iso.org/news/2026/09/ISO9001-2026); changes: quality culture/ethics, risks & opportunities, Harmonized Structure. Nothing found mandating digital records; documented information may be "any format and media" (ISO 9000:2015 3.8.6). DQS: 2026 edition "deliberately remains technology-neutral" (https://www.dqsglobal.com/en/learn/blog/revision-iso-9001). Transition ~3 years to ~Sep 2029 (anticipated).
- Likely confusion: ISO's "digitally enhanced content" format of the standard itself (from 1 Oct 2026).
- IATF 16949 clause 8.5.1.5 TPM (secondary summary): documented TPM system, maintenance objectives (OEE, MTBF, MTTR, PM compliance) reviewed in management review, PM + predictive where applicable, spares for key equipment. IATF 16949 2nd edition planned mid-2027 (SC-2026-005); maintenance not a priority topic.
- Defensible pitch: "digital makes the evidence auditors already ask for easy to produce" — strongest for IATF 16949 auto suppliers.

## ISA-95 / IEC 62264
Enterprise > Site > Area > Work center (production unit / production line / process cell / storage zone) > Work unit. Maintenance management is a defined function. OPC UA ISA-95 model encodes levels.

## ISO 14224:2016
Oil & gas origin; under review. Taxonomy levels 1-5 (use/location) and 6-9 (equipment unit, subunit, maintainable item, part). Failure record minimum: ID, equipment, date, failure mode, impact (critical/degraded/incipient); plus mechanism, cause, subunit/maintainable item, detection method, operating condition. Annex code lists are paid → author our own ISO-aligned codes.
Mechanism groups: mechanical, material, instrument, electrical, external influence. Cause groups: design, fabrication/installation, operation/maintenance, management. Mode examples: FTS, ELU, VIB, NOI, OHE, UST.

## EN 13306 / EN 15341
EN 13306:2017 terminology (failure = loss of ability to perform required function; failure is event, fault is state; corrective, preventive, condition-based, predictive). EN 15341:2019+A1:2022 KPIs in 8 groups. SMRP/EFNMS harmonisation exists.

## TPM / OEE
8 JIPM pillars; autonomous maintenance 7 steps (CLI standards; operators raise red/yellow tags → work requests). OEE = A × P × Q; six big losses. OPC 40501 (OPC UA for Machine Tools) models machine state, maintenance prognoses, tool life, OEE — future connectivity.

## RCA
AIAG-VDA FMEA (7 steps, Action Priority). No standard prescribes breakdown → RCA → CAPA → effectiveness check; build as configurable workflow.

## Open reference data
MIMOSA CCOM (free under own licence); IDTA AAS submodels 02018 Maintenance Instructions, 02019 Plant Asset Management; OPC 40501. No free generic discrete-manufacturing equipment-class library verified → build our own industry packs.

## India
7.83 crore Udyam registrations (Feb 2026). Gujarat 37.56 lakh new registrations Jul 2020-Jul 2025. Rajkot (2012-13 profile, dated): 43,711 units; machine-tool cluster 325; foundry 505; auto parts 303. No verified CNC shop count. ZED certification parameter #8 Planned Maintenance & Calibration. SAMARTH Udyog Bharat 4.0 centres.

## Canonical model (proposed)
Level 0 Tenant · 1 Site · 2 Area · 3 Work center typed (line / cell / process cell / storage / utility) · 4 Equipment unit (class from library) · 5 Subunit (spindle, axis drive, hydraulics, lube, coolant, CNC control, ATC) · 6 Maintainable item (bearing, ballscrew, servo, encoder) · 7 Part (spares).
Separate functional location from serialised asset (moves/swaps keep history).
Equipment-class template = unit of an industry pack: attributes, subunits, allowed failure modes, PM tasks/intervals, CLIT points, calibration items, criticality.
Failure record: ID, equipment, detected-at, mode, impact, mechanism, cause, detection method, subunit/item, operating condition, timestamps (stop, response, repair start, repair end, restart), activity type (EN 13306), labour, parts, OEE loss bucket, RCA method, CAPA, effectiveness check.
Codes: global immutable ISO-aligned set + tenant local-language aliases + plain-language symptom picker mapping to codes.
