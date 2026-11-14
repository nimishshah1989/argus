# Design slices 5 to 7 (approved 14 Nov 2026)

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

## What builders add to the kit

Built once in `ui/` with a gallery section each, never in `faces/`: an account button (person icon, 44 px) for the top
bar; a tick row (checkbox row, 52 px) for the lockout steps; the sign-off band with its QR (react-qr-code, already in
SPEC section 5a). New lucide-react names for `ui/icon.ts`: Bell, BellOff, BellRing, Languages, LogOut, UserRound,
QrCode, Share. Status words, icons and colours are the locked chips and the slice 4 icon and colour map.
