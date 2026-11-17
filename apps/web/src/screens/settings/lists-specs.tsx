import {
  glossaryReplySchema,
  listItemReplySchema,
  type GlossaryReply,
  type ListItemReply,
} from '@uptimo/shared/plant-settings';
import type { CrudChoice, CrudCtx, CrudSpec, LabelKey } from '../../patterns/crud-spec.js';

/** The plant settings lists (ticket 23): each one is a `CrudPage` config over `/settings/lists/<name>`. */

export type ListsPage = 'wait_reason' | 'work_type' | 'quick_problem';
type Flag = 'isVendor' | 'pausesSla' | 'needsLockout';

const FLAG: Record<Flag, { labelKey: LabelKey; wordKey: LabelKey; only: string }> = {
  pausesSla: {
    labelKey: 'lists.field.pausesSla',
    wordKey: 'lists.pausesSla',
    only: 'Only a wait reason stops the SLA clock.',
  },
  isVendor: {
    labelKey: 'lists.field.vendor',
    wordKey: 'lists.vendor',
    only: 'Only a wait reason can wait on a vendor.',
  },
  needsLockout: {
    labelKey: 'lists.field.needsLockout',
    wordKey: 'lists.lockout',
    only: 'Only a work type or a breakdown category needs lockout (slice 8).',
  },
};
const ALL_FLAGS: readonly Flag[] = ['isVendor', 'pausesSla', 'needsLockout'];

const yesNo = (c: CrudCtx): CrudChoice[] => [
  { value: 'true', label: c.t('lists.flag.yes') },
  { value: 'false', label: c.t('lists.flag.no') },
];

const flagsOf = (row: ListItemReply, c: CrudCtx, flags: readonly Flag[]): string =>
  flags
    .filter((flag) => row[flag])
    .map((flag) => c.t(FLAG[flag].wordKey))
    .join(' · ');

function listSpec(p: {
  page: ListsPage;
  flags: readonly Flag[];
  titleKey: LabelKey;
  addKey: LabelKey;
  emptyKey: LabelKey;
}): CrudSpec<ListItemReply> {
  const hidden = {
    labelGu: 'Ticket 24 enters translations on the translation screen.',
    labelHi: 'Ticket 24 enters translations on the translation screen.',
    tag: 'A short tag for floor chips; the approved frames do not show it.',
    ...Object.fromEntries(
      ALL_FLAGS.filter((flag) => !p.flags.includes(flag)).map((flag) => [flag, FLAG[flag].only]),
    ),
  };
  return {
    key: `list-${p.page}`,
    path: `/api/v1/settings/lists/${p.page}`,
    schema: listItemReplySchema,
    titleKey: p.titleKey,
    addKey: p.addKey,
    emptyKey: p.emptyKey,
    footnoteKey: 'plant.audit',
    hidden,
    fields: [
      { name: 'label', labelKey: 'lists.field.label', required: true },
      { name: 'code', labelKey: 'lists.field.code', required: true, addOnly: true },
      { name: 'sort', labelKey: 'lists.field.sort' },
      ...p.flags.map((flag) => ({
        name: flag,
        labelKey: FLAG[flag].labelKey,
        kind: 'choice' as const,
        flag: true,
        choices: yesNo,
      })),
    ],
    look: (row, c) => ({ title: row.label, sub: flagsOf(row, c, p.flags) }),
    columns: [
      {
        labelKey: 'lists.flags',
        cell: (row, c) => flagsOf(row, c, p.flags) || c.t('lists.noFlags'),
      },
    ],
    search: { labelKey: 'lists.search', text: (row) => `${row.label} ${row.code}` },
  };
}

export interface ListsPageSpec {
  page: ListsPage;
  titleKey: LabelKey;
  subKey: LabelKey;
  spec: CrudSpec<ListItemReply>;
}

/** One entry is a menu row, a route (`/settings/lists?list=`) and a settings screen. */
export const LIST_PAGES: readonly ListsPageSpec[] = [
  {
    page: 'wait_reason',
    titleKey: 'lists.waitReason.title',
    subKey: 'lists.menu.waitReason.sub',
    spec: listSpec({
      page: 'wait_reason',
      flags: ['pausesSla', 'isVendor'],
      titleKey: 'lists.waitReason.title',
      addKey: 'lists.waitReason.add',
      emptyKey: 'lists.waitReason.empty',
    }),
  },
  {
    page: 'work_type',
    titleKey: 'lists.workType.title',
    subKey: 'lists.menu.workType.sub',
    spec: listSpec({
      page: 'work_type',
      flags: ['needsLockout'],
      titleKey: 'lists.workType.title',
      addKey: 'lists.workType.add',
      emptyKey: 'lists.workType.empty',
    }),
  },
  {
    page: 'quick_problem',
    titleKey: 'lists.quickProblem.title',
    subKey: 'lists.menu.quickProblem.sub',
    spec: listSpec({
      page: 'quick_problem',
      flags: [],
      titleKey: 'lists.quickProblem.title',
      addKey: 'lists.quickProblem.add',
      emptyKey: 'lists.quickProblem.empty',
    }),
  },
];

/** The hub's rows, from the one page config: a list added there appears with no screen code. */
export const listMenu = (
  pages: readonly { page: string; titleKey: LabelKey; subKey: LabelKey }[],
): { to: string; titleKey: LabelKey; subKey: LabelKey }[] =>
  pages.map(({ page, titleKey, subKey }) => ({
    to: `/settings/lists?list=${page}`,
    titleKey,
    subKey,
  }));

const DIRECTION: Record<GlossaryReply['direction'], LabelKey> = {
  gu: 'lists.glossary.direction.gu',
  'gu-Latn': 'lists.glossary.direction.gu-Latn',
  en: 'lists.glossary.direction.en',
};

export const glossarySpec: CrudSpec<GlossaryReply> = {
  key: 'glossary',
  path: '/api/v1/settings/glossary',
  schema: glossaryReplySchema,
  titleKey: 'lists.glossary.title',
  addKey: 'lists.glossary.add',
  emptyKey: 'lists.glossary.empty',
  introKey: 'lists.glossary.intro',
  footnoteKey: 'plant.audit',
  fields: [
    { name: 'source', labelKey: 'lists.glossary.source', required: true },
    { name: 'english', labelKey: 'lists.glossary.english', required: true },
    {
      name: 'direction',
      labelKey: 'lists.glossary.direction',
      kind: 'choice',
      choices: (c) =>
        (['gu', 'gu-Latn', 'en'] as const).map((value) => ({
          value,
          label: c.t(DIRECTION[value]),
        })),
    },
  ],
  look: (row, c) => ({
    title: row.source,
    sub: `${row.english} · ${c.t(DIRECTION[row.direction])}`,
  }),
  columns: [{ labelKey: 'lists.glossary.column', cell: (row) => row.english }],
  search: { labelKey: 'lists.glossary.source', text: (row) => `${row.source} ${row.english}` },
};
