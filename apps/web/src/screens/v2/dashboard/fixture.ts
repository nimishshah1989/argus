import type { Point, Tone } from '../../../ui/v2/points.js';
import type { CellData, MachineState } from '../../../ui/v2/domain/plant-map.js';
import type { DashboardModel } from './model.js';

/**
 * Invented figures from the approved mock (docs/design/v2/dashboard-approved.dc.html), for the gallery only.
 * `pt` writes a sentence the short way: **bold**, !!loss!!, ++gain++, ~~risk~~.
 */
const MARK: Record<string, Tone> = { '**': 'strong', '!!': 'loss', '++': 'gain', '~~': 'risk' };
// A number and its unit never part at a line end ("~167 h", "₹ 15.59 lakh"): the engine will do the same.
const glue = (s: string) =>
  s.replace(/(\d) (?=h\b|min\b|lakh\b|pts\b)/g, '$1\u00a0').replace(/₹ /g, '₹\u00a0');
const pt = (s: string): Point =>
  glue(s)
    .split(/(\*\*[^*]+\*\*|!![^!]+!!|\+\+[^+]+\+\+|~~[^~]+~~)/)
    .filter(Boolean)
    .map((t) => {
      const tone = MARK[t.slice(0, 2)];
      return tone ? { text: t.slice(2, -2), tone } : { text: t };
    });
const pts = (...lines: string[]) => lines.map(pt);

const WHY: Record<MachineState, Point[]> = {
  run: pts('Running since **6:10 today**', '**0 breakdowns** in 30 days'),
  risk: pts(
    '~~3 breakdowns~~ in 30 days, up from **1**',
    'Repairs taking ~~2× longer~~ than its type',
  ),
  down: pts('Down for !!2 h 40 min!!', 'Problem: **spindle alarm**', 'Assigned to ++Neel S++'),
  pm: pts('Quarterly PM, **started 9:30**', 'Back by ++14:00++ (plan)'),
  idle: pts('No job loaded since **yesterday**'),
};
const ODD: Record<string, MachineState> = {
  '1-3': 'down',
  '1-12': 'idle',
  '2-1': 'pm',
  '2-8': 'risk',
  '3-4': 'pm',
  '3-9': 'risk',
  '4-2': 'risk',
  '4-10': 'down',
  '5-6': 'down',
  '5-11': 'risk',
  '6-0': 'pm',
  '6-7': 'risk',
  '7-3': 'down',
  '7-12': 'idle',
  '8-0': 'risk',
  '8-5': 'down',
  '8-9': 'risk',
  '8-13': 'idle',
  '9-2': 'pm',
  '9-6': 'risk',
};
const SIZES = [14, 14, 15, 13, 15, 14, 14, 15, 12];
const KINDS = ['TC', 'VC', 'VC', 'TC', 'VC', 'VTL', 'VC', 'TC', 'GRD'];
const cells: CellData[] = SIZES.map((n, c) => ({
  name: `Cell ${c + 1}`,
  machines: Array.from({ length: n }, (_, i) => {
    const state = ODD[`${c + 1}-${i}`] ?? 'run';
    return { code: `${KINDS[c]}-${c * 15 + i + 1}`, state, why: WHY[state] };
  }),
}));

const STATE_WORDS = {
  run: 'Running',
  risk: 'At risk',
  down: 'Broken down',
  pm: 'In PM',
  idle: 'Idle or out',
};

