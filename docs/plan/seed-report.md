# Seed report — Cosmos

## Counts

- machines: 192
- segment_CNC: 125
- segment_Conventional: 16
- segment_Process: 17
- segment_Utility: 30
- segment_DG: 3
- segment_Robot: 1
- people: 27
- logins: 26
- codes_active: 19
- codes_inactive: 3
- shifts: 2
- glossary: 144
- segments: 6

## Conflicts

- CNC Machine Master has 126 rows: 125 CNC + 1 Robot (own segment).
- In the 11 Nov registers but not the 28 Oct export: VC-57.
- Blank make, model or serial in Conventional: BS-04, LATHE-4.
- Blank make, model or serial in Process: US-1, US-2, US-4, MD-2, COP-1, BM-1, BM-2, BM-3, PH-1, PH-2.
- Blank make, model or serial in Utility: DRYER-07, DRYER-08, STABILIZER-02, STABILIZER-09, STABILIZER-10.
- 26 logins (14 technician, 11 operator, 1 admin) + 1 vendor person (Imptex Team) without a login.
- 19 live maintenance codes; ELE, HYD, ROT are kept inactive. History also uses MEC, NI, INT, FS, PP, UTI — not seeded; resolve aliases (Q9).
- Two shift windows (08:00–18:30, 18:29–05:00) but the report form lists three shifts — pending Bhavin/Nimish (Q8).
- Glossary caveats are recorded in the source file and must be fixed at seed.

## Sources

- docs/discovery/source/cosmos-platform-export-2026-10-28.json
- docs/discovery/bhavin-v3/live-config-2026-11-09.json
- docs/discovery/bhavin-v3/glossary-2026-11-09.json
- apps/server/src/seed/generated/cosmos-machines.json
- apps/server/src/seed/cosmos-shifts.json
- apps/server/src/seed/fixtures/cosmos-people.fixture.json
