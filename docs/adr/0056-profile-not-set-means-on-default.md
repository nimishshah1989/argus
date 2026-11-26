# ADR 0056: An analytics profile number is "not set" when it still equals the shipped default

Date: 26 Nov 2026 · Decided by: planner (unattended, post-merge review of #843; Nimish can overturn)

## Context

The S26 Analytics profile screen (ticket 793, PR #843) leads with "n of 34 numbers not set", a progress bar and a Set / Not set tag. It counted a number as not set when the reply held `null`. The reply never holds `null`:

- the first read stores the whole `DEFAULT_PROFILE` in the plant's `setting` row (`ensureSettingRow`), and any number missing later is filled from it (`settingRowStore`);
- `profileReplySchema` is strict and non-nullable;
- the route is head/admin only and returns every key, money numbers included.

So every plant saw "0 of 34 not set", a full bar and a green tag.

Options:

1. **Not set = still equal to `DEFAULT_PROFILE`.** Web only, no contract change. A plant that types the default back in counts as on the default.
2. Server reports which keys the plant stored. Doesn't work: the first read stores every key, so all 34 are always "stored". It would need a data change to unstore the defaults, plus a reply-contract change.
3. Read the audit trail (`analytics_profile.update`) for which fields were ever edited. Exact, but it adds a query and a contract for a hint line.

## Decision

Option 1. `profileTakeaway` counts the `PROFILE_KEYS` whose value `=== DEFAULT_PROFILE[key]`, out of all 34 (`PROFILE_KEYS.length`). The copy changes to match: "n of 34 numbers still on the default", "n of 34 numbers set by the plant", tags "Defaults in use" / "All set". No reply contract, schema or server change.

## Consequences

- A fresh plant now sees 34 of 34 on the default, the risk tag and an empty bar, which is the truth.
- A value set equal to its default reads "on the default". That's acceptable: the plant is running on the shipped number either way. If Nimish wants "edited ever", switch to option 3.
- Follow-up ticket #846 builds it.
