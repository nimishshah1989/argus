import i18n from 'i18next';
import type { FiguresPart } from '../printed-page/printed.js';
import { fixFinderModel } from './adapter.js';

/** The Fix Finder from the engine's reply, in the reader's language; null while the engine has not computed it. */
export const fixFinderFromReply = (reply: FiguresPart) => fixFinderModel(reply, i18n.t.bind(i18n));
