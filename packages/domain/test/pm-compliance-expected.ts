/**
 * The compliance fixture of ticket 50b (R6/R7), hand-computed in `docs/slices/50-pm-calendar.md`. Seven PM plans and
 * nine PM tickets plus two inspection tickets; `task_expected_on` is the scheduled date and every close is a plant day.
 * This file holds the arithmetic, not a platform key: 49 reduced the platform's 427 projected visits to 125 plans, so
 * the product's compliance is defined over its own planned work orders (tickets), the only dated record it keeps.
 *
 * | Ticket | Channel    | Interval | Tol | Scheduled  | Closed               | PM         | Schedule |
 * | A1     | pm         | 182      | 15  | 2026-06-01 | 2026-06-10           | on time +9 | missed   |
 * | B1     | pm         | 30       | 2   | 2026-01-19 | 2026-01-14           | early −5   | done     |
 * | B2     | pm         | 30       | 2   | 2026-02-13 | 2026-02-20           | late +7    | missed   |
 * | B3     | pm         | 30       | 2   | 2026-03-22 | open                 | overdue    | missed   |
 * | C1     | pm         | 182      | 15  | 2026-07-02 | 2026-07-20           | late +18   | missed   |
 * | D1     | pm         | 182      | 15  | 2026-04-01 | 2026-04-01           | on time 0  | done     |
 * | D2     | pm         | 182      | 15  | 2026-09-30 | open                 | overdue    | missed   |
 * | G1     | pm         | 182      | 15  | 2026-10-30 | open                 | pending    | missed   |
 * | H1     | pm         | 30       | 2   | 2026-08-31 | cancelled 2026-09-02 | cancelled  | missed   |
 * | I1     | inspection | —        | —   | 2026-10-01 | 2026-10-03           | not a PM   | done     |
 * | I2     | inspection | —        | —   | 2026-10-05 | open                 | not a PM   | missed   |
 *
 * **PM arithmetic.** On time A1 + D1 = 2; early B1 = 1; late B2 + C1 = 2; overdue B3 + D2 = 2; cancelled H1 = 1;
 * pending G1 = 1 (excluded). eligible = 8; pct = round(1000 × 2 ÷ 8) / 10 = 25.0.
 * **Schedule arithmetic.** Done B1 + D1 + I1 = 3; missed the other eight; eligible = 11; pct = 27.3.
 */
export const PM_COMPLIANCE_EXPECTED = {
  value: {
    from: '2026-01-01',
    to: '2026-11-11',
    pm: {
      eligible: 8,
      onTime: 2,
      early: 1,
      late: 2,
      overdue: 2,
      cancelled: 1,
      pending: 1,
      pct: 25,
    },
    schedule: { eligible: 11, done: 3, missed: 8, pending: 0, pct: 27.3 },
  },
  /** Every planned work order of the window, in scheduled order and named once. */
  drill: ['t-b1', 't-b2', 't-b3', 't-d1', 't-a1', 't-c1', 't-h1', 't-d2', 't-i1', 't-i2', 't-g1'],
} as const;

/**
 * The same fixture read on 30 November, with G1 closed on 14 November: the +15 boundary (10-30 + 15) is inside the
 * tolerance, so it is a PM on-time close and still a schedule miss (its week ended 1 November).
 */
export const PM_COMPLIANCE_LATER = {
  value: {
    ...PM_COMPLIANCE_EXPECTED.value,
    to: '2026-11-30',
    pm: {
      eligible: 9,
      onTime: 3,
      early: 1,
      late: 2,
      overdue: 2,
      cancelled: 1,
      pending: 0,
      pct: 33.3,
    },
    schedule: { eligible: 11, done: 3, missed: 8, pending: 0, pct: 27.3 },
  },
  drill: PM_COMPLIANCE_EXPECTED.drill,
} as const;
