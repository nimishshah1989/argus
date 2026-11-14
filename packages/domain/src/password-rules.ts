import { COMMON_PASSWORDS } from './common-passwords.js';

export { COMMON_PASSWORDS };

export const MIN_PASSWORD_LENGTH = 8;

export type PasswordProblem = 'too_short' | 'common' | 'same_as_username';

/** Letters and digits only, lower case: `Admin@123` and `admin123` are the same password to a guesser. */
const stripped = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]/g, '');

/** The usual look-alikes undone first (`P@ssw0rd`), then stripped. */
const unleeted = (text: string): string =>
  stripped(text.toLowerCase().replace(/@/g, 'a').replace(/\$/g, 's').replace(/0/g, 'o'));

const common: ReadonlySet<string> = new Set(
  COMMON_PASSWORDS.flatMap((p) => [stripped(p), unleeted(p)]),
);

/** Why a password may not be used, or null. Case, spaces and punctuation never rescue a weak one. */
export function passwordProblem(password: string, username: string): PasswordProblem | null {
  const typed = password.trim();
  if (typed.length < MIN_PASSWORD_LENGTH) return 'too_short';
  const user = username.trim();
  if (typed.toLowerCase() === user.toLowerCase() || stripped(typed) === stripped(user))
    return 'same_as_username';
  return common.has(stripped(typed)) || common.has(unleeted(typed)) ? 'common' : null;
}