export const dashboardFixture: DashboardModel = {
  verdict: {
    context: 'Friday 20 November · whole plant',
    headline: pt('November is !!9% worse!! than October. Four decisions win most of it back.'),
    why: pts(
      'Breakdown hours: !!312 h!! this month vs **286 h** in October',
      '**3 machines** (HMC-2, TC-10, VC-22) caused !!31%!! of the hours',
      'Biggest jump: **Cell 8**, !!+14 h!!',
      'The 4 decisions below win back ++79.7 h a month++ (++₹ 15.59 lakh a year++)',
    ),
    figures: [
      { label: 'Lost this month', value: glue('₹ 10.4 lakh'), note: glue('312.4 breakdown hours') },
      {
        label: 'You can win back',
        value: glue('₹ 15.59 lakh'),
        note: glue('a year · 79.7 h a month'),
        tone: 'gain',
      },
    ],
  },
  decisions: [
    {
      id: 'axis',
      kind: 'fix',
      kindLabel: 'Fix for good',
      codes: ['VC-8', 'VC-9', 'TC-5'],
      title: 'Stop axis motor and encoder failures',
      keys: [
        { text: '16% of all hours', tone: 'loss' },
        { text: 'Fix exists', tone: 'gain' },
      ],
      why: pts(
        '!!478 h!! in **98 breakdowns** on 44 machines',
        'Worst on **VC-8 (13)**, **VC-9 (10)**, **TC-5 (5)**',
        'Causes: ~~cable bends~~ and ~~coolant in encoders~~',
        '++Arjun V++ fixed the same fault on **VC-14**; it has not come back in 5 months',
      ),
      hours: glue('48.1 h'),
      money: glue('₹ 10.38 lakh a year'),
      days: [2, 5, 11, 14, 19, 25, 27, 33, 36, 41, 47, 50, 55, 58, 63, 66, 72, 75, 81, 86, 89],
      stripLabel: '21 breakdowns in the last 90 days',
      action: 'Assign a root-cause fix',
      doneText: 'Assigned to Arjun V',
      owner: 'Suggested: Arjun V',
      decided: false,
    },
    {
      id: 'tmc2',
      kind: 'decide',
      kindLabel: 'Decide',
      codes: ['TMC-2'],
      title: 'Overhaul or replace the turnmill',
      keys: [
        { text: 'Health 4.1 / 10', tone: 'loss' },
        { text: '2.6× expected loss', tone: 'loss' },
      ],
      why: pts(
        'Lost !!308 h!! — a machine its age and type loses about **119 h**',
        '**20 breakdowns** this year, mostly **spindle** and **ball screws**',
        'Each month waiting costs about !!18.8 h!!',
        'Next step: get an **overhaul quote** and compare with ++replacement++',
      ),
      hours: glue('18.8 h'),
      money: glue('₹ 4.07 lakh a year'),
      days: [3, 9, 15, 22, 31, 38, 44, 52, 60, 61, 70, 78, 84, 88],
      stripLabel: '14 breakdowns in the last 90 days',
      action: 'Get an overhaul quote',
      doneText: 'Quote requested',
      owner: 'Owner: not assigned',
      decided: false,
    },
    {
      id: 'dcmc',
      kind: 'plan',
      kindLabel: 'Plan',
      codes: ['DCMC-02'],
      title: 'Move a warranty PM to keep Cell 3 running',
      keys: [
        { text: '3 PMs on 26 Nov', tone: 'plan' },
        { text: 'Warranty safe', tone: 'gain' },
      ],
      why: pts(
        '**3 PM jobs** fall on **26 Nov** in Cell 3',
        'Moving DCMC-02 to **24 Nov** leaves ++2 machines down instead of 3++',
        'The ++warranty date still holds++',
      ),
      hours: glue('7.5 h'),
      money: glue('one shift kept'),
      days: [],
      stripLabel: 'No breakdowns in the last 90 days',
      action: 'Move to 24 Nov',
      doneText: 'Moved to 24 Nov',
      owner: 'Warranty date holds',
      decided: false,
    },
    {
      id: 'wj01',
      kind: 'inspect',
      kindLabel: 'Inspect',
      codes: ['WJ-01'],
      title: 'Inspect the waterjet before December',
      keys: [
        { text: 'Rising', tone: 'risk' },
        { text: '11 in 90 days', tone: 'risk' },
      ],
      why: pts(
        'Forecast **5.3 h** next month, worst case !!18 h!!',
        '~~Coolant leakage~~ **20 times** this year',
        'Last fix: **pump seal** on 13 Oct — the leaks came back',
        'A PM slot is ++free on 24 Nov++',
      ),
      hours: glue('5.3 h'),
      money: glue('₹ 1.14 lakh a year'),
      days: [40, 52, 58, 63, 67, 71, 74, 79, 83, 86, 89],
      stripLabel: '11 breakdowns in the last 90 days',
      action: 'Schedule an inspection',
      doneText: 'Inspection on 24 Nov',
      owner: 'Free slot: 24 Nov',
      decided: false,
    },
  ],
  cells,
  bullets: [
    {
      id: 'b1',
      label: 'Fleet availability',
      shown: '99.36',
      unit: '%',
      value: 99.36,
      target: 99.5,
      lastMonth: 99.18,
      scale: [98.5, 100],
      higherIsBetter: true,
      met: false,
      verdict: 'Below target · better than Oct',
      aria: 'Fleet availability 99.36%, target 99.5%, last month 99.18%',
      why: pts(
        'Target **99.5%**, now **99.36%**: !!0.14 pts short!!',
        'Up ++0.18 pts++ from October',
        'Gap = about !!42 machine-hours!! this month',
      ),
    },
    {
      id: 'b2',
      label: 'Breakdown share',
      shown: '0.51',
      unit: '%',
      value: 0.51,
      target: 0.45,
      lastMonth: 0.57,
      scale: [0, 1],
      higherIsBetter: false,
      met: false,
      verdict: 'Above limit · improving',
      aria: 'Breakdown share 0.51%, limit 0.45%, last month 0.57%',
      why: pts(
        'Limit **0.45%**, now **0.51%**',
        'Down ++0.06 pts++ from October',
        'Cell 8 alone adds !!0.08 pts!!',
      ),
    },
    {
      id: 'b3',
      label: 'Time to repair',
      shown: '3.6',
      unit: ' h',
      value: 3.6,
      target: 3,
      lastMonth: 4,
      scale: [0, 6],
      higherIsBetter: false,
      met: false,
      verdict: '0.6 h slow · faster than Oct',
      aria: 'Time to repair 3.6 h, target 3 h, last month 4 h',
      why: pts(
        'Target **3 h**, now **3.6 h**',
        '++0.4 h faster++ than October',
        'Slowest: ~~waiting for spares~~ on 9 jobs',
      ),
    },
    {
      id: 'b4',
      label: 'Time between failures',
      shown: '212',
      unit: ' h',
      value: 212,
      target: 250,
      lastMonth: 198,
      scale: [0, 300],
      higherIsBetter: true,
      met: false,
      verdict: '38 h short',
      aria: 'Time between failures 212 h, target 250 h, last month 198 h',
      why: pts(
        'Target **250 h**, now **212 h**',
        'Up ++14 h++ from October',
        'Dragged down by **TMC-2** and **WJ-01**',
      ),
    },
    {
      id: 'b5',
      label: 'PM done on time',
      shown: '92',
      unit: '%',
      value: 92,
      target: 90,
      lastMonth: 88,
      scale: [70, 100],
      higherIsBetter: true,
      met: true,
      verdict: 'On target',
      aria: 'PM done on time 92%, target 90%, last month 88%',
      why: pts(
        '**11 of 12** PMs done on the day',
        'Up ++4 pts++ from October',
        'Missed: **VC-31**, spare not in stock',
      ),
    },
  ],
  pareto: {
    bars: [
      { label: 'Axis drives', hours: 78.6, shown: '78.6' },
      { label: 'Coolant', hours: 48.4, shown: '48.4' },
      { label: 'Tool clamp', hours: 39.6, shown: '39.6' },
      { label: 'ATC arm', hours: 30.9, shown: '30.9' },
      { label: 'Spindle', hours: 26.8, shown: '26.8' },
      { label: 'PLC alarm', hours: 24.2, shown: '24.2' },
      { label: 'Conveyor', hours: 19.8, shown: '19.8' },
      { label: 'Other', hours: 44.1, shown: '44.1' },
    ],
    top: 3,
    total: 312.4,
    aria: 'Breakdown hours by problem with running total; the top three problems are 53% of all breakdown hours',
    conclusion: pt('3 problems cause !!~167 h!! of the month’s 312 h'),
    why: pts(
      'These 3 are !!53%!! of this month’s breakdown hours (**166.6 h** of **312.4 h**)',
      'Each has a ++fix that worked before++ on at least one machine',
      'The other 5 together are **145.8 h**, less than these 3',
    ),
  },
  words: {
    why: 'Why?',
    whyThese: 'Why these 3?',
    decideTitle: 'Decide today',
    decideWaiting: '{n} waiting · biggest first',
    decideDone: '{n} of {total} decided',
    perMonth: 'a month',
    stripCaption: 'Breakdowns, last 90 days',
    plant: {
      title: 'The plant right now',
      mapLabel: 'Machines by cell',
      filterLabel: 'Show machines',
      filters: { all: 'All', down: 'Down', risk: 'At risk', pm: 'In PM' },
      states: STATE_WORDS,
      hint: 'Tap any square to see why that machine is in its state.',
      cellCounts: { down: '{n} down', risk: '{n} at risk', pm: '{n} in PM', idle: '{n} idle' },
      cellRunning: 'all running',
    },
    targetTitle: 'Against target',
    legend: { actual: 'This month', target: 'Target', last: 'Last month', zone: 'Good zone' },
    paretoTitle: 'Where the hours go',
    addFocus: 'Add to Team Focus',
    seeFixes: 'See the fixes',
  },
};
