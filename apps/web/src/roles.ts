/**
 * Who may work at the desk (DOMAIN §3, B4): the technician and above. The floor is everyone's;
 * the desk screen itself still checks each view with `mayOpen` (Mine is not for the plant head).
 */
export const DESK_ROLES = ['technician', 'supervisor', 'head', 'plant_head', 'admin'] as const;

/** The one rule for "may this role open the desk?": the account sheet's Desk entry and the landing agree. */
export function mayOpenDesk(role: string): boolean {
  return (DESK_ROLES as readonly string[]).includes(role);
}

/** Where a sign-in lands: the desk for a role that may open it, the floor for everyone else (operator, board). */
export function landingPath(role: string): '/desk' | '/floor' {
  return mayOpenDesk(role) ? '/desk' : '/floor';
}
