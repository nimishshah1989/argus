import type { SettledDecision } from './model.js';
import { decision, PEOPLE, type PersonId } from './fixture-decisions.js';
import { pt } from '../dashboard/fixture-text.js';

/** One decision that is not waiting, with the sentence that says when it comes back or who settled it. */
function settled(
  status: SettledDecision['status'],
  when: string,
  by: PersonId,
  d: Parameters<typeof decision>[0],
): SettledDecision {
  const made = decision({ ...d, owner: by });
  const verb = status === 'parked' ? 'back on' : 'settled on';
  return {
    status,
    decision: { ...made, decided: status === 'settled' },
    line: pt(
      `{{decision:${d.id}|${d.title}}} · ${verb} **${when}** · {{person:${by}|${PEOPLE[by]}}}`,
    ),
  };
}

/** The decisions parked and settled: parked until a day, then settled in the last week, newest first. */
export const notWaiting: SettledDecision[] = [
  settled('parked', '27-Nov-2026', 'meera-k', {
    id: 'oil',
    kind: 'inspect',
    codes: ['VC-17'],
    title: 'Check the hydraulic oil on the vertical centres',
    keys: [['Level low twice', 'risk']],
    why: ['The oil level on {{machine:VC-17|VC-17}} was **low twice** this month'],
    more: ['Parked until the PM on **27-Nov-2026**'],
    hours: 2.1,
    days: [30, 62],
    action: 'Schedule an inspection',
    done: 'Inspection booked',
    owner: null,
  }),
  settled('parked', '01-Dec-2026', 'neel-s', {
    id: 'guard',
    kind: 'plan',
    codes: ['GRD-123'],
    title: 'Refit the spindle guard on the grinder',
    keys: [['Guard bent', 'risk']],
    why: ['The guard on {{machine:GRD-123|GRD-123}} is **bent** and still holds'],
    more: ['Waiting for the part, due **01-Dec-2026**'],
    hours: 1.4,
    days: [51],
    action: 'Order the guard',
    done: 'Guard ordered',
    owner: null,
  }),
  settled('settled', '18-Nov-2026', 'arjun-v', {
    id: 'cable',
    kind: 'fix',
    codes: ['VC-67'],
    title: 'Replace the damaged encoder cables',
    keys: [['Fix exists', 'gain']],
    why: ['{{machine:VC-67|VC-67}} lost **13 breakdowns** to bent encoder cables'],
    more: ['New cables fitted on **18-Nov-2026**'],
    hours: 6.2,
    days: [4, 11, 20, 28, 35, 49, 58, 66, 74, 80, 85, 88, 89],
    action: 'Assign a fix',
    done: 'Fixed',
    owner: null,
  }),
  settled('settled', '17-Nov-2026', 'meera-k', {
    id: 'cell2-pm',
    kind: 'plan',
    codes: ['VC-17'],
    title: 'Move the Cell 2 PM to a quiet day',
    keys: [['Two machines kept running', 'gain']],
    why: ['**3 PMs** fell on one day in Cell 2'],
    more: ['{{machine:VC-17|VC-17}} moved to **19-Nov-2026**'],
    hours: 3.8,
    days: [],
    action: 'Move the PM',
    done: 'Moved',
    owner: null,
  }),
  settled('settled', '14-Nov-2026', 'neel-s', {
    id: 'coolant',
    kind: 'fix',
    codes: ['TC-56'],
    title: 'Clean the coolant tank on the turning centre',
    keys: [['Coolant in encoders', 'risk']],
    why: ['{{machine:TC-56|TC-56}} had **5 coolant alarms** in 90 days'],
    more: ['Tank cleaned and filter changed on **14-Nov-2026**'],
    hours: 2.7,
    days: [22, 41, 58, 77, 84],
    action: 'Clean the tank',
    done: 'Cleaned',
    owner: null,
  }),
];
