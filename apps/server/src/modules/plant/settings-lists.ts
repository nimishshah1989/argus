import {
  LIST_NAMES,
  glossaryCreateSchema,
  glossaryPatchSchema,
  listItemCreateSchema,
  listItemPatchSchema,
  type ListName,
} from '@uptimo/shared';
import type { Resource } from './settings-resources.js';

/** One list (wait reasons, work types ...): rows of `list_item` with this `list` value. */
function listResource(list: ListName): Resource {
  return {
    path: `settings/lists/${list}`,
    table: 'list_item',
    scope: { column: 'list', value: list },
    kind: 'list_item',
    order: 'sort, code',
    columns: {
      code: 'code',
      label: 'label',
      labelGu: 'label_gu',
      labelHi: 'label_hi',
      sort: 'sort',
      active: 'active',
      isVendor: 'is_vendor',
      pausesSla: 'pauses_sla',
      tag: 'tag',
    },
    fixed: ['code'],
    create: listItemCreateSchema,
    patch: listItemPatchSchema,
    reply: (row) => ({
      id: row.id,
      code: row.code,
      label: row.label,
      labelGu: row.label_gu,
      labelHi: row.label_hi,
      sort: row.sort,
      isVendor: row.is_vendor,
      pausesSla: row.pauses_sla,
      tag: row.tag,
      active: row.active,
    }),
    switchTo: (active) => ({ active }),
  };
}

const glossary: Resource = {
  path: 'settings/glossary',
  table: 'glossary_term',
  kind: 'glossary',
  order: 'source',
  uniqueField: 'source',
  columns: { source: 'source', english: 'english', direction: 'direction' },
  create: glossaryCreateSchema,
  patch: glossaryPatchSchema,
  reply: (row) => ({
    id: row.id,
    source: row.source,
    english: row.english,
    direction: row.direction,
    active: true,
  }),
};

export const LIST_RESOURCES: readonly Resource[] = [...LIST_NAMES.map(listResource), glossary];
