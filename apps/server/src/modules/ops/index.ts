import { defineModule } from '../../kernel/index.js';
import { recordAudit, type AuditEntry } from './repo.js';

export const audit = { record: recordAudit };
export type { AuditEntry };

export const opsModule = defineModule({ name: 'ops', register: () => undefined });
