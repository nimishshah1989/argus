import i18n from 'i18next';
import type { FiguresPart } from '../printed-page/printed.js';
import { categoryCellModel } from './adapter.js';

/** The page from the engine's reply, in the reader's language; null while the engine has not computed it. */
export const categoryCellFromReply = (reply: FiguresPart) =>
  categoryCellModel(reply, i18n.t.bind(i18n));
