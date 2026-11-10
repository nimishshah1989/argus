# Research: what the prototype misses — global scan (28 Oct 2026)

Core finding: prototype analytics already beat most MSME CMMS; missing = (1) structured failure taxonomy, (2) execution and loop-closure metrics, (3) cheap true run-hours. Build taxonomy first.

| # | Feature | Phase | Source |
|---|---|---|---|
| 1 | Failure coding (ISO 14224-lite: class → component → mode → cause → action) with AI auto-suggest | Now | https://www.fabrico.io/blog/iso-14224-failure-taxonomy-codes/ · IBM Maximo Assistant https://www.ibm.com/new/announcements/introducing-maximo-assistant-an-ai-resource-for-teams |
| 2 | Asset criticality matrix (safety, quality, delivery, repair cost, redundancy → A/B/C) | Now | SAP APM https://www.sap.com/products/scm/apm/features.html · GE Vernova APM https://gevernova.com/software/sites/default/files/2024-10/datasheet-asset-performance-management-strategy.pdf |
| 3 | PM compliance (SMRP 5.4.10 within 10% of interval) + PM effectiveness (own definition) | Now | https://exchange.smrp.org/discussion/conflict-between-metric-5410-and-5414 |
| 4 | Intervention ledger ("did it work?") | Now | — |
| 5 | Backlog + schedule compliance (best-in-class 90%) | Now | SMRP forum above |
| 6 | Operator CLIT checklists + red tags (TPM autonomous maintenance) | Now | https://reliamag.com/topics/guides/autonomous-maintenance |
| 7 | Multilingual copilot (voice → coded ticket; manual → PM checklist; nameplate photo → asset) | Now | MaintainX Copilot, Limble Asset Snap, UpKeep Nova, Siemens Senseye |
| 8 | Calibration register (ISO 9001 7.1.5) | Now | https://www.qi-a.com/learning-center/calibration-requirements-for-iso-9001/ |
| 9 | Skills matrix + shift handover log | Now | — |
| 10 | LOTO step in tickets | Now | https://cdc.gov/niosh/publications/numbered/2022-106.html |
| 11 | Crow-AMSAA + CUSUM/EWMA on failure rates | Now | https://itl.nist.gov/div898/handbook/apr/section1/apr191.htm |
| 12 | Manual condition readings with limits | Now | SAP APM |
| 13 | Spares: parts↔failure modes, Syntetos-Boylan demand classes, Poisson stocking by criticality | After 6 months | https://salford-repository.worktribe.com/output/1474812/on-the-categorization-of-demand-patterns |
| 14 | Weibull per failure mode + age-replacement test | After 6 months | https://reliawiki.com/index.php/Optimum_Replacement_Time_Example |
| 15 | Repair-vs-replace / economic life | After 6 months | GE Vernova APM |
| 16 | Vendor/OEM/AMC performance | After 6 months | — |
| 17 | RCM-lite FMEA templates per class (top 10 critical machines) | After 6 months | IBM, SAP (SAE JA1012) |
| 18 | Cross-tenant priors and benchmarks | Later (10+ tenants) | — |
| 19 | Sensed run-status + OEE availability | Pilot 10 machines | — |
| 20 | Metered energy (Modbus) | Later | — |
| 21 | PM interval optimisation | Later | — |
Don't build: sensorless ML "predictive", AI visual inspection, RBDs, 3D twins, AAS compliance.

## Digital twin
Now: live 2D floor plan coloured by ticket status, health + criticality overlay, cell-to-cell part flow. After 6 months: discrete-event capacity simulation (SimPy "machine shop" example) fed by MTBF/MTTR distributions and technician counts. Borrow IDTA 02006 Digital Nameplate fields. Change2Twin: organisational issues decide success. https://cran.csail.mit.edu/web/packages/simmer/vignettes/simmer-05-simpy.html · https://industrialdigitaltwin.org/en/wp-content/uploads/sites/2/2025/10/IDTA-02006-3-0-1_Submodel_Digital-Nameplate.pdf · https://i4ms.eu/?p=3852

## Closed-loop methods (sparse data)
Regression-to-the-mean warning; exact Poisson rate test (scipy.stats.poisson_means_test); Bayesian difference-in-differences with gamma-Poisson posteriors ("P(fix reduced failures)=0.87"); Crow-AMSAA slope before/after; CUSUM/EWMA (Han et al. 2010); forecast coverage tracking / PIT histogram.

## Visuals ranked
Bad-actor list; Pareto of downtime hours by failure mode; machine × week heatmap; MTBF/MTTR vs target with control limits; Crow-AMSAA log-log; backlog burn-down; PM compliance + effectiveness; intervention scorecard; ₹ cost waterfall; Weibull plot (only with data).

## Sensors ("sensor captures when, human says why")
CT clamp SCT-013 ~₹499; ESP32 node ~₹1.5-2k; Leanworx (Bengaluru) no public prices. Fanuc MTConnect Server (30i/31i/32i-A/B, 0i-D/F via FOCAS) exposes execution, alarms, spindle load, part count. Selec MFM383A Modbus meter ~₹3.4-4.8k. Vibration ₹15-54k each (critical utilities/bottleneck spindles only). Pilot estimate all 125 CNC + 10 meters ≈ ₹2.5-3.5 lakh hardware (unverified).
