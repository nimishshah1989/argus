# G1.6 money-rights tests (plan PR)

- **Done:** `apps/server/test/analytics-money-rights.test.ts`: one test per route a v2 figures screen reads (figures, dated figures, drill for ticket/machine/move, action-center board, nudge ack and reopen, run, analytics-profile), each as a supervisor (analytics yes, money no), on a plant seeded with a spare cost and a machine-hour value no other number shares.
- **Finding:** by reading the code, no route leaks today: `routes.ts` drops `money` figures and nulls the profile's money fields for non-money roles; drill rows and the board carry no cost field; the spares nudge prints a share, not rupees.
- **Unverified:** not run locally (no Docker for Testcontainers in this session). CI's api shards are the proof.
- **Open question for the orchestrator:** the non-money `compare` figure prints two "Spares cost" rows as a placeholder `₹ 0` for every role (`packages/domain/src/analytics/compare.ts` lines 98-99). No plant data, but a rupee line a supervisor sees and a false zero for heads. The test allows `₹ 0` only. Move to `compare.spares-cost` or drop: a product call.
