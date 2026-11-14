# Design slices 5 to 9 (approved 14 Nov 2026)

Mockup frames for three slices, drawn by the design agent and approved by Nimish on 14 Nov 2026. Each file is one
self-contained HTML page: open it in a browser, no server, no install. Every frame sits in its own `<iframe srcdoc>`
so the CSS of one frame cannot touch another. The look comes from `docs/design/LOCK.md` (tokens, status inks, six type
sizes on the phone). Desktop frames are fluid at 1440 px and were also checked at 1280. People, logins and phone numbers
are coded (roles only); times and a few numbers are samples and say so on the frame. The slice 1 to 4 canvases stay in
`docs/design/LOCK.md` as links.

| File                                                       | Tickets                 | Frames |
| ---------------------------------------------------------- | ----------------------- | ------ |
| [slice-5-account-alerts.html](slice-5-account-alerts.html) | account sheet, Alerts   | 11     |
| [slice-6-signoff.html](slice-6-signoff.html)               | 34 production sign-off  | 20     |
| [slice-7-lockout.html](slice-7-lockout.html)               | 66 lockout before Start | 16     |

## Slice 5: account sheet and Alerts

- Account sheet · personal login · Alerts on
- Account sheet · shared phone · Change person · Alerts off
- Account sheet · support access note
- Who is acting?
- Sign out
- Alerts · off
- Alerts · blocked by the browser
- Alerts · not available
- Account sheet · desktop panel · light
- Account sheet · desktop panel · dark

States: account sheet for a personal login, a shared phone (Change person) and a support-access session; the "Who is
acting?" list; sign-out confirmation; Alerts Off, On, Blocked by the browser, Not available.

Choices (recommendation taken for every one):

