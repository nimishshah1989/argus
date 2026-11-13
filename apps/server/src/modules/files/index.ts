import { defineModule } from '../../kernel/index.js';

export { insertFileRow } from './repo.js';
export {
  createLocalFileStore,
  dayReportObjectKey,
  pdfObjectKey,
  type ObjectStore,
} from './store.js';

export const filesModule = defineModule({ name: 'files', register: () => undefined });
