# D30 — An erased person stays erased: a keyed hash on the person row

Date: 14 November 2026. Ruled by Nimish (14 Nov, "erased stays erased").

**Decision.** When a person is erased (`erase_person`, DATA-MAP section 5) the person row stays, as it does today,
and also keeps one value: `person.erasure_hash`, an HMAC-SHA256 (hex) of the normalised name and mobile number.
The key is `ERASURE_HASH_KEY`, read from the server's environment (Secrets Manager in production). It is never in
code, tests use their own, and it never reaches the database. Creating a person (people API, onboarding, import)
whose normalised name and number hash to an erased person's value is refused with 409 `erased_person`; an import
counts and reports the row as skipped, with its row number and no name.

- **Normalisation:** Unicode NFKC, lower case, trimmed, runs of white space collapsed; a number keeps only its digits.
- **No key, no erasure.** `erase_person` takes the hash as an argument and refuses a missing or malformed one; the
  erase script refuses to start without the key. If the key is missing later while erased people exist, creating a
  person is refused (503) rather than allowed.
- **The hash is never returned:** not in a reply, a log line or an audit payload.

**Why a column and not a table.** D17 allows a new table only when no existing one can hold the fact. The erased
person's row already exists, is already tenant-scoped, and is where the lookup starts. A table would hold one row per
erased person and nothing else.

**Rejected.**

- Plain SHA-256 of the name and number: a guessable pair (a phone number has about ten digits) is brute-forced from
  the hash in minutes. A key makes the hash useless without the server's secret.
- The key as a database setting or a default in code: a default silently makes every deployment's hashes comparable
  and guessable.
- Backfilling people erased before this change: their name and number are gone, so no hash can be made.

**Known limit.** A name-only match is not made. An import carries names but no numbers, so a person erased with a
number is not recognised by an import of their name alone. Ruled as asked (name and number); a name-only second hash
for imports, with a person at the plant deciding each match, is the proposed next step.

**Cost if the key is lost or changed.** Every erased person becomes creatable again, silently. The key is part of the
backup of secrets (RESTORE.md) and is never rotated without re-hashing, which needs the erased names that no longer
exist, so it is never rotated.
