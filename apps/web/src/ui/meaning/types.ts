import type { MessageKey } from '@uptimo/shared/i18n';
import type { IconComponent } from '../icon.js';

/** The four tones of the design language (DESIGN.md tone grammar, tokens.css): green, amber, red, grey. */
export type Tone4 = 'good' | 'watch' | 'bad' | 'neutral';

/** Which way a figure moves when things get better; `neither` when no direction is clearly good. */
export type Direction = 'up' | 'down' | 'neither';

export type Unit =
  | 'count'
  | 'hours'
  | 'percent'
  | 'money'
  | 'perDay'
  | 'hoursPerDay'
  | 'hoursPerMachine'
  | 'years'
  | 'score'
  | 'none';

/** What a status or severity looks like: a tone, an icon and a word (colour never works alone). */
export type Meaning = { tone: Tone4; icon: IconComponent } & (
  | { key: MessageKey } // a catalogue key: print it with t()
  | { word: string } // plain English, from strings.ts
);

export interface Measure {
  unit: Unit;
  better: Direction;
}

/** A figure: its unit and good direction, and one entry per measure when a key carries several (MTTR and MTBF). */
export interface FigureMeaning extends Measure {
  parts?: Record<string, Measure>;
}
