export type PreviewCondition = 'Stopped' | 'Running';
export type PreviewWork = 'Not started' | 'In progress' | 'Waiting';
export type PreviewSituation = 'Stopped' | 'Support';

export type PreviewPerson = { id: string; name: string };
export type PreviewMachine = { id: string; code: string; name: string; location: string };
export interface PreviewTicket {
  ref: string;
  machineCode: string;
  problem: string;
  condition: PreviewCondition;
  work: PreviewWork;
  reportedBy: string;
  lead: string;
  support: string;
  downtimeMinutes: number;
  activeMinutes: number;
  timeline: { time: string; text: string }[];
}

export const previewPeople: PreviewPerson[] = [
  { id: 'avery', name: 'Avery Example' },
  { id: 'blair', name: 'Blair Sample' },
  { id: 'casey', name: 'Casey Demo' },
];
export const previewMachines: PreviewMachine[] = [
  { id: 'vc-17', code: 'VC-17', name: 'Vertical machining centre', location: 'Demo cell A' },
  { id: 'vc-04', code: 'VC-04', name: 'Vertical machining centre', location: 'Demo cell B' },
];
export const previewProblems = ['Spindle alarm', 'Coolant leak', 'Unexpected vibration'];
export const previewTickets: PreviewTicket[] = [
  {
    ref: 'BD-0148',
    machineCode: 'VC-17',
    problem: 'Spindle alarm at startup',
    condition: 'Stopped',
    work: 'Not started',
    reportedBy: 'avery',
    lead: 'blair',
    support: 'casey',
    downtimeMinutes: 38,
    activeMinutes: 0,
    timeline: [{ time: '09:42', text: 'Avery Example reported a spindle alarm.' }],
  },
  {
    ref: 'BD-0149',
    machineCode: 'VC-04',
    problem: 'Tool change support requested',
    condition: 'Running',
    work: 'Waiting',
    reportedBy: 'avery',
    lead: 'casey',
    support: 'blair',
    downtimeMinutes: 0,
    activeMinutes: 12,
    timeline: [{ time: '09:18', text: 'Avery Example requested support.' }],
  },
];

export function previewPersonName(id: string): string {
  return previewPeople.find((person) => person.id === id)?.name ?? 'Unassigned';
}
