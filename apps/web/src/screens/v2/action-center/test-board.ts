import { actionCenterBoard, type NudgeAck } from '@uptimo/domain';
import { DEFAULT_PROFILE, type ActionCenterBoardReply } from '@uptimo/shared';
import { ENGINE_DATA } from '../../../../../../packages/domain/test/answer-key/fixture.js';

/**
 * The real engine's board for the frozen 11 November plant, for tests and for the gallery's recording. Three nudges carry
 * a stored acknowledgement (one acknowledged with owner, due and note, one snoozed, one resolved), so the four tabs have
 * rows; the engine, not the test, works out each status, count and risk row.
 */
export const AS_OF = '2026-11-11';

export const ACKS: Record<string, NudgeAck> = {
  'freq|TC-3': {
    status: 'ack',
    owner: 'Asha',
    due: '2026-11-20',
    note: 'Check the bearing',
    at: '2026-11-10T08:00:00.000Z',
  },
  'rise|VC-41': {
    status: 'snooze',
    owner: '',
    due: '',
    note: '',
    at: '2026-11-10T08:00:00.000Z',
    until: '2026-11-18T08:00:00.000Z',
  },
  'mttr|S-2': {
    status: 'done',
    owner: 'Ravi',
    due: '',
    note: 'Sealed',
    at: '2026-11-10T08:00:00.000Z',
  },
};

export function recordedBoard(): ActionCenterBoardReply {
  const settings = ENGINE_DATA.settings ?? { excludedMachineIds: [], problemFixes: {} };
  const data = { ...ENGINE_DATA, settings: { ...settings, nudgeAcks: ACKS } };
  const board = actionCenterBoard({ data, asOf: AS_OF, profile: DEFAULT_PROFILE });
  return JSON.parse(JSON.stringify(board)) as ActionCenterBoardReply;
}

/** The invented people a plant lists (no real names): the two that own the stored acknowledgements, and one more. */
export const PEOPLE = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Asha', active: true },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Ravi', active: true },
  { id: '33333333-3333-4333-8333-333333333333', name: 'Hari', active: false },
];

const hex = (n: number, width: number): string => n.toString(16).padStart(width, '0');
/** A machine's database id as a real server sends it: a UUID that is nothing like its code. */
export const uuidFor = (n: number): string => `${hex(n + 1, 8)}-9c1e-4b7a-a3d2-${hex(n + 1, 12)}`;

/**
 * The same board as a real plant sends it: every machine's id (and each report's) is a UUID, in the nudge's key, its
 * title, the machines it names and the risk rows. The fixture's own ids equal the codes, which hides every screen that
 * prints an id; this does what the server does. Returns the board and the plant's machine list, id beside code.
 */
export function rekeyed(board: ActionCenterBoardReply) {
  const codes = [
    ...new Set([...board.nudges.flatMap((n) => n.machines), ...board.risk.map((r) => r.machine)]),
  ];
  const machines = codes.map((code, at) => ({ id: uuidFor(at), code, category: null }));
  let text = JSON.stringify(board);
  for (const { id, code } of [...machines].sort((a, b) => b.code.length - a.code.length))
    text = text.replace(
      new RegExp(`(?<![A-Za-z0-9-])${code.replace(/[-.]/g, '\\$&')}(?![A-Za-z0-9-])`, 'g'),
      id,
    );
  let report = 0;
  text = text.replace(/bd_[a-z0-9_]+/g, () => uuidFor(1000 + report++));
  return { board: JSON.parse(text) as ActionCenterBoardReply, machines };
}
