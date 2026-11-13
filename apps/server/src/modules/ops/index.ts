import { defineModule } from '../../kernel/index.js';
import { countAuditRows, recordAudit, type AuditEntry } from './repo.js';

export { countAuditRows };

export const audit = { record: recordAudit };
export type { AuditEntry };

export const opsModule = defineModule({ name: 'ops', register: () => undefined });
