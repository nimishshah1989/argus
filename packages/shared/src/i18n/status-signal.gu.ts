import { gujarati } from './blank.js';
import { statusSignalEn } from './status-signal.en.js';

export const statusSignalGu = gujarati(statusSignalEn, {
  'status.severity.s1': 'S1',
  'status.severity.s2': 'S2',
  'status.severity.s3': 'S3',
  'status.severity.s4': 'S4',
  'status.clock.ok': 'સમયસર',
  'status.clock.dueSoon': 'સમય નજીક',
  'status.clock.overdue': 'મોડું',
  'status.clock.paused': 'થોભાવેલું',
  'status.clock.stopped': 'અટક્યું',
  'status.forecast.hot': 'જોખમ',
  'status.forecast.watch': 'ધ્યાન રાખો',
  'status.forecast.normal': 'સામાન્ય',
});
