export type PreviewCondition = 'Stopped' | 'Running';
export type PreviewWork = 'Not started' | 'In progress' | 'Waiting';
export type PreviewSituation = 'Stopped' | 'Support';

export interface PreviewPerson {
  id: string;
  name: string;
  role: string;
}

export interface PreviewMachine {
  id: string;
  code: string;
  name: string;
  location: string;
}

export interface PreviewTimelineItem {
  id: string;
  time: string;
  text: string;
}

export interface PreviewTicket {
  ref: string;
  machineCode: string;
  problem: string;
  condition: PreviewCondition;
  work: PreviewWork;
  reportedBy: string;
  lead: string;
  support: string;
  reportedAt: string;
  downtimeMinutes: number;
  activeMinutes: number;
  timeline: PreviewTimelineItem[];
}

export const previewPeople: PreviewPerson[] = [
  { id: 'avery', name: 'Avery Example', role: 'Technician' },
  { id: 'blair', name: 'Blair Sample', role: 'Technician' },
  { id: 'casey', name: 'Casey Demo', role: 'Shift lead' },
];

export const previewMachines: PreviewMachine[] = [
  { id: 'vc-17', code: 'VC-17', name: 'Vertical machining centre', location: 'Demo cell A' },
  { id: 'vc-04', code: 'VC-04', name: 'Vertical machining centre', location: 'Demo cell B' },
  { id: 'mx-08', code: 'MX-08', name: 'CNC lathe', location: 'Demo cell C' },
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
    reportedAt: '09:42',
    downtimeMinutes: 38,
    activeMinutes: 0,
    timeline: [
      { id: '0148-1', time: '09:42', text: 'Avery Example reported a spindle alarm.' },
      { id: '0148-2', time: '09:45', text: 'Blair Sample was assigned as lead.' },
    ],
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
    reportedAt: '09:18',
    downtimeMinutes: 0,
    activeMinutes: 12,
    timeline: [
      { id: '0149-1', time: '09:18', text: 'Avery Example requested support.' },
      { id: '0149-2', time: '09:31', text: 'Work paused while waiting for a tool.' },
    ],
  },
  {
    ref: 'BD-0147',
    machineCode: 'MX-08',
    problem: 'Coolant level check',
    condition: 'Running',
    work: 'In progress',
    reportedBy: 'blair',
    lead: 'blair',
    support: 'casey',
    reportedAt: '08:56',
    downtimeMinutes: 0,
    activeMinutes: 24,
    timeline: [
      { id: '0147-1', time: '08:56', text: 'Blair Sample reported a low coolant level.' },
      { id: '0147-2', time: '09:02', text: 'Work started with Casey Demo supporting.' },
    ],
  },
];

export function previewPersonName(id: string): string {
  return previewPeople.find((person) => person.id === id)?.name ?? 'Unassigned';
}
