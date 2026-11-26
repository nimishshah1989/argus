import {
  glossaryReplySchema,
  listItemReplySchema,
  type GlossaryReply,
  type ListItemReply,
} from '@uptimo/shared/plant-settings';
import type { CrudChoice, CrudCtx, CrudSpec, LabelKey } from '../../../patterns/crud-spec.js';

/** The plant settings lists (ticket 23): each one is a `CrudPage` config over `/settings/lists/<name>`. */

export type ListsPage =
  | 'wait_reason'
  | 'work_type'
  | 'quick_problem'
  | 'breakdown_category'
  | 'lockout_step'
  | 'failure_code';
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

export const flagsOf = (row: ListItemReply, c: CrudCtx, flags: readonly Flag[]): string =>
  flags
    .filter((flag) => row[flag])
    .map((flag) => c.t(FLAG[flag].wordKey))
    .join(' · ');

/** The old codes a failure-code row folds onto itself, as the one comma-separated line the form edits. */
const aliasesOf = (row: ListItemReply): string => (row.aliases ?? []).join(', ');

function listSpec(p: {
  page: ListsPage;
  flags: readonly Flag[];
  titleKey: LabelKey;
  addKey: LabelKey;
  emptyKey: LabelKey;
  /** The failure codes are the one list that edits `aliases`; every other list hides the key (ticket 47). */
  aliases?: boolean;
}): CrudSpec<ListItemReply> {
  const hidden = {
    labelGu: 'Ticket 24 enters translations on the translation screen.',
    labelHi: 'Ticket 24 enters translations on the translation screen.',
    tag: 'A short tag for floor chips; the approved frames do not show it.',
    // Ticket 47's old codes are entered on the failure-code screen; every other list leaves the key unseen.
    ...(p.aliases
      ? {}
      : { aliases: 'Old codes of the failure-code list, edited on that screen (ticket 47).' }),
    ...Object.fromEntries(
      ALL_FLAGS.filter((flag) => !p.flags.includes(flag)).map((flag) => [flag, FLAG[flag].only]),
    ),
  };
  return {
    key: `list-${p.page}`,
    path: `/api/v1/settings/lists/${p.page}`,
    // The desk and the board read these labels from the cached config: a rename must refresh it.
    invalidates: ['config'],
    schema: listItemReplySchema,
    titleKey: p.titleKey,
    addKey: p.addKey,
    emptyKey: p.emptyKey,
    footnoteKey: 'plant.audit',
    hidden,
    ...(p.aliases ? { note: (_values, _row, c) => c.t('lists.aliases.hint') } : {}),
    fields: [
      { name: 'label', labelKey: 'lists.field.label', required: true },
      { name: 'code', labelKey: 'lists.field.code', required: true, addOnly: true },
      { name: 'sort', labelKey: 'lists.field.sort' },
      ...(p.aliases ? [{ name: 'aliases', labelKey: 'lists.field.aliases' as const }] : []),
      ...p.flags.map((flag) => ({
        name: flag,
        labelKey: FLAG[flag].labelKey,
        kind: 'choice' as const,
        choices: yesNo,
      })),
    ],
    // The row reads its label, with the old codes under it, so a switched-off code's aliases stay visible.
    look: p.aliases
      ? (row) => ({ title: row.label, sub: aliasesOf(row) })
      : (row, c) => ({ title: row.label, sub: flagsOf(row, c, p.flags) }),
    columns: [
      {
        labelKey: 'lists.flags',
        cell: (row, c) => flagsOf(row, c, p.flags) || c.t('lists.noFlags'),
      },
    ],
    search: {
      labelKey: 'lists.search',
      text: (row) => `${row.label} ${row.code} ${p.aliases ? aliasesOf(row) : ''}`,
    },
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
  {
    page: 'breakdown_category',
    titleKey: 'lists.breakdownCategory.title',
    subKey: 'lists.menu.breakdownCategory.sub',
    spec: listSpec({
      page: 'breakdown_category',
      flags: ['needsLockout'],
      titleKey: 'lists.breakdownCategory.title',
      addKey: 'lists.breakdownCategory.add',
      emptyKey: 'lists.breakdownCategory.empty',
    }),
  },
  {
    // The four starting steps are seeded by the server; this is the list the head edits them on.
    page: 'lockout_step',
    titleKey: 'lists.lockoutStep.title',
    subKey: 'lists.menu.lockoutStep.sub',
    spec: listSpec({
      page: 'lockout_step',
      flags: [],
      titleKey: 'lists.lockoutStep.title',
      addKey: 'lists.lockoutStep.add',
      emptyKey: 'lists.lockoutStep.empty',
    }),
  },
  {
    // The close's one code (ticket 47): seeded from the plant's own codes, its old codes editable here.
    page: 'failure_code',
    titleKey: 'lists.failureCode.title',
    subKey: 'lists.menu.failureCode.sub',
    spec: listSpec({
      page: 'failure_code',
      flags: [],
      titleKey: 'lists.failureCode.title',
      addKey: 'lists.failureCode.add',
      emptyKey: 'lists.failureCode.empty',
      aliases: true,
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

export const DIRECTION: Record<GlossaryReply['direction'], LabelKey> = {
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
  // Their word / Our word / Written in: the table reads the three as columns, not as a sub line.
  look: (row) => ({ title: row.source }),
  columns: [
    { labelKey: 'lists.glossary.column', cell: (row) => row.english },
    { labelKey: 'lists.glossary.direction', cell: (row, c) => c.t(DIRECTION[row.direction]) },
  ],
  search: { labelKey: 'lists.glossary.source', text: (row) => `${row.source} ${row.english}` },
};
