import i18n from 'i18next';
import key from '../../../../../../fixtures/answer-key/a10-problems.json' with { type: 'json' };
import { keyReply } from '../printed-page/key-reply.js';
import { problemAnalysisModel } from './adapter.js';

/** The gallery's Problem Analysis: the engine's frozen answer for the 11 November plant, through the live adapter. */
export const problemAnalysisFromKey = () =>
  Promise.resolve(problemAnalysisModel(keyReply('a10-problems', 41, key), i18n.t.bind(i18n)));
