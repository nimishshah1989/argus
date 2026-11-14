const KEY = 'uptimo_last_username';

/** The username this phone signed in with last (v3.signin.01); empty when storage is blocked. */
export function lastUsername(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function rememberUsername(username: string): void {
  try {
    localStorage.setItem(KEY, username);
  } catch {
    // Private mode or full storage: the username is a convenience only.
  }
}
