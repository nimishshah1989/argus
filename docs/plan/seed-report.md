# Seed report — Cosmos

## Counts

- machines: 192
- people: 14
- codes_active: 19
- codes_inactive: 3
- shifts: 2
- glossary: 144
- segments: 6

## Conflicts

- VC-57 exists only in the live ids; segment inferred as CNC, category as Vertical Machining Center, nameplate fields left blank.
- Robot is one machine inside the export CNC list; the live config counts it as its own segment.
- 191 machines in the 28 Oct export, 192 live ids on 9 Nov — the difference is VC-57.
- 14 people = 13 maintenance + 1 vendor (Imptex Team); the vendor is seeded as a vendor person, not staff.
- 19 live maintenance codes; ELE, HYD, ROT are kept inactive. History also uses MEC, NI, INT, FS, PP, UTI — not seeded; resolve aliases (Q9).
- Two shift windows (08:00–18:30, 18:29–05:00) but the report form lists three shifts — pending Bhavin/Nimish (Q8).
- Glossary caveats are recorded in the source file and must be fixed at seed.

## Sources

- docs/discovery/source/cosmos-platform-export-2026-10-28.json
- docs/discovery/bhavin-v3/live-config-2026-11-09.json
- docs/discovery/bhavin-v3/glossary-2026-11-09.json
