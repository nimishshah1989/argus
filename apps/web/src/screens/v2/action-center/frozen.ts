import i18n from 'i18next';
import type { ActionCenterBoardReply } from '@uptimo/shared';
import recorded from './frozen-board.json' with { type: 'json' };
import { actionCenterModel } from './adapter.js';

const board = recorded as unknown as ActionCenterBoardReply;
/** The recorded plant's machine ids are its codes; the gallery has no server to ask for more. */
const machines = [
  ...new Set([...board.nudges.flatMap((n) => n.machines), ...board.risk.map((r) => r.machine)]),
].map((code) => ({ id: code, code, category: null }));
const people = [
  { id: 'asha', name: 'Asha', active: true },
  { id: 'ravi', name: 'Ravi', active: true },
];

/** The gallery's Action Center: the real engine's board for the frozen 11 November plant, through the live adapter. */
export const frozenActionCenter = () =>
  Promise.resolve(
    actionCenterModel(
      { board, machines, people, timeZone: 'Asia/Kolkata' },
      (key, values) => i18n.t(key, { ...values }) as string,
    ),
  );
