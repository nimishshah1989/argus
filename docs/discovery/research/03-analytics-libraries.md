# Research: reliability, forecasting, text and BI libraries (verified 27 Oct 2026)

## Reliability
| Library | Does | Release | Licence |
|---|---|---|---|
| SurPyval | MLE fits with censoring AND truncation; HPP, NHPP CrowAMSAA/Duane/CoxLewis, GeneralizedRenewal, ARA/ARI, non-parametric MCF, proportional-intensity NHPP, CauseSpecificMCF | 0.25, 17 Oct 2026 | MIT |
| reliability (M. Reid) | censored fits, ALT, MCF, ROCOF with Laplace test + power-law NHPP, Duane/Crow-AMSAA, optimal replacement | 0.9.0, Mar 2025 (slowing) | LGPL-3.0 |
| lifelines | survival (KM, Cox) | 0.30.3 Mar 2026 | MIT |
| scikit-survival | ML survival | 0.28.0 | GPL-3.0+ |
| predictr | Weibull MLE/MRR with bias corrections | 0.1.37 | MIT |
Verdict: SurPyval core; reliability as cross-check.

## Methods for repairable systems
- Plain Weibull on time-between-failures assumes as-good-as-new repair and no trend. Test for trend first (Laplace, MIL-HDBK, reverse arrangement — NIST handbook 8.2.3.4 https://itl.nist.gov/div898/handbook/apr/section2/apr234.htm).
- No trend → HPP/renewal; trend → power-law NHPP (Crow-AMSAA; beta > 1 deteriorating). Fleets → MCF (Nelson 2003).
- Standards: IEC 61710:2013 (power law model, repairable items) https://webstore.iec.ch/publication/5732 ; IEC 61649 Ed 2.0 2008 (Weibull); MIL-HDBK-189C 2011 (reliability growth) https://www.dote.osd.mil/Portals/97/docs/TEMPGuide/MIL-HDBK-189C.pdf
- Small samples: Crow-AMSAA beta biased; unbiased (n-2)/n; below ~5-8 failures/machine fit by class only.
- Censoring: time since last failure = right-censored; machines running before log start = left-truncated.

## Count forecasting
- statsmodels 0.15.0 GLM NegativeBinomial/Poisson with exposure (BSD-3).
- Hierarchical NB with partial pooling by class: PyMC 6.3.2 (Apache-2.0), Bambi 0.21.0 (MIT) — best fit for sparse data.
- statsforecast 2.1.1 Croston/SBA/TSB/ADIDA/IMAPA for spare-parts demand (Apache-2.0). Syntetos-Boylan ADI 1.32 / CV² 0.49 classification.
- Note (our view): the prototype's model is already a hand-rolled empirical-Bayes gamma-Poisson with resampled repair times — port it as the champion; hierarchical NB in PyMC/Bambi as challenger, judged by the existing Forecast Lab back-test.

## Text
- rapidfuzz 3.14.6 (MIT) — name/spelling cleanup.
- sentence-transformers 6.2.0; BAAI/bge-m3 (MIT, 100+ langs, 1024-d); multilingual-e5-small (MIT, 384-d); l3cube IndicSBERT (CC-BY-4.0, incl. Gujarati).
- pgvector 0.8.7 (HNSW, halfvec, hybrid with FTS via RRF); pg_trgm for typos.
- BERTopic 0.17.4 (MIT) — offline theme discovery only.
- Plan: Fix Finder = hybrid retrieval (pgvector + pg_trgm + FTS, RRF), filtered by machine class; fault theming = LLM classifies into fixed per-tenant taxonomy; benchmark on ~200 labelled real log pairs (no published Gujarati/Romanised-Gujarati evidence).

## BI / charts
- Superset 6.1.0 (Apache-2.0) embedded with guest tokens + RLS; SDK still alpha.
- Metabase OSS is AGPL; embedding needs Pro ($575/mo + $12/user) for white-label + multi-tenant RLS.
- Cube (Apache-2.0 core) optional semantic layer.
- ECharts (Apache-2.0), Recharts (MIT) safe.
- Plan: build ~15 core screens in-app; Superset later only for self-serve.

## KPI standards
- SMRP Best Practices 6th ed: 70+ metrics; e.g. 2.1.1 OEE, 2.2 Availability, 3.5.1 MTBF, 3.5.2 MTTR, 3.5.3 MTBM, 5.3.1 Planned Work, 5.4.1 Reactive Work, 5.4.3/5.4.4 Schedule Compliance, 5.4.14 PM & PdM Compliance. https://smrp.org/Resources/SMRP-Library/Best-Practices-Metrics-Guidelines
- EN 15341:2019+A1:2022 Maintenance KPIs (paywalled; buy before claiming compliance).
- Define each KPI once in SQL, label with SMRP number, show formula in tooltip. No OEE without production data.
