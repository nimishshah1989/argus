import { canAnalytics, type Role } from '@uptimo/domain';

/**
 * Who may work at the desk (DOMAIN §3, B4): the technician and above. The floor is everyone's;
 * the desk screen itself still checks each view with `mayOpen` (Mine is not for the plant head).
 */
export const DESK_ROLES = ['technician', 'supervisor', 'head', 'plant_head', 'admin'] as const;

/** The one rule for "may this role open the desk?": the account sheet's Desk entry and the landing agree. */
export function mayOpenDesk(role: string): boolean {
  return (DESK_ROLES as readonly string[]).includes(role);
}

/**
 * Where a role's home is (MILESTONES row 38): each home opens on what needs that person now. The operator
 * opens My complaints, the technician Mine, the maintenance head and plant head the analytics Today
 * dashboard; the supervisor and admin open the desk's Open list, and the board login the floor.
 */
export type LandingPath = '/analytics/today' | '/desk' | '/desk/mine' | '/floor' | '/floor/mine';

const HOME: Readonly<Record<string, LandingPath>> = {
  operator: '/floor/mine',
  technician: '/desk/mine',
  supervisor: '/desk',
  head: '/analytics/today',
  plant_head: '/analytics/today',
  admin: '/desk',
  board: '/floor',
};

/** Where a sign-in lands. Every known role is named; an unknown role keeps the old fallback. */
export function landingPath(role: string): LandingPath {
  return HOME[role] ?? (mayOpenDesk(role) ? '/desk' : '/floor');
}

/** The server's own check (`canAnalytics`) on the role the browser knows: the desk menu and the analytics shell share it. */
export const readsAnalytics = (role: string): boolean =>
  canAnalytics({ role: role as Role, loginId: '', personId: null, shared: false, cell: null });
