import i18n from 'i18next';
import type { FiguresPart } from '../printed-page/printed.js';
import { forecastLabModel } from './adapter.js';

/** The Forecast Lab from the engine's reply, in the reader's language; null while the engine has not computed it. */
export const forecastLabFromReply = (reply: FiguresPart) =>
  forecastLabModel(reply, i18n.t.bind(i18n));
