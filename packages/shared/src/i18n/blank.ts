/** The same keys with every value empty: the Gujarati placeholder (empty falls back to English). */
export function blank<T extends object>(source: T): { [K in keyof T]: string } {
  return Object.fromEntries(Object.keys(source).map((key) => [key, ''])) as {
    [K in keyof T]: string;
  };
}
