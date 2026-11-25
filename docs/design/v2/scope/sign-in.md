# Coverage: Sign in (`screens/v2/sign-in`), S19, ticket #761

Written 25-Nov-2026 by Plan from the approved wireframe `design/wireframes/S19-login.html` and the v1 inventory in ADR 0044
(`faces/signin/sign-in.tsx`, `faces/signin/parts.tsx`, `last-username.ts`, `roles.ts`). `/who` and `/password` are not in
the wireframe and stay v1, untouched (ADR 0044 decision 1).

**MISSING (needs Nimish's written yes): none.** Every v1 item below is kept.

| Item                                                                            | Source                          | v2   | Where in v2                                                |
| ------------------------------------------------------------------------------- | ------------------------------- | ---- | ---------------------------------------------------------- |
| Company brand (name, logo) above the form                                       | `getBrand`                      | same | form header, as drawn                                      |
| "Username" field, last username filled in                                       | `last-username.ts`              | same | first field; label text kept (58 e2e specs use it)         |
| "Password" field, never trimmed                                                 | `sign-in.tsx`                   | same | second field                                               |
| "Show password"                                                                 | `parts.tsx` `Fields`            | same | toggle under the password, as drawn                        |
| "Sign in" button, pressable once a username is typed                            | `sign-in.tsx`                   | same | primary button; `readyToSignIn` in `model.ts`              |
| The 30-day hint (stay signed in for 30 days)                                    | `sign-in.tsx`                   | same | line under the button, as drawn                            |
| Errors: unreachable, too many tries, unknown company, server problem, wrong ID  | `parts.tsx` `signInError`       | same | inline kit banner over the form; `signInError` moved whole |
| "You have been signed out" banner (`?signedOut`)                                | `parts.tsx` `SIGNED_OUT_PARAM`  | same | kit banner over the form                                   |
| Where sign-in goes: shared login with nobody acting → `/who`; else role landing | `sign-in.tsx`, `roles.ts:21-34` | same | `nextPath` in `model.ts`, same URLs                        |
| Temporary password must change first                                            | data layer → `/password`        | same | `nextPath` returns null; v1 `/password` page unchanged     |
| Offline / server down while signing in                                          | `signin.unreachable`            | same | the unreachable message                                    |
| Gujarati                                                                        | i18n keys                       | same | same keys                                                  |

## Notes: open questions for Nimish

- The S19 wireframe records no questions. Nothing waits on him for this screen.
