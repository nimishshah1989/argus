import type { Theme } from './direction-props.js';

/** fill = a line, bar or 3 px edge (3:1 on the card); ink = text (4.5:1 on the card and on its tint); tint = a soft band. */
export interface FamilyColour {
  fill: string;
  ink: string;
  tint: string;
}

/**
 * The two identity hues that have no tone of their own (ticket 80u). Downtime is terracotta, apart from the amber
 * "watch" tone and the red "bad" tone; availability is a lime-leaning green, apart from the teal-leaning "good" tone.
 * Identity says what a figure is and never signals a verdict, so a family hue never equals a verdict hue.
 * `ui/tokens.css` holds the same values (a test keeps the two in step); repairs and planned reuse the info and accent tones.
 */
export const FAMILY_COLOURS: Record<Theme, { availability: FamilyColour; downtime: FamilyColour }> =
  {
    light: {
      availability: { fill: '#5a8f12', ink: '#3f6b0c', tint: '#eef5e1' },
      downtime: { fill: '#c2552b', ink: '#9a3a18', tint: '#fbece6' },
    },
    dark: {
      availability: { fill: '#8ccf3a', ink: '#a6dc62', tint: '#1e2a0f' },
      downtime: { fill: '#e8825a', ink: '#f4a583', tint: '#3a1d14' },
    },
  };

/** The `--color-family-*` custom properties of both families in one theme. */
export function familyProps(theme: Theme): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, c] of Object.entries(FAMILY_COLOURS[theme])) {
    out[`--color-family-${name}`] = c.fill;
    out[`--color-family-${name}-ink`] = c.ink;
    out[`--color-family-${name}-tint`] = c.tint;
  }
  return out;
}
