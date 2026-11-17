import {
  LOGIN_ROLES,
  loginAdminSchema,
  personAdminSchema,
  type LoginAdmin,
  type PersonAdmin,
} from '@uptimo/shared/people';
import { type ShiftReply } from '@uptimo/shared/plant-settings';
import { formatDateTime } from '../../components/format.js';
import { defineResource } from '../../data/index.js';
import type { CrudChoice, CrudCtx, CrudSpec } from '../../patterns/crud-spec.js';

const people = defineResource<PersonAdmin, PersonAdmin>({ key: 'people', path: '/api/v1/people' });
const signOut = defineResource<{ ended: number }>({
  key: 'people',
  path: '/api/v1/people/:id/sign-out',
});

const TEAMS = ['maintenance', 'production', 'vendor'] as const;
const teamOf = (row: PersonAdmin, c: CrudCtx) => c.t(`people.team.${row.team}`);
const loginsOf = (c: CrudCtx, id: string) =>
  (c.lookups.logins as LoginAdmin[]).filter((login) => login.personId === id);
const rolesOf = (c: CrudCtx, id: string) => [...new Set(loginsOf(c, id).map((l) => l.role))];
const roleText = (c: CrudCtx, id: string) =>
  rolesOf(c, id)
    .map((role) => c.t(`people.role.${role}`))
    .join(', ') || c.t('people.role.none');
const kindOf = (c: CrudCtx, id: string): string => {
  const own = loginsOf(c, id);
  if (own.length === 0) return c.t('people.login.none');
  return c.t(own.some((login) => login.shared) ? 'people.login.shared' : 'people.login.personal');
};
const cellText = (cell: string | null, c: CrudCtx) =>
  cell ? c.t('people.cellN', { cell }) : c.t('people.cell.none');
const shiftText = (code: string | null, c: CrudCtx) =>
  code ? c.t('people.shiftCode', { code }) : c.t('people.shift.none');
/** A last sign-in reads as a plant date and time, the same day the audit filters use. */
const signInText = (iso: string | null, c: CrudCtx) =>
  iso ? formatDateTime(iso, c.timeZone, true) : c.t('people.never');
const shiftChoices = (c: CrudCtx): CrudChoice[] =>
  (c.lookups.shifts as ShiftReply[]).map((shift) => ({ value: shift.code, label: shift.name }));
const roleChoices = (c: CrudCtx): CrudChoice[] =>
  LOGIN_ROLES.map((role) => ({ value: role, label: c.t(`people.role.${role}`) }));
const personChoices = (c: CrudCtx): CrudChoice[] =>
  (c.lookups.people as PersonAdmin[])
    .filter((person) => person.active)
    .map((person) => ({ value: person.id, label: person.name }));
const personName = (c: CrudCtx, id: string | null) =>
  id ? ((c.lookups.people as PersonAdmin[]).find((p) => p.id === id)?.name ?? '') : '';

export const peopleSpec: CrudSpec<PersonAdmin> = {
  key: 'people',
  path: '/api/v1/people',
  schema: personAdminSchema,
  titleKey: 'people.title',
  emptyKey: 'people.empty',
  addKey: 'people.add',
  introKey: 'people.intro',
  footnoteKey: 'people.audit',
  lookups: {
    logins: { key: 'logins', path: '/api/v1/logins' },
    shifts: { key: 'shifts', path: '/api/v1/shifts' },
  },
  switchOff: { hintKey: 'people.switchOff.hint', sendReason: true },
  bulk: {
    actions: [
      {
        id: 'shift',
        labelKey: 'people.bulk.shift',
        titleKey: 'people.bulk.shift.title',
        field: { name: 'defaultShift', labelKey: 'people.shift', choices: shiftChoices },
        run: async (row, values) => {
          await people.update(row.id, { defaultShift: values.defaultShift });
        },
      },
      {
        id: 'signOut',
        labelKey: 'people.bulk.signOut',
        titleKey: 'people.bulk.signOut.title',
        hintKey: 'people.bulk.signOut.hint',
        doneKey: 'people.bulk.signOut.done',
        run: async (row, values) => {
          const reply = await signOut.create<{ ended: number }>(
            { reason: values.reason },
            { id: row.id },
          );
          return reply.ended;
        },
      },
      {
        id: 'off',
        labelKey: 'people.bulk.off',
        titleKey: 'people.bulk.off.title',
        hintKey: 'people.bulk.off.hint',
        run: async (row, values) => {
          await people.update(row.id, { active: false, reason: values.reason });
        },
      },
    ],
  },
  hidden: {
    pending: 'The server flags a name that matches an erased person; shown, never edited.',
  },
  readOnly: { lastSignInAt: 'Shown in the list; the form never edits it.' },
  fields: [
    { name: 'name', labelKey: 'people.name', required: true },
    { name: 'shortName', labelKey: 'people.shortName' },
    { name: 'phone', labelKey: 'people.phone' },
    {
      name: 'team',
      labelKey: 'people.team',
      kind: 'choice',
      required: true,
      choices: (c) => TEAMS.map((team) => ({ value: team, label: c.t(`people.team.${team}`) })),
    },
    { name: 'title', labelKey: 'people.jobTitle' },
    { name: 'cell', labelKey: 'people.cell' },
    {
      name: 'defaultShift',
      labelKey: 'people.shift',
      kind: 'choice',
      choices: shiftChoices,
    },
  ],
  look: (row, c) => ({
    title: row.name,
    sub: [
      row.title,
      teamOf(row, c),
      `${roleText(c, row.id)} · ${kindOf(c, row.id)}`,
      cellText(row.cell, c),
      shiftText(row.defaultShift, c),
      c.t('people.lastSignInSub', { when: signInText(row.lastSignInAt, c) }),
      row.pending ? c.t('people.pending') : null,
    ]
      .filter(Boolean)
      .join(' · '),
  }),
  columns: [
    {
      labelKey: 'people.role',
      cell: (row, c) => roleText(c, row.id),
      sortKey: (row, c) => roleText(c, row.id),
    },
    {
      labelKey: 'people.cell',
      cell: (row, c) => cellText(row.cell, c),
      sortKey: (row) => row.cell ?? '',
    },
    {
      labelKey: 'people.shift',
      cell: (row, c) => shiftText(row.defaultShift, c),
      sortKey: (row) => row.defaultShift ?? '',
    },
    {
      labelKey: 'people.login',
      cell: (row, c) => kindOf(c, row.id),
      sortKey: (row, c) => kindOf(c, row.id),
    },
    {
      labelKey: 'people.lastSignIn',
      cell: (row, c) => signInText(row.lastSignInAt, c),
      sortKey: (row) => row.lastSignInAt ?? '',
    },
  ],
  search: { labelKey: 'people.search', text: (row) => `${row.name} ${row.shortName ?? ''}` },
  filter: {
    allKey: 'people.teamAll',
    options: (c) => TEAMS.map((team) => ({ code: team, name: c.t(`people.team.${team}`) })),
    of: (row) => row.team,
  },
};

