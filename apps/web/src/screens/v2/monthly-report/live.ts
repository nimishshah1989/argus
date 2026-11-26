import i18n from 'i18next';
import type { FiguresPart } from '../printed-page/printed.js';
import { monthlyReportModel } from './adapter.js';

/** The Monthly Report from the engine's reply, in the reader's language; null while the engine has not computed it. */
export const monthlyReportFromReply = (reply: FiguresPart) =>
  monthlyReportModel(reply, i18n.t.bind(i18n));
