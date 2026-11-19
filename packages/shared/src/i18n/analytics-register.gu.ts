import { gujarati } from './blank.js';
import { analyticsRegisterEn } from './analytics-register.en.js';

export const analyticsRegisterGu = gujarati(analyticsRegisterEn, {
  'analytics.table.filter': 'આ કોષ્ટકમાં શોધો',
  'analytics.table.previous': 'પાછળ',
  'analytics.table.next': 'આગળ',
  'analytics.table.page': 'પાનું {{page}} / {{pages}}',
  'analytics.table.range': '{{total}} માંથી {{from}} થી {{to}}',
  'analytics.table.empty': 'બતાવવા માટે કોઈ હરોળ નથી.',
  'analytics.log.ticketColumn': 'ટિકિટ',
  'analytics.log.caption': 'બ્રેકડાઉન લૉગનું કોષ્ટક',
  'analytics.machine.trail': 'તમે ક્યાં છો',
});
