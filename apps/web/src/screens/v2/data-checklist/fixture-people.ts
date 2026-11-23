/** The invented people the gallery's drawers know (screens/v2/entity/fixture.ts), by the id a chip carries. */
export const PEOPLE = { 'arjun-v': 'Arjun V', 'meera-k': 'Meera K', 'neel-s': 'Neel S' } as const;
export type PersonId = keyof typeof PEOPLE;
