# D30 — An erased person stays erased: two keyed hashes on the person row

Date: 14 November 2026. Ruled by Nimish (14 Nov, "erased stays erased"); the second, name-only hash was ruled by the
backend orchestrator the same day.

**Decision.** When a person is erased (`erase_person`, DATA-MAP section 5) the person row stays, as it does today,
and keeps two values, each an HMAC-SHA256 (hex) under the server's key, over the plant and the normalised name:

- `person.erasure_hash`: name and mobile number together.
- `person.erasure_name_hash`: the name alone.

The key is `ERASURE_HASH_KEY` (32 characters or more), read from the server's environment (Secrets Manager in
production). It is never in code, tests build their own, and it never reaches the database. The plant's id is part of
the input, so the same name erased in two plants leaves two different values. The two hashes carry different labels
and can never be equal.

**What each does.**

- A creation or edit that gives a person a number, and whose name and number match an erased person's, is refused:
  409 with code `conflict` on field `name`. The message holds no personal data. This covers the people API (create and
  edit, on the values the person would have after the edit, not counting their own row) and onboarding when the person
  has a number. A person with no number (`ensurePendingPerson`, which only ever has a name) can never be hard-refused;
  it is created and, on a name-only match, flagged like an import row.
- A name with no number, which is all an import ever carries, only _might_ be an erased person (two colleagues can
  share a name). It is never blocked: an import still imports and lists `possible_erased_match` with the row number
  only, plus a count `possiblyErasedMatches`; the people API records `possibleErasedMatch: true` in the audit row of the
  creation. A person at the plant decides; that screen is not built yet.
- An erased row is "Former staff" for good: a change to its name or number is refused (409, "An erased person's name
  and phone cannot be changed"). A form that saves another field and sends the name back unchanged is accepted.

**Normalisation:** Unicode NFKC, lower case, trimmed, runs of white space collapsed; a number keeps only its digits
(the API enforces E.164 before it gets here).

**No key, no erasure.** `erase_person` takes both hashes as arguments and refuses a missing or malformed one; the
erase script refuses to start without the key and changes nothing. If the key is missing later while erased people
exist in a plant, creating a person there is refused (503) rather than allowed.

**The hashes are never returned:** not in a reply, a log line, an audit payload or an import report.

**Why columns and not a table.** D17 allows a new table only when no existing one can hold the fact. The erased
person's row already exists, is tenant-scoped, and is where the lookup starts.

**Rejected.**

- Plain SHA-256 of the name and number: a phone number is about ten digits, so the pair is brute-forced from the hash
  in minutes. A key makes the hash useless without the server's secret.
- The key as a database setting or a default in code: a default makes every deployment's hashes comparable.
- A hard refusal on the name alone: it would turn away a different person who shares a name.
- Backfilling people erased before this change: their name and number are gone, so no hash can be made.

**Operations rule.** Set the key once and never change or lose it. A lost or changed key silently re-opens every erased
person, and nothing notices. Keeping a fingerprint of the key to catch a typo at start-up is a known follow-up, not
built here. Keep the key with the other secrets in the backup of secrets (RESTORE.md).

**Known limits.** Erased people are matched only by exact normalised name (and number); a different spelling is a
different person. A number written without its country code is a different number. People erased before this change
have no hash and cannot be protected, and their rows can still be renamed. A creation racing a concurrent erasure of
the same person can slip through (the check and the erasure do not lock each other).
