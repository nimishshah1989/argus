import {
  ESCALATION_TRIGGERS,
  ladderLevelSchema,
  ruleReplySchema,
  type RuleReply,
} from '@uptimo/shared/escalation-settings';
import type { PersonAdmin } from '@uptimo/shared/people';
import type { CrudCtx, CrudSpec, LabelKey } from '../../../patterns/crud-spec.js';

/**
 * The escalation ladder (ticket 31): when a clock is missed, who is told at which level, after how long and
 * how often. The repeat floor and the "one of role or person" pairing are the server's answers, shown as they
 * come back; the screen never rewords them.
 */

const ROLES = ['technician', 'supervisor', 'head', 'plant_head', 'admin'] as const;
const SEVERITIES = ['S1', 'S2', 'S3', 'S4'] as const;
const LEVELS = ladderLevelSchema.options;
const CHANNEL_KEY: LabelKey = 'plant.ladder.channel.push';

const rowsOf = <T,>(c: CrudCtx, name: string) => c.lookups[name] as T[];
const personName = (c: CrudCtx, id: string | null) =>
  id ? (rowsOf<PersonAdmin>(c, 'people').find((person) => person.id === id)?.name ?? '') : '';
const triggerText = (trigger: string, c: CrudCtx) => c.t(`plant.ladder.trigger.${trigger}`);
const roleText = (role: string, c: CrudCtx) => c.t(`plant.ladder.role.${role}`);
const levelText = (level: string, c: CrudCtx) => c.t(`plant.roster.level.${level}`);
const severityText = (severity: string, c: CrudCtx) => c.t(`plant.ladder.severity.${severity}`);
const whoText = (row: RuleReply, c: CrudCtx): string =>
  personName(c, row.notifyPersonId) ||
  (row.notifyRole ? roleText(row.notifyRole, c) : c.t('plant.ladder.nobody'));
const delayText = (row: RuleReply, c: CrudCtx) =>
  c.t('plant.ladder.delayValue', { minutes: row.delayMinutes });
const repeatText = (row: RuleReply, c: CrudCtx) =>
  row.repeatMinutes === null || row.repeatCap === null
    ? c.t('plant.ladder.noRepeat')
    : c.t('plant.ladder.repeatValue', { minutes: row.repeatMinutes, cap: row.repeatCap });

export const ladderSpec: CrudSpec<RuleReply> = {
  key: 'escalation-rules',
  path: '/api/v1/escalation-rules',
  schema: ruleReplySchema,
  titleKey: 'plant.ladder.title',
  emptyKey: 'plant.ladder.empty',
  addKey: 'plant.ladder.add',
  introKey: 'plant.ladder.intro',
  footnoteKey: 'plant.audit',
  lookups: { people: { key: 'people', path: '/api/v1/people' } },
  fields: [
    {
      name: 'trigger',
      labelKey: 'plant.ladder.trigger',
      kind: 'choice',
      required: true,
      choices: (c) => ESCALATION_TRIGGERS.map((value) => ({ value, label: triggerText(value, c) })),
    },
    {
      name: 'severityMin',
      labelKey: 'plant.ladder.severity',
      kind: 'choice',
      required: true,
      choices: (c) => SEVERITIES.map((value) => ({ value, label: severityText(value, c) })),
    },
    {
      name: 'level',
      labelKey: 'plant.ladder.level',
      kind: 'choice',
      required: true,
      choices: (c) => LEVELS.map((value) => ({ value, label: levelText(value, c) })),
    },
    {
      name: 'notifyRole',
      labelKey: 'plant.ladder.role',
      kind: 'choice',
      choices: (c) => ROLES.map((value) => ({ value, label: roleText(value, c) })),
    },
    {
      name: 'notifyPersonId',
      labelKey: 'plant.ladder.person',
      kind: 'choice',
      choices: (c) =>
        rowsOf<PersonAdmin>(c, 'people')
          .filter((person) => person.active)
          .map((person) => ({ value: person.id, label: person.name })),
    },
    {
      name: 'channel',
      labelKey: 'plant.ladder.channel',
      kind: 'choice',
      choices: (c) => [{ value: 'push', label: c.t(CHANNEL_KEY) }],
    },
    { name: 'delayMinutes', labelKey: 'plant.ladder.delay' },
    { name: 'repeatMinutes', labelKey: 'plant.ladder.repeatMinutes' },
    { name: 'repeatCap', labelKey: 'plant.ladder.repeatCap' },
  ],
  look: (row, c) => ({
    title: triggerText(row.trigger, c),
    sub: [
      severityText(row.severityMin, c),
      levelText(row.level, c),
      whoText(row, c),
      delayText(row, c),
    ].join(' · '),
  }),
  columns: [
    {
      labelKey: 'plant.ladder.trigger',
      cell: (row, c) => triggerText(row.trigger, c),
      sortKey: (row) => row.trigger,
    },
    {
      labelKey: 'plant.ladder.severity',
      cell: (row, c) => severityText(row.severityMin, c),
      sortKey: (row) => row.severityMin,
    },
    {
      labelKey: 'plant.ladder.level',
      cell: (row, c) => levelText(row.level, c),
      sortKey: (row) => row.level,
    },
    {
      labelKey: 'plant.ladder.whoColumn',
      cell: (row, c) => whoText(row, c),
      sortKey: (row, c) => whoText(row, c),
    },
    {
      labelKey: 'plant.ladder.delayColumn',
      cell: (row, c) => delayText(row, c),
      sortKey: (row) => row.delayMinutes,
    },
    {
      labelKey: 'plant.ladder.repeatColumn',
      cell: (row, c) => repeatText(row, c),
      sortKey: (row) => row.repeatMinutes ?? 0,
    },
  ],
};
