import { COMMON_PASSWORDS } from './common-passwords.js';

export { COMMON_PASSWORDS };

export const MIN_PASSWORD_LENGTH = 8;

export type PasswordProblem = 'too_short' | 'common' | 'same_as_username';

const common: ReadonlySet<string> = new Set(COMMON_PASSWORDS);

/** Why a password may not be used, or null. Letter case never rescues a weak one. */
export function passwordProblem(password: string, username: string): PasswordProblem | null {
  if (password.length < MIN_PASSWORD_LENGTH) return 'too_short';
  // Spaces around a weak password do not make it strong.
  const lower = password.trim().toLowerCase();
  if (lower === username.trim().toLowerCase()) return 'same_as_username';
  return common.has(lower) ? 'common' : null;
}
