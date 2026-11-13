import type { CrudSpec } from '../patterns/crud-page.js';
import { machinesTransport, type GalleryMachine } from './crud-data.js';

/** The whole settings page for machines: list, add, edit, switch off and on. */
export const machinesSpec: CrudSpec<GalleryMachine> = {
  key: 'gallery-machines',
  path: '/gallery/machines',
  transport: machinesTransport,
  titleKey: 'gallery:crud.title',
  emptyKey: 'gallery:crud.empty',
  fields: [
    { name: 'code', labelKey: 'gallery:crud.field.code', required: true },
    { name: 'name', labelKey: 'gallery:crud.field.name', required: true },
  ],
};
