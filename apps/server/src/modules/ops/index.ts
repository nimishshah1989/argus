import { defineModule } from '../../kernel/index.js';
import {
  auditPage,
  countAuditRows,
  recordAudit,
  recordSupportCall,
  supportCalls,
  type AuditEntry,
  type AuditPageFilter,
  type AuditPageRow,
  type SupportCallEntry,
  type SupportCallRow,
} from './repo.js';

export { countAuditRows };

export const audit = {
  record: recordAudit,
  supportCall: recordSupportCall,
  supportCalls,
  page: auditPage,
};
export type { AuditEntry, AuditPageFilter, AuditPageRow, SupportCallEntry, SupportCallRow };

export const opsModule = defineModule({ name: 'ops', register: () => undefined });
