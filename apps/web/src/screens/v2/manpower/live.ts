import i18n from 'i18next';
import type { FiguresPart } from '../printed-page/printed.js';
import { manpowerModel } from './adapter.js';

/** Manpower from the engine's reply, in the reader's language; null while the engine has not computed it. */
export const manpowerFromReply = (reply: FiguresPart) => manpowerModel(reply, i18n.t.bind(i18n));
