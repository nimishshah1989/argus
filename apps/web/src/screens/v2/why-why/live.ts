import i18n from 'i18next';
import type { FiguresPart } from '../printed-page/printed.js';
import { whyWhyModel } from './adapter.js';

/** Why-Why from the engine's reply, in the reader's language; null while the engine has not computed it. */
export const whyWhyFromReply = (reply: FiguresPart) => whyWhyModel(reply, i18n.t.bind(i18n));
