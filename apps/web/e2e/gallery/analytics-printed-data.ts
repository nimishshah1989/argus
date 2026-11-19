/** Text each screen prints exactly as the engine wrote it: a blank, a dash, "pts" and every figure stay as they were. */
export const PRINTED: [string, string[]][] = [
  [
    '/analytics/breakdowns?screen=a1-bd-pm',
    ['Breakdown hours', '41.5', '3 pts up', 'PM hours', '—', '12.5', '4.0'],
  ],
  [
    '/analytics/breakdowns?screen=a2-category-cell',
    ['Top category', 'Spindle', '12 breakdowns', '9.5'],
  ],
  ['/analytics/breakdowns?screen=a3-mttr-mtbf', ['MTTR', '2.5', 'MTBF', '110.0', 'hours']],
  [
    '/analytics/breakdowns?screen=a4-manpower',
    ['People', 'Hours handled', '30.5', 'Asha', '18.5', 'Ravi'],
  ],
  [
    '/analytics/breakdowns?screen=a10-problems',
    ['Groups', 'Odd noise', '01-03-2026', 'coolant, leak'],
  ],
  ['/analytics/breakdowns?screen=fix-finder', ['Best fix', 'Re-seat the probe', 'Probe re-seated']],
  ['/analytics/breakdowns?screen=shift-kpis', ['Day shift', '55.0%', 'Evening', '20.0']],
  ['/analytics/machines?screen=compare', ['Health', '82', '74', 'Coolant', '2019', '6.5']],
  [
    '/analytics/machines?screen=cell-change-log',
    ['10-02-2026', 'Cell 2 → Cell 6', 'No change', '— → Cell 2', '— → Bay B'],
  ],
];
