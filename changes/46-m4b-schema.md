# 46 — the one M4b schema change

**What changed for a user:** nothing visible yet — this ticket adds the tables and columns M4b's features stand on.
The plan is `docs/slices/46-m4b-schema.md`: packet 46a is migration 0015 (four tables, two new ticket channels and
four failure-code columns with a list-item guard), packet 46b is the write paths those tables allow.

**Not in this PR:** no code, no screen, no seed.

**Plan revision (19 Nov):** a fresh review FAILed the first plan with nine must-fixes (seed rows for the four tenant
tables, the migration-runner 0015 entry, the PM report-data home, the real 46b files, the down file's header/ledger/
FORCE/function drop, the up header, the production-copy rehearsal, the new channels' SLA/drift/analytics policy, and
the intervention FK). The revised plan in this PR reflects all of them and the should-fixes.
