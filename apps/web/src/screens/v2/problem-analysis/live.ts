import i18n from 'i18next';
import type { FiguresPart } from '../printed-page/printed.js';
import { problemAnalysisModel } from './adapter.js';

/** Problem Analysis from the engine's reply, in the reader's language; null while the engine has not computed it. */
export const problemAnalysisFromReply = (reply: FiguresPart) =>
  problemAnalysisModel(reply, i18n.t.bind(i18n));
