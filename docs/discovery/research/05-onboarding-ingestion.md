# Research: client onboarding from messy data (27 Oct 2026)

## Embeddable importers
| Product | Notes | Price | Licence/self-host |
|---|---|---|---|
| Flatfile | AI field match; Excel header detection scans first 10 rows; AI Transform proposes rule, preview before apply | Starter $0; others unpublished | Enterprise self-managed |
| OneSchema | AI mappings + 1-click mode GA 21 Sep 2026; remembers mappings; PDF extraction (Pro) | unpublished | Enterprise self-host |
| Dromo | AI column match incl. some non-English headers; autoMapHeaders memory | $599/mo for 250 imports + $3/import | Enterprise on-prem |
| CSVBox | AI matching all plans | $0-165/mo | - |
| Ingestro (ex-nuvo) | AI mapping | unpublished | Custom self-host |
| react-spreadsheet-import | header row + sheet select, fuzzy match, validation | free | MIT |
| ImportCSV | AI mapping via backend | free | frontend MIT, backend AGPL |
| TableFlow csv-import | CSV/XLSX templates | free | MIT |
| Impler | Excel templates + validation | free | MIT |
Verdict: none handle handwritten Gujarati registers, ISO history cards, WhatsApp exports; $-pricing does not fit MSME economics → build own pipeline, MIT frontend, copy proven patterns.

## LLM mapping / cleaning
- SpreadsheetLLM (Microsoft) — compress sheet around structural anchors (~25x), 78.9% F1 table detection. https://arxiv.org/abs/2407.09025
- Magneto (VLDB) — small models retrieve candidates, LLM reranks. https://arxiv.org/abs/2412.08194
- LLM verbalised confidence is overconfident (https://arxiv.org/abs/2306.13063) → use checkable signals: validation pass, two-engine agreement, remembered mapping hit, multi-run agreement.
- Rules in code: date format inferred per column (any first part > 12 → DD-MM; ambiguous → DD-MM for India + flag; keep raw); units with explicit formulas (kVA↔kW needs power factor → store raw + unit); duplicate machine names via fuzzy + serial + make/model → LLM adjudicates → human confirms → alias saved per tenant.
- Parsers: Docling (MIT; PDF/XLSX/images, OCR) https://github.com/docling-project/docling ; Marker (weights restricted above $5M revenue/funding); Unstructured (Apache-2.0). whatstk is GPL → write own WhatsApp export parser.

## OCR for Indian languages
| Engine | Gujarati printed | Gujarati handwritten |
|---|---|---|
| Google Cloud Vision | yes | not listed |
| Azure Document Intelligence | not listed | no |
| AWS Textract | no | no |
| Sarvam Vision 2.1 | yes (22 langs) | claims "Indic Handwritten Recognition", no accuracy published |
Sarvam self-reported printed Gujarati benchmark 88.87 vs other models lower (vendor benchmark). Pricing ₹0.50/page digitisation, ₹1/page extraction. ICDAR 2025 Indic handwriting dataset includes Gujarati — use for testing. Gujarati handwriting is weak/unproven everywhere → two engines + disagreement = low confidence + line-level human review; test on 50 real registers before promising.

## Review UX patterns
Per-field confidence thresholds (Rossum), source-beside-extraction with click-to-highlight (Sarvam Akshar), candidate dropdowns + "update all" (CxAI nameplate), AI-proposed bulk transform with preview (Flatfile), per-client mapping memory (OneSchema, Dromo).

## Competitor onboarding features
- MaintainX: asset from nameplate/spec-sheet photo (Enterprise); industry procedure templates; QR export on Avery sheets.
- Limble "Asset Snap" (Jan 2026): asset records from machine photos.
- UpKeep: part from photo only.

## Pipeline (recommended)
0 Day-1 value: machine list (paste / template / nameplate photo), team by phone, CNC starter pack (categories, failure codes, PM checklists), QR labels, WhatsApp breakdown capture live; history later.
1 One drop inbox per client; auto-classify file type.
2 Extract (Excel header detection; multi-table → SpreadsheetLLM-style sketch; PDF Docling; images Sarvam + frontier vision; WhatsApp own parser); every value keeps source pointer.
3 Map (tenant memory → synonyms/embeddings → LLM pick) with signal-based confidence.
4 Normalise in code (dates, units, dedupe, link people/spares).
5 Review only low-confidence: diff, bulk accept, side-by-side, apply-to-similar, progress meter; corrections become tenant rules.
6 Commit as reversible import batch with audit.
