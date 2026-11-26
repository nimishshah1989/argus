/**
 * Reading `ui/tokens.css` and measuring contrast, for the token tests (WCAG 2 relative luminance and ratio).
 */
export type Tokens = Record<string, string>;

function declarations(block: string): Tokens {
  const out: Tokens = {};
  for (const m of block.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim();
  return out;
}

/** The light tokens are the `@theme` block and the plain `:root` block; dark is `:root[data-theme='dark']` over them. */
export function readTokens(css: string): { light: Tokens; dark: Tokens } {
  const light = {
    ...declarations(/@theme(?:\s+static)?\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? ''),
    ...declarations(/\n:root\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? ''),
  };
  const dark = declarations(/:root\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '');
  return { light, dark: { ...light, ...dark } };
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** A token's real colour: follows `var(--…)` aliases (a few hops at most) and fails loudly on anything not hex. */
export function resolve(tokens: Tokens, name: string): string {
  let value = tokens[name];
  for (let hops = 0; value?.startsWith('var(--') && hops < 4; hops++)
    value = tokens[value.slice(6, -1)];
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${name} is not a hex colour`);
  return value;
}
