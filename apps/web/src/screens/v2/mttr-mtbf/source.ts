import i18n from 'i18next';
import key from '../../../../../../fixtures/answer-key/a3-mttr-mtbf.json' with { type: 'json' };
import { keyReply } from '../printed-page/key-reply.js';
import { mttrMtbfModel } from './adapter.js';

/** The gallery's version of this screen: the engine's frozen answer for the 11 November plant, through the live adapter. */
export const mttrMtbfModelFromKey = () =>
  Promise.resolve(mttrMtbfModel(keyReply('a3-mttr-mtbf', 40, key), i18n.t.bind(i18n)));
