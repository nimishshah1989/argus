import { defineModule } from '../../kernel/index.js';
import {
  countAuditRows,
  recordAudit,
  recordSupportCall,
  supportCalls,
  type AuditEntry,
  type SupportCallEntry,
  type SupportCallRow,
} from './repo.js';

export { countAuditRows };

export const audit = { record: recordAudit, supportCall: recordSupportCall, supportCalls };
export type { AuditEntry, SupportCallEntry, SupportCallRow };

export const opsModule = defineModule({ name: 'ops', register: () => undefined });
