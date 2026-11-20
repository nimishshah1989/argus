import i18n from 'i18next';
import key from '../../../../../../fixtures/answer-key/fix-finder.json' with { type: 'json' };
import { keyReply } from '../printed-page/key-reply.js';
import { fixFinderModel } from './adapter.js';

/** The gallery's Fix Finder: the engine's frozen answer for the 11 November plant, through the live adapter. */
export const fixFinderFromKey = () =>
  Promise.resolve(fixFinderModel(keyReply('fix-finder', 43, key), i18n.t.bind(i18n)));