1. The account sheet opens from a person button at the right of the top bar on floor and desk; on desktop the name at the foot of the left menu opens a side panel.
2. Language belongs to the login; a shared phone keeps one language for the phone.
3. The support access note is shown only to the support person signed in under the grant; plant users see the grant in the audit trail. (Assumes `supportGrantId` is on our own staff's session. Change password is hidden there.)
4. Blocked alerts: say where to allow them and add a "Check again" button (new).

## Slice 6: production sign-off (ticket 34)

- My complaints · Is it fixed?
- Dispute · the reason
- Dispute refused · new open breakdown
- Confirmed
- Disputed and reopened
- Not answered
- Scanned from the board
- Scanned from another cell
- Live board in a browser · light
- Live board in a browser · dark
- Live board on the TV · dark
- Waiting for production's OK · light
- Confirmed · light
- Disputed and reopened · light
- Not answered · light
- Waiting for production's OK · dark
- Confirmed · dark
- Disputed and reopened · dark
- Not answered · dark

States: My complaints asked "Is it fixed?", the dispute reason, the refusal "This machine already has a new open
breakdown", Confirmed, Disputed and reopened, Not answered; scanned from the board QR, scanned from another cell
(refused); the board's sign-off band (browser and TV); the desktop ticket for waiting, confirmed, disputed and reopened,
and not answered, each with turnaround both ways. Not drawn: the Team list's turnaround columns.

Choices (recommendation taken for every one):

1. Floor buttons say "Yes, it is fixed" and "Not fixed"; the desk and API keep Confirm and Dispute.
2. The unanswered timeout is a plant setting, default 4 h; after it the ticket stays closed and the escalation rule decides who is told.
3. The board QR band shows only while something waits: 2 machines plus "and N more"; the TV scoreboard keeps its three tiles.
4. A phone from another cell cannot answer; supervisors and above can answer from anywhere.
5. A dispute needs a short written reason (required).

## Slice 7: lockout before Start (ticket 66)

- Steps unticked · phone, light and dark
- All ticked · phone, light and dark
- Confirming · phone, light and dark
- Start refused · phone, light and dark
- Already confirmed · phone, light and dark
- Steps unticked · desktop · light
- All ticked · desktop · light
- Confirming · desktop · light
- Start refused · desktop · light
- Already confirmed · desktop · light
- Steps unticked · desktop · dark
- All ticked · desktop · dark
- Confirming · desktop · dark
- Start refused · desktop · dark
- Already confirmed · desktop · dark

States: steps unticked (Start off, says why), all ticked, confirming, refused (409 `lockout_required`), already
confirmed. An unflagged ticket starts as before; nothing is added to it.

Choices (recommendation taken for every one):

1. The four default steps: Switch off and isolate the supply; Lock and tag the isolator; Test that it is dead; Tell the people nearby. The plant can change them in Settings.
2. If another technician takes the job over they confirm again; a pause and resume by the same person does not ask again.
3. Only the work type Electrical is flagged "needs lockout" to begin with; the admin can flag more in Lists.
4. Only the confirmation is saved, as one history entry with who and when; the ticks are not saved.

## Slice 8: acknowledge, escalation history, roster and ladder, lockout settings

- Acknowledge: on duty
- Acknowledge: acknowledged
- Acknowledge: not on duty
- History: escalated and acknowledged
- History: repeats and levels
- History: no ladder
- Settings: duty roster
- Settings: escalation ladder
- Settings: edit a rule
- Settings: rule refused
- Settings: lists with needs-lockout flags
- Settings: flag a work type
- Settings: lockout steps
- Desktop: acknowledge, on duty · light
- Desktop: acknowledge, done · light
- Desktop: acknowledge, not on duty · light
- Desktop: escalated and acknowledged · light
- Desktop: escalation repeats and levels · light
- Desktop: no ladder · light
- Desktop: duty roster · light
- Desktop: escalation ladder · light
- Desktop: rule refused · light
- Desktop: lockout flags and steps · light
- Desktop: acknowledge, on duty · dark
- Desktop: acknowledge, done · dark
- Desktop: acknowledge, not on duty · dark
- Desktop: escalated and acknowledged · dark
- Desktop: escalation repeats and levels · dark
- Desktop: no ladder · dark
- Desktop: duty roster · dark
- Desktop: escalation ladder · dark
- Desktop: rule refused · dark
- Desktop: lockout flags and steps · dark

States: Acknowledge on the ticket for the person on duty, once acknowledged, and for someone not on duty; history
entries for an escalation then its acknowledgement, repeats and climbing levels, and "no ladder" (nobody told); roster
and ladder settings, a rule edit and a refused rule; Lists with "Needs lockout" flags, flagging a work type, and the
lockout steps. Settings screens are head and admin only.

Choices (recommendation taken for every one):

1. Acknowledge is the main button while the clock runs and the person is on duty; Start work stays beside it. Anyone else sees no button and who is on duty.
2. "No ladder" is shown in plain words in the history ("Escalation due, nobody told"); "Set the ladder" shows to head and admin only.
3. A repeat is its own history entry ("2 of 3"); the next level names the rule that fired.
4. The ladder refuses a repeat faster than every 15 minutes and a rule with no stop count.
5. The roster is set per day and shift, with Copy to the next 7 days; the ladder is push only for now.
6. Lockout is a "Needs lockout" flag on the list entry plus one editable list of steps, at least one.

## Analytics batch 1: shell, Dashboard, Today (tickets 37 and 38)

- Menu drawer
- Dashboard
- Today
- Dashboard · light
- Today · light
- Dashboard · dark
- Today · dark

Totals (1,279 breakdowns, 3,060.1 hrs, 759.3 PM hrs, BD % 0.54%, availability 99.32%) are read from the 11 Nov platform
workbook. The NO DT line (141 entries, 210.6 hrs), complaints and hours per day and the bubbles are computed from its
Breakdown Log and must be checked against the platform. Banner counts and Today's clock and sign-off items are samples.

Choices (recommendation taken for every one):

1. Menu groups are collapsed except the one you are in.
2. Dashboard order follows the platform; Fix Finder stays off it.
3. Head and plant head open on Today; the Dashboard is one tap away.
4. Money Matters is for heads and admin only and is not on the Dashboard.

## What builders add to the kit

Built once in `ui/` with a gallery section each, never in `faces/`: an account button (person icon, 44 px) for the top
bar; a tick row (checkbox row, 52 px) for the lockout steps; the sign-off band with its QR (react-qr-code, already in
SPEC section 5a). New lucide-react names for `ui/icon.ts`: Bell, BellOff, BellRing, Languages, LogOut, UserRound,
QrCode, Share, and for slices 8 and 9 ChevronsUp, GripVertical, CalendarDays, Copy, Gauge, ChartColumn, IndianRupee, Target. Status words, icons and colours are the locked chips and the slice 4 icon and colour map.
