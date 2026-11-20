import i18n from 'i18next';
import type { FiguresPart } from '../printed-page/printed.js';
import { bdPmModel } from './adapter.js';

/** The page from the engine's reply, in the reader's language; null while the engine has not computed it. */
export const bdPmFromReply = (reply: FiguresPart) => bdPmModel(reply, i18n.t.bind(i18n));
