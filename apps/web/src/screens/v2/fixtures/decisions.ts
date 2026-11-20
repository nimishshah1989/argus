import type { DecisionData, DecisionKind } from '../../../ui/v2/domain/decision-row.js';
import type { PillTone } from '../../../ui/v2/key-pill.js';
import { dashboardFixture } from './plant-fixture.js';
import { chip, glue, pt, pts } from './text.js';

/** The invented people the gallery's drawers know (screens/v2/entity/fixture.ts), by the id a chip carries. */
export const PEOPLE = { 'arjun-v': 'Arjun V', 'meera-k': 'Meera K', 'neel-s': 'Neel S' } as const;
export type PersonId = keyof typeof PEOPLE;

/** What a month of breakdown hours won back is worth a year, in lakh, for the decisions written here. */
const LAKH_PER_HOUR = 0.2158;
const KIND_LABEL: Record<DecisionKind, string> = {
  decide: 'Decide',
  fix: 'Fix for good',
  inspect: 'Inspect',
  plan: 'Plan',
};

type Spec = {
  id: string;
  kind: DecisionKind;
  codes: string[];
  title: string;
  keys: [string, PillTone][];
  why: string[];
  more: string[];
  /** Breakdown hours a month it wins back. */
  hours: number;
  days: number[];
  action: string;
  done: string;
  owner: PersonId | null;
};

const ownerLine = (id: PersonId | null) =>
  pt(id ? `Owner: {{person:${id}|${PEOPLE[id]}}}` : 'Owner: not assigned');

/** One invented decision written the way the engine will send it: figures printed, people and machines as chips. */
export function decision(s: Spec): DecisionData {
  return {
    id: s.id,
    kind: s.kind,
    kindLabel: KIND_LABEL[s.kind],
    codes: s.codes.map(chip),
    title: s.title,
    keys: s.keys.map(([text, tone]) => ({ text, tone })),
    why: pts(...s.why),
    detail: pts(...s.why, ...s.more),
    hours: glue(`${s.hours.toFixed(1)} h`),
    money: glue(`₹ ${(s.hours * LAKH_PER_HOUR).toFixed(2)} lakh a year`),
    days: s.days,
    stripLabel: `${s.days.length} breakdowns in the last 90 days`,
    action: s.action,
    doneText: s.done,
    owner: ownerLine(s.owner),
    decided: false,
  };
}

/** Who owns each decision waiting; null when nobody has taken it, even if someone is suggested (`SUGGESTED`). The Dashboard's four are the same decisions, so its drawers and this page agree. */
export const OWNER: Record<string, PersonId | null> = {
  axis: null,
  tmc2: null,
  dcmc: 'meera-k',
  wj01: 'neel-s',
  bearing: null,
  'night-pm': 'meera-k',
  amc: 'neel-s',
};

/** Who the engine suggests for a decision nobody owns yet: a suggestion is not an owner. */
export const SUGGESTED: Record<string, PersonId> = { axis: 'arjun-v' };

const extra: DecisionData[] = [
  decision({
    id: 'bearing',
    kind: 'decide',
    codes: ['TC-4', 'TC-56'],
    title: 'Keep a spare spindle bearing for the turning centres',
    keys: [
      ['9 repairs waited for it', 'risk'],
      ['Lead time 6 weeks', 'risk'],
    ],
    why: [
      '**9 repairs** waited for a spindle bearing this year, !!61 h!! lost',
      'Worst on {{machine:TC-4|TC-4}} and {{machine:TC-56|TC-56}}',
    ],
    more: [
      'A spare costs about **₹ 0.9 lakh** and pays back in ++4 months++',
      'Next step: **approve the purchase**, or name a supplier with a shorter lead time',
    ],
    hours: 12.6,
    days: [8, 14, 23, 29, 41, 47, 55, 70, 82],
    action: 'Approve a spare',
    done: 'Spare approved',
    owner: null,
  }),
  decision({
    id: 'night-pm',
    kind: 'plan',
    codes: ['TC-111', 'TC-115'],
    title: 'Add a night PM slot in Cell 8',
    keys: [
      ['2 PMs slipped in October', 'risk'],
      ['Cell 8 up 14.0 h', 'loss'],
    ],
    why: [
      '**2 PMs** slipped in October because the day crew was on repairs',
      '{{machine:TC-111|TC-111}} and {{machine:TC-115|TC-115}} broke down within a week of the missed PM',
    ],
    more: ['One technician on nights covers it', 'The day crew is then ++free for repairs++'],
    hours: 9.4,
    days: [6, 19, 33, 40, 52, 61, 77],
    action: 'Add a night PM slot',
    done: 'Night PM slot added',
    owner: 'meera-k',
  }),
  decision({
    id: 'amc',
    kind: 'decide',
    codes: ['VTL-83'],
    title: 'Renew the service contract on the turret lathe',
    keys: [['Contract ends 30-Nov-2026', 'risk']],
    why: [
      'The service contract on {{machine:VTL-83|VTL-83}} ends on **30-Nov-2026**',
      'Repairs without it cost about !!3.2 h!! more a month',
    ],
    more: ['Renewing before the end date keeps the **current rate**'],
    hours: 3.2,
    days: [15, 44, 71],
    action: 'Renew the contract',
    done: 'Renewal started',
    owner: 'neel-s',
  }),
];

/** The Dashboard says "Suggested" for the axis fix until someone takes it; every other owner reads the same here. */
const withOwner = (d: DecisionData): DecisionData =>
  d.id === 'axis' ? d : { ...d, owner: ownerLine(OWNER[d.id] ?? null) };

const hoursOf = (d: DecisionData) => parseFloat(d.hours);
/** Every decision waiting, biggest first by hours: the Dashboard's four and three more. */
export const waiting: DecisionData[] = [
  ...dashboardFixture.decisions.map(withOwner),
  ...extra,
].sort((a, b) => hoursOf(b) - hoursOf(a));
