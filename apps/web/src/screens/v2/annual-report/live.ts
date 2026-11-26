import i18n from 'i18next';
import type { FiguresPart } from '../printed-page/printed.js';
import { annualReportModel } from './adapter.js';

/** The Annual Report from the engine's reply, in the reader's language; null while the engine has not computed it. */
export const annualReportFromReply = (reply: FiguresPart) =>
  annualReportModel(reply, i18n.t.bind(i18n));
