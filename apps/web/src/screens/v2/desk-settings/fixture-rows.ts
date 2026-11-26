import type { ListItem, Machine, SeverityMatrix } from '@uptimo/shared/config';
import type { SlaPolicy } from '@uptimo/shared/sla';

export const machine = (id: string, criticality: Machine['criticality']): Machine => ({
  id,
  code: id,
  category: null,
  cell: null,
  segment_id: null,
  group_id: null,
  criticality,
});

export const MATRIX: SeverityMatrix = {
  default: {
    A: { stopped: 'S1', support: 'S2' },
    B: { stopped: 'S2', support: 'S3' },
    C: { stopped: 'S3', support: 'S4' },
  },
  workRequest: 'S4',
  urgentWorkRequest: 'S2',
};

export const policy = (severity: SlaPolicy['severity'], ackMinutes: number): SlaPolicy => ({
  id: `00000000-0000-4000-8000-00000000000${severity[1]}`,
  severity,
  ackMinutes,
  restoreMinutes: ackMinutes * 16,
  pauseMaxMinutes: null,
  handbackMinutes: null,
  businessHoursOnly: false,
});

export const reason = (
  code: string,
  pausesSla: boolean,
  sort: number,
  active = true,
): ListItem => ({
  id: code,
  list: 'wait_reason',
  code,
  label: code,
  labelGu: null,
  labelHi: null,
  sort,
  active,
  isVendor: false,
  pausesSla,
  tag: null,
});
