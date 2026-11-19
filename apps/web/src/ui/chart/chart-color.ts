/** Colour arithmetic the heatmap needs: it picks a readable label ink for each cell's fill. */
export type Rgb = [number, number, number];

/** `#rgb` or `#rrggbb` as numbers; anything else (a test's `#a1`, an `rgb()` string) is undefined. */
export function parseHex(hex: string): Rgb | undefined {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return undefined;
  const h = m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join('') : m[1]!;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance([r, g, b]: Rgb): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** The point `t` (0 to 1) of the way from `from` to `to`, channel by channel. */
export function mix(from: Rgb, to: Rgb, t: number): Rgb {
  return from.map((v, i) => Math.round(v + (to[i]! - v) * t)) as Rgb;
}

/** Black or white, whichever reads better on `fill` (always at least 4.58:1). */
export function inkOn(fill: Rgb): string {
  return contrast(fill, [0, 0, 0]) >= contrast(fill, [255, 255, 255]) ? '#000000' : '#ffffff';
}

/** Text safe to place in an ECharts HTML tooltip: tooltip formatter strings are rendered as HTML. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
