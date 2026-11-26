import type { LoginAdmin, PersonAdmin } from '@uptimo/shared/people';

export const person = (id: string, phone: string | null, active = true): PersonAdmin => ({
  id,
  name: id,
  shortName: null,
  phone,
  team: 'maintenance',
  title: null,
  cell: null,
  defaultShift: null,
  active,
  pending: false,
  lastSignInAt: null,
});

export const login = (id: string, shared: boolean, active = true): LoginAdmin => ({
  id,
  username: id,
  role: shared ? 'operator' : 'technician',
  shared,
  personId: shared ? null : `p-${id}`,
  cell: null,
  mustChangePassword: false,
  active,
  lastSignInAt: null,
});
