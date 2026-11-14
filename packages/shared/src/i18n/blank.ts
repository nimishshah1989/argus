/** The same keys with every value empty: a new namespace's Gujarati until it is translated (empty falls back to English). */
export function blank<T extends object>(source: T): { [K in keyof T]: string } {
  return Object.fromEntries(Object.keys(source).map((key) => [key, ''])) as {
    [K in keyof T]: string;
  };
}

/**
 * A namespace's Gujarati: every English key, translated where `strings` has it. A key added to the English later
 * stays empty (English shows) until the next sweep; a misspelt key is a type error.
 */
export function gujarati<T extends object>(
  source: T,
  strings: NoInfer<{ [K in keyof T]?: string }>,
): { [K in keyof T]: string } {
  return { ...blank(source), ...strings } as { [K in keyof T]: string };
}
