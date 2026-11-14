import type { StatusDef } from './index.js';
import { FileCheck, FileWarning } from '../icon.js';

/** Whether a closed ticket has its report (desk lists and ticket detail). */
export const report = {
  needs_report: { tone: 'danger', icon: FileWarning, label: 'desk.needsReport' },
  with_report: { tone: 'ok', icon: FileCheck, label: 'close.report' },
} satisfies Record<string, StatusDef>;
