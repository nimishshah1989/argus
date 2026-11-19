import { addStrings } from './strings.js';

/** An invented plant for the floor step: two segments, four groups. Nothing here is a real machine or person. */
export interface SampleGroup {
  code: string;
  machines: number;
}

export const SEGMENTS: { id: string; groups: SampleGroup[] }[] = [
  {
    id: 'cnc',
    groups: [
      { code: 'VC', machines: 52 },
      { code: 'TC', machines: 38 },
    ],
  },
  {
    id: 'utility',
    groups: [
      { code: 'STB', machines: 10 },
      { code: 'AD', machines: 8 },
    ],
  },
];

/** The machines this phone reported most recently, as the floor's "Your recent" row shows them. */
export const RECENT = ['VC-17', 'TC-04', 'AT-02'];

export const groupKey = (code: string): string => `floor.group.${code.toLowerCase()}`;

/** The step's own words are the app's (real Gujarati from the string files); these are the preview's and the invented plant's. */
addStrings(
  {
    'floor.caption': 'The real floor step still shows Running in green until ticket 82',
    'floor.segment.cnc': 'CNC',
    'floor.segment.utility': 'Utility',
    'floor.group.vc': 'Vertical Machining Center',
    'floor.group.tc': 'Turning Center',
    'floor.group.stb': 'Stabilizer',
    'floor.group.ad': 'Air Dryer',
  },
  {
    'floor.caption': 'અસલી ફ્લોરના પગલામાં ટિકિટ 82 સુધી “ચાલુ” લીલા રંગમાં જ દેખાય છે',
    'floor.segment.cnc': 'CNC',
    'floor.segment.utility': 'યુટિલિટી',
    'floor.group.vc': 'વર્ટિકલ મશીનિંગ સેન્ટર',
    'floor.group.tc': 'ટર્નિંગ સેન્ટર',
    'floor.group.stb': 'સ્ટેબિલાઇઝર',
    'floor.group.ad': 'એર ડ્રાયર',
  },
);
