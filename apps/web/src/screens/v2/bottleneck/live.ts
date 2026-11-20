import i18n from 'i18next';
import type { FiguresPart } from '../printed-page/printed.js';
import { bottleneckModel, type CodeOf } from './adapter.js';

/** Bottleneck from the engine's reply and the plant's machine codes, in the reader's language; null while the engine has not computed it. */
export const bottleneckFromReply = (reply: FiguresPart, codeOf: CodeOf) =>
  bottleneckModel(reply, i18n.t.bind(i18n), codeOf);
