import i18n from 'i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { getConfig, getMe } from '../../../api.js';
import { http } from '../../../data/index.js';
import type { Translate } from './read.js';

/** The catalogue as the adapters ask for it: one language, the reader's. */
export const catalogue: Translate = (key, values) => i18n.t(key, { ...values }) as string;

/** What the engine says today, as the v1 screens read it; a refusal or an offline phone rejects and the screen says so. */
export const liveReply = (): Promise<FiguresReply> =>
  http<FiguresReply>('/api/v1/analytics/figures');

/** The signed-in role, which gates money and the correction of a move. */
export const liveRole = async (): Promise<string | undefined> => (await getMe()).user.role;

/** A machine's code from its id, by the plant's own list. */
export async function liveCodes(): Promise<(machineId: string) => string | null> {
  const { machines } = await getConfig();
  return (machineId) => machines.find((machine) => machine.id === machineId)?.code ?? null;
}