const loginRoleText = (row: LoginAdmin, c: CrudCtx) => c.t(`people.role.${row.role}`);
const loginKindText = (row: LoginAdmin, c: CrudCtx) =>
  c.t(row.shared ? 'people.login.shared' : 'people.login.personal');

export const loginsSpec: CrudSpec<LoginAdmin> = {
  key: 'logins',
  path: '/api/v1/logins',
  schema: loginAdminSchema,
  titleKey: 'people.logins.title',
  emptyKey: 'people.logins.empty',
  addKey: 'people.logins.add',
  introKey: 'people.logins.intro',
  footnoteKey: 'people.audit',
  lookups: {
    people: { key: 'people', path: '/api/v1/people' },
  },
  switchOff: { hintKey: 'people.login.off.hint' },
  switchOn: {
    field: 'temporaryPassword',
    labelKey: 'people.login.password',
    hintKey: 'people.login.switchOn.hint',
  },
  hidden: {
    mustChangePassword:
      'Set by a temporary password and cleared when the person changes it; this screen never edits it.',
  },
  readOnly: { lastSignInAt: 'Shown in the list; the form never edits it.' },
  note: (_values, _row, c) => c.t('people.login.note'),
  fields: [
    { name: 'username', labelKey: 'people.username', required: true, addOnly: true },
    { name: 'role', labelKey: 'people.role', kind: 'choice', required: true, choices: roleChoices },
    {
      name: 'shared',
      labelKey: 'people.login.kind',
      kind: 'choice',
      required: true,
      choices: (c) => [
        { value: 'false', label: c.t('people.login.personal') },
        { value: 'true', label: c.t('people.login.shared') },
      ],
    },
    { name: 'personId', labelKey: 'people.person', kind: 'choice', choices: personChoices },
    { name: 'cell', labelKey: 'people.login.cell' },
    {
      name: 'temporaryPassword',
      labelKey: 'people.login.password',
      requiredOnAdd: true,
    },
  ],
  look: (row, c) => ({
    title: row.username,
    sub: [loginRoleText(row, c), row.shared ? cellText(row.cell, c) : personName(c, row.personId)]
      .filter(Boolean)
      .join(' · '),
  }),
  columns: [
    {
      labelKey: 'people.role',
      cell: (row, c) => loginRoleText(row, c),
      sortKey: (row, c) => loginRoleText(row, c),
    },
    { labelKey: 'people.login.kind', cell: (row, c) => loginKindText(row, c) },
    {
      labelKey: 'people.person',
      cell: (row, c) => personName(c, row.personId),
      sortKey: (row, c) => personName(c, row.personId),
    },
    { labelKey: 'people.cell', cell: (row, c) => (row.shared ? cellText(row.cell, c) : '') },
    {
      labelKey: 'people.lastSignIn',
      cell: (row, c) => signInText(row.lastSignInAt, c),
      sortKey: (row) => row.lastSignInAt ?? '',
    },
  ],
  search: { labelKey: 'people.login.search', text: (row) => row.username },
  filter: {
    allKey: 'people.roleAll',
    options: (c) => LOGIN_ROLES.map((role) => ({ code: role, name: c.t(`people.role.${role}`) })),
    of: (row) => row.role,
  },
};
