import i18n from 'i18next';
import type { FiguresPart } from '../printed-page/printed.js';
import { energyModel } from './adapter.js';

/** Energy from the engine's reply, in the reader's language; null while the engine has not computed it. */
export const energyFromReply = (reply: FiguresPart) => energyModel(reply, i18n.t.bind(i18n));
