import i18n from 'i18next';
import type { FiguresPart } from '../printed-page/printed.js';
import { shiftKpisModel } from './adapter.js';

/** The Shift-calendar KPIs from the engine's reply, in the reader's language; null while the engine has computed none. */
export const shiftKpisFromReply = (reply: FiguresPart) => shiftKpisModel(reply, i18n.t.bind(i18n));
