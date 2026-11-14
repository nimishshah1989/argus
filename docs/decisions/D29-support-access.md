# D29 — Support access: the customer's admin approves it, every call is written down, writes are few

Date: 14 November 2026 · Status: proposed (builder, ticket 35 goal 3; waits for two adversarial reviews)

## Decision

1. **Approving a grant is creating it.** The plant's admin, on a personal login, creates the grant for one named member of our staff, with a reason, for 1 to 7 whole days. `granted_by` is the admin's username and `approved_by_login_id` the admin's login. A grant cannot exist without an approver (migration 0009's check and trigger), so there is no "requested, not yet approved" state to build or to get wrong.
2. **Seven days at most, and never longer than first given.** The route takes 1 to 7 days. The database sets the start to its own clock, refuses more than 7 days, and refuses any later expiry (0009).
3. **Ending a grant shortens it to now.** Nothing is deleted. Run out, ended by the admin, and never approved all read as `ended`, and none of them lets anyone in.
4. **Who is calling is a key; whether they may is the grant.** A support call carries `Authorization: Bearer <key>` and `X-Support-Grant: <grant id>`. The server holds `SUPPORT_KEYS`, a list of `name:sha256-hex`: only the hash of each person's key, never the key. Without the header a key is an unknown session token (401). With it:
   - unknown key, a key shorter than 43 characters, a header that is not an id, a host that names no customer: **401**, the same answer as an ended sign-in, and the database is not asked about grants;
   - a real key, but the grant is not this customer's, not this person's, not approved, run out or ended: **403**. A grant of customer A used on customer B's address is simply not found there.
5. **Every call is written to the customer's audit trail before it runs.** One line per call: the grant, the method, the route as registered (`/api/v1/people/:id`, never the address or the query), the caller's address; no login. It is written in the transaction that read the grant. If it cannot be written the call fails with 500 and the route never runs. A refused call against a grant of this customer is written too (`support.refused`); that write is best effort and the refusal stands either way.
6. **Reads, and writes to the plant's own configuration. Nothing else.** Under a grant every `GET` and `HEAD` is allowed with the admin's permissions. A write is allowed only if its route is on one short list (`SUPPORT_WRITES` in `identity/support-auth.ts`): settings, lists, translations, glossary, SLA policies, machines, segments, groups, shifts and the company logo. Every other write answers 403, including a route added later, which stays closed until someone lists it. So under a grant nobody raises, works, closes, cancels, restores or corrects a ticket, records a past breakdown, or changes a person or a login. `PUT /machines/:id/criticality` is deliberately not on the list: it re-arms the clocks of open tickets, which is ticket history. Two settings are refused inside `PUT /settings/:key`: `ai.monthlyCapUsd`, and any change to `features.enforcePasswordChange` (the rest of `features` stays writable), because both are the customer's own decisions and the second could lock the plant's logins out.
7. **Our staff cannot manage their own access.** The four support-access routes refuse a support caller, reads included (`refuseSupport` in the identity service; the device list uses it too, since under a grant the login is the approving admin's).
8. **A settings change made under a grant is audited to the grant.** The ordinary audit line of the change (`setting.update` and the like) names the grant and no login, so the trail never says the approving admin made a change that our staff made.

## Keys

A key is 32 random bytes; only its SHA-256 goes into `SUPPORT_KEYS`. SHA-256 without salt or stretching is right only because the key is random: a key anyone chose would need a password hash, so a short key is refused unread.

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"   # the key: give it to that one person, store it nowhere
printf %s "<key>" | sha256sum                                                     # the hash: SUPPORT_KEYS=name:<hash>,name2:<hash2>
```

`SUPPORT_KEYS` is a secret of the server (Secrets Manager, D19), never committed and never logged. The server compares in constant time against every configured hash, limits wrong keys from one address like wrong passwords (about 20 in 5 minutes, then 429; a right key is not counted), and does not log the `Authorization` or `X-Support-Grant` headers. A support call's log lines carry the grant id and not the approving admin's login id. A value that cannot be read stops the server at start-up. Unset or empty means nobody has support access. Taking a name out, and restarting, ends that person's access to every customer at once.

## Why

- The customer decides. No path lets our staff into a plant without that plant's admin acting first, and the admin can see each call and end the access at any moment.
- A read of people's data is what a customer most wants to see, so reads are written down, not only writes.
- No schema change: 0009 already holds the rules that must not depend on the server (the 7 days, the approver, the grant on the audit line).

## Rejected

- **A "requested" state the admin then approves.** It needs a grant without an approver, which the schema forbids on purpose, or a new column or table. Deferred: our staff ask the admin outside the product, and the admin's act is the record.
- **A table of platform users.** One more table (D17) and a second sign-in to build, for a handful of people. Revisit when staff need to rotate their own keys or when there are more than a few.
- **Admin-equivalent writes everywhere** (the first design). A row needs a login, and the only truthful one a grant has is the approver's, so tickets and people changed by our staff would have looked like the admin's work. It would also have let our staff reset an admin's password and approve their own next grant.
- **Writing down only writes.** Hides the reads.
- **A second guard beside the session guard.** One guard, one place where a call is let in; the callback it already takes was widened instead.
- **Putting keys in the database, or stretching them with Argon2 on every call.** The first needs a table; the second costs a password check per request and buys nothing for a random key.

## Open limits

- **`/auth/me` under a grant answers `user.id` = the approving admin's login id**, with `user.supportGrantId` set (only then), so a client that asks "is this me" must look at the grant too. The id is kept so the reply contract does not change type.
- **`loginId` under a grant is the approving admin's.** Code that asks "who is this" by login sees the admin. Nothing under a grant can now write history with it (point 6), and audit lines name the grant instead (points 5 and 8), but a new write route added to the list must pass the grant to its audit line in the same way.
- **Some settings stay writable.** Under a grant our staff can still change the severity matrix, the company name, language and time zone, and the other `features` switches. Each change is on the trail with the grant. (`ai.consent` has no write path at all, D22; there is no support-access setting.)
- **Plain list and translation edits have no line of their own** (`PUT`/`DELETE /lists/…`, `PUT /translations/:id` never wrote one, for the admin either). Under a grant the call line (point 5) is their only record: it says which route, not which value.
- **The approver is checked on every call.** A grant counts as live only while the admin who approved it is still an active admin: switching that admin off or changing their role stops the grant at once, and it reads as `ended`.
- **A call already running when the grant is ended finishes.** The next call is refused.
- **The name in a grant is not checked against `SUPPORT_KEYS`.** A misspelt name makes a grant nobody can use; the admin ends it and approves another.
- **The wrong-key limit is in memory, per process, per address** (D18), and its 429 carries no `Retry-After`. Only a key that matches no one is counted, so guessing from a shared address never holds back the person with the right key.
- **No cap on refused calls per grant.** A staff member holding a real key can fill a customer's trail with refused calls under a grant. Accepted: it needs a real key and a real grant, and the trail still shows it.
- **Grants are listed whole**, newest first, without pages. A plant has a handful.
