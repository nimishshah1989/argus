import { defineModule } from '../../kernel/index.js';
import { registerFiles } from './routes.js';

export { insertFileRow } from './repo.js';
export { createLocalFileStore, type ObjectStore } from './store.js';

export const filesModule = defineModule({ name: 'files', register: registerFiles });
