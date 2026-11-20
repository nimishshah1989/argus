import i18n from 'i18next';
import key from '../../../../../../fixtures/answer-key/a4-manpower.json' with { type: 'json' };
import { keyReply } from '../printed-page/key-reply.js';
import { manpowerModel } from './adapter.js';

/** The gallery's version of this screen: the engine's frozen answer for the 11 November plant, through the live adapter. */
export const manpowerModelFromKey = () =>
  Promise.resolve(manpowerModel(keyReply('a4-manpower', 41, key), i18n.t.bind(i18n)));
