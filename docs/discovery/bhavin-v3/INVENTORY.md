# Live Breakdown Tickets v3 — Feature Inventory / Parity Checklist

Source files inventoried (read-only): `app.js` (1,654 lines; `APP_VER = '10.4 · 6 Nov 2026'`, `APP_BUILD = '20261106061349'`, L208), `ref.js` (295 lines), `voice.js` (96 lines), `maint.html` / `floor.html` (same page; inline scripts are byte-identical to the three JS files; only `PAGE_ROLE`, title, manifest, icons and theme colour differ). Line numbers below are `app.js` unless prefixed `ref.js:` / `voice.js:` / `html:`.

Provenance caveat for master data: in this build `ref.js` declares `REF` **empty** (`ref.js:2`) and it is filled at runtime from `/api/config` (`cfg.ref`, `ref.js:17`). The counts in section 11 therefore come from the platform export found alongside (`scratchpad/loader/cosmos.json`, dated 28 Oct 2026) and from the platform's own form, not from the phone payload itself; they are marked as such.

---

## 1. Roles and permissions

### 1.1 Role strings

| Server `user.role` | Display name (`ROLE_NAME`, L66) | Internal `LV.role` (L1550) | Page title (L1551) |
|---|---|---|---|
| `report` | Report | `floor` | "Report a Breakdown — {company}" |
| `maint` | Maintenance | `maint` | "Maintenance Desk — {company}" |
| `supervisor` | Supervisor | `maint` | "Maintenance Desk" |
| `admin` | Admin | `maint` | "Maintenance Desk" |
| `board` | View board | `board` | "Live status — {company}" |

`LV.role` collapses five server roles to three screen sets; supervisor/admin get extra powers checked against `ME().role` directly.

### 1.2 Capability matrix (client-side gates; comment at L27 says "the server checks too")

| Capability | Gate (function, line) | report/floor | maint | supervisor | admin | board |
|---|---|---|---|---|---|---|
| Raise stopped / support ticket | `vType`/`doSend` L322/395 | yes | yes (+ "I am starting work on it now") | yes | yes | no |
| Raise work request (general) | `FEAT('general')` L294, `doGeneral` L425 | yes | yes | yes | yes | no |
| Cancel own un-started ticket | `mineToCancel` L519: `LV.role==='floor' && status==='open' && !startedAt && raisedUser===ME().username` | yes | – | – | – | no |
| Cancel any open ticket | `actionBtns` L611 (always rendered for maint) | no | yes | yes | yes | no |
| Start / pick up / pause / resume / transfer / update / join / leave / running-again / stopped-again | `actionBtns` L609–620 | no | yes | yes | yes | no |
| Close with report / without report / mark done | `canCloseT` L28: `!personal() \|\| role in [supervisor,admin] \|\| status==='open' \|\| !startedBy \|\| isLead(t) \|\| myCrew(t).role==='primary'` | no | lead or primary only (personal login); anyone on shared phone | always | always | no |
| Choose whose day report | `canPickDay` L1044: `!personal() \|\| role in [supervisor,admin]` | no | own only (personal) | any person | any person | no |
| Restore a cancelled ticket | `canRestore` L917: `role==='admin' && status==='cancelled' && closedAt < 7 days` | no | no | no | yes | no |
| Edit/correct a ticket | `canEditTicket` L935: `role==='admin' && status!=='cancelled' && (active \|\| closed < 7 days)` | no | no | no | yes | no |
| Live board | `floorLive()` L40 (`CLIENT.floorLive===true`) for floor; always for maint/board | optional | yes | yes | yes | only screen |
| Push alerts | `pushCheck` L580 only for maint/floor | fixed-complaint alerts | new-breakdown alerts | same | same | no |
| Bottom tabs | `tabT` L182 | Report, My complaints, (Live) | Open, Mine, Team, Report, Live | same | same | none |
| "Me" avatar button (password/alerts/sign out) | `barHtml` L174 (maint or floor, top-level only) | yes | yes | yes | yes | no (uses `acctHtml` under Live, L475) |

### 1.3 Personal vs shared login

- `personal()` L65 = `AUTH.user && !AUTH.user.shared`. `lvMe()` L70 = personal → `ME().name`; shared → `localStorage bd_me_<client>`.
- Personal: every name field is a hidden input + "Recorded as **Name**" (`meSel` L567). Floor personal with `user.title` shows "Reporting as **Name (Title)**"; without title must pick a role chip (`whoBlock` L374–375).
- Shared: every action sheet shows a `<select>` of `REF.team` ("Select your name", `nameSel` L568); the floor shared phone types a free-text name (max 40 chars, parentheses stripped, L384) + role chip; last name/role remembered in `bd_name_`/`bd_by_` (L405).
- Shared maint phone can toggle "Show everyone's work" / "Show only mine" on Mine (`allmine`, L1222).
- `acctHtml` L231 shows "Signed in as **Name** · Role · shared phone".

### 1.4 Sign-in / sign-out / password

- Boot (`lvBoot` L1639): `lvIds` L1587 reads company id and API base from `?c=`/`?api=` → `window.CO_ID`/`window.API_BASE` (html:4 `CO_ID='cosmos'`, `API_BASE='https://bd-live-api.bhaven89.workers.dev'`) → `localStorage bd_cid`/`bd_api`. Validation regexes: cid `^[a-z0-9_-]{1,60}$`, api `^https?://…`. Legacy `bd_key_*` keys deleted (L1641). Missing ids → "This link is incomplete. Open the link your administrator sent you."
- Login screen (`lvLogin` L1595): Username (prefilled from `bd_lastuser_<cid>`), Password, "Show password" checkbox, hint "You stay signed in on this phone for 30 days after your last use." Brand fetched from `GET /api/brand` (company, logo); 401 → "This link has a company code the server does not know…".
- `POST /api/login {username, password, device:userAgent.slice(0,120)}` → `{token, user}`; stored in `bd_tok_<cid>`, `bd_user_<cid>`, `bd_lastuser_<cid>` (L1615). Errors: "Enter your username and password.", "No internet connection. Try again when you have signal."
- `lvStart` L1625: `GET /api/me` → `{user}` (refreshes cached user) → `GET /api/config` → `{config, fp}`; no config → "The company settings are not on the server yet…". Offline with cached `bd_cfg_` → start in offline mode.
- Any 401 on any call except `/api/login` → `lvSignedOut('Your sign-in has ended. Please sign in again.')` (L77, L1623) which calls `lvForget` L791 (clears `bd_tok_`, `bd_user_`, `bd_state_`, `bd_cfg_`).
- Sign out (`sheetSignout`/`doSignout` L779–789): unsubscribes push, `POST /api/logout {}`, `lvForget`, reload. Hint: "Alerts stop on this phone. You need your username and password to sign in again."
- Change password (`sheetPw`/`doPw` L792–807): fields Current / New (≥6) / New again; `POST /api/password {old, password}`; messages "Enter your current password", "The new password needs at least 6 characters", "The two new passwords are not the same", "Password changed."; hint "Your other phones and screens are signed out. This one stays signed in."
- Session persistence: token in localStorage; the 30-day sliding window is server-side (only the hint text asserts it). `/api/me` returns `{user:{username, name, role, shared, title}}` as inferred from use (L1629, L233, L374, L492).

---

## 2. Navigation / screens

Shell (`lvShell` L125): `#lvBar` (top bar), `#lvBody`, `#lvFoot` (sticky footer button), `#lvTabs` (bottom nav), `#lvSheetB/#lvSheet` (bottom sheet), `#lvToast`. Routing via `go(view, replace)` L154 with `history.pushState({view, d})`; `back()` L159; `popstate` L160. Root view per role (`rootOf` L129): maint → `open`, board → `live`, floor → `cat`. `TAB_OF` L130 maps views to the highlighted tab. `render()` L195 dispatches to `v*`.

| View key | Function | Role | Purpose / contents | Filters, search | Buttons (`data-a`) |
|---|---|---|---|---|---|
| `cat` | `vCat` L287 | floor, maint (Report tab) | "Which machine?" Step 1 of 3. Search box "Find a machine" (placeholder "e.g. VC-17 or just 17"); "Your recent:" chips (last 3 of 5 stored in `bd_recent_`); "Other work (not a machine)" button if `FEAT('general')`; segment headers + group tiles ("N machines"). Floor shows `acctHtml`; maint shows "More: report only, day report". | `searchRows` L298: `norm()` strips spaces/dashes, ranks exact > endsWith > contains, natural sort, max 30; empty → "No machine matches “…”. Check the number, or pick the group below." | `cat`, `pickm`, `general`, `moremenu` |
| `machine` | `vMachine` L316 | same | Group's machine list; input "Machine ID" with hint from `catHint` L305 ("Type only the number, for example 17 for VC-17. No spaces, no dash needed."). Rows show status chip or "Already reported. Tap to view the ticket." | `rowsFor` L309 (also matches number without prefix) | `pickm` |
| `type` | `vType` L322 | same | Step 2 of 3 "What is the situation?": red "Machine has stopped — Downtime starts the moment you send." / amber "Running, needs support — The machine can keep working while maintenance helps." | – | `kind` |
| `problem` | `vProblem` L358 | same | Step 3 of 3: pending-task note (`taskNote` L354), textarea "What is wrong?" (placeholder "Say it or type it in a few words"), mic "Speak in {language}", quick chips (`CLIENT.quickProblems` or `QUICK` L45: Not starting, Unusual noise, Alarm on screen, Coolant problem, Oil leak, Tool problem), `whoBlock`. Footer: "Send: machine has stopped" / "Send: needs support"; disabled hint "Write what is wrong, type your name and pick your role." (`lvSendState` L387) | – | `chip`, `by`, `mic`, `send` |
| `general` | `vGeneral` L413 | same | "Other work (not a machine)": Where? (select of `REF.locations` + "Cell N" from `REF.cells`, or free text), Type of work (`workTypes()`), "What is needed?", mic, How urgent? (Normal/Urgent), `whoBlock`. Footer "Send work request". | – | `urg`, `gensend` |
| `sent` | `vSent` L440 | same | "Sent to maintenance" confirmation: place, chip, "Ticket number {ref}", problem, "Reported hh:mm by …", WhatsApp button, "Cancel this ticket" (if allowed), "Report another machine"/"Report something else", "See my complaints and their status" (floor), "See live status". | – | `wa`, `cancelask`, `another`, `tab` |
| `live` | `vLive` L469 | all | Live board (section 8). | chips All / Stopped n / In progress n / Support n; "Find a machine" | `filter`, `tile` |
| `open` | `vOpen` L1184 | maint | Status chips (Down/Waiting/Support/Running OK), "Team now" strip, segmented tabs Breakdowns (n) / Tasks (n) / Work (n); lists not-started breakdowns ("Waiting for someone to start. Longest wait first."), Waiting (n), "Closed without a report (n) — Last 7 days. Write the report so it reaches the platform." with "Write report". Tasks tab: "Work left after a breakdown was closed. Earliest expected date first." Work tab: "Jobs not on a machine. Urgent first." | chip filter `openF`; "Showing machines down/waiting/support requests. Tap to show all." | `chipf`, `teamtog`, `otab`, `latereport`, all ticket actions |
| `mine` | `vMine` L1213 | maint | Day-report button; "N in progress for {me}. Repair time is running."; cards for working tickets where `startedBy===me` or I am crew (or all); each with "{startedBy} started at / continuing. First started", "Raised by maintenance." or "Response …", "Repair … · waited …"; "Waiting: your jobs (n)" (assigned/started/crew); "Show everyone's work"; closed list (`closedHtml` L850). Empty: "You are not working on anything. Pick a ticket under Open and tap Start work." | person filter `wf` (shared phone when `wk.all`) | `allmine`, `wkref`, `wkmore`, `dayask` |
| `team` | `vTeam` L810 | maint | Team day-report button; "Working now (n people)" grouped by person with per-job elapsed; "Waiting (n)"; "Not started (n)" ("Every complaint has someone on it."); "Cancelled in the last 24 hours (n)" collapsible (`cxHtml` L1207); team closed list (`teamClosedHtml` L1018) with "This month: n jobs · n people" collapsible per-person totals (Primary/Support split) and person filter `tf`. | `tf` select | `monopen`, `cxtog`, `twkref`, `twkmore` |
| `my` | `vMy` L511 | floor | "My complaints": push prompt; "Open (n)" cards (`myCard` L494: chips Booked / In progress / {wait tag} / Transferred / Fixed / Cancelled); "Fixed [or cancelled] in the last 24 hours (n)"; "Cancel this complaint". | – | `cancelask`, `openticket` |
| `close` | `vClose` L1287 | maint | Close-with-report pre-screen: Reported/Work started (response)/Transferred n times, waited for pick-up/Waiting (not counted as repair); "When did you finish?" ±5 min; Response/Repair/Downtime stats; pending-task block; "Continue to report form". | – | `coff`, `closego` |
| `closed` | `vClosed` L1301 | – | "Ticket closed" stats screen. **Dead code**: never routed to (no `go('closed')`). | – | – |
| `form` / `success` | `lvToForm` L1356 / `lvReportSaved` L1392 | maint | The legacy PDF form (`#formScreen`) with banner (`lvBanner` L1307) and success screen. | – | – |

Bottom sheets (`openSheet` L165): `sheetMe` L177 (name, account, push, "Open the team guide" → `guide.html`, "Update now"), `sheetMachine` L520, `sheetDetail` L1001 (full ticket), `sheetJoin`, `sheetLeave`, `sheetRun`, `sheetHand`, `sheetUpd`, `sheetPause`, `sheetResume`, `sheetDone`, `sheetSignout`, `sheetPw`, `sheetRestore`, `sheetEdit`, `sheetDay`, `sheetStart`, `sheetReason`, "More" menu (L1467), "Report ready" (L1134). Tapping the backdrop closes (L1555).

Badges (`tabT` L182–188): Open badge = count of `status==='open'`; Mine badge (blue, class `b`) = `status==='working'` and `startedBy===me` (or allMine/no me); My complaints badge = `myOpen().length`. Note the Mine badge ignores crew membership while the Mine list includes it.

Other chrome: toast (`lvToast` L128, 2.8 s ok / 4.5 s bad); update banner "A new version of the app is ready." → "Update now" (`lvCheckUpdate` L219, polls page for `APP_BUILD`, throttled 10 min via `sessionStorage lvUpAt`; `lvApplyUpdate` L212 reload-fetches page, updates SW, clears all caches, reloads); global error banner "Something failed to load or run correctly: …" (html:240–252); `?m=<machineId>` deep link for floor (L1577–1579).

---

## 3. Ticket lifecycle

### 3.1 Status and derived state

| `status` (server) | Meaning |
|---|---|
| `open` | reported, nobody working (also after a transfer: `handedOver=true`) |
| `working` | someone started (`startedBy`, `segStart` running) |
| `waiting` | paused for an external reason (`waitReason`, `waitSince`, `pausedBy`, `assignedTo`, `eta`) |
| `closed` | closed (`closeKind` ∈ `report`, `no_report`, `done`; `CLOSE_KIND` L873) |
| `cancelled` | cancelled (`closeNote` = reason) |

`uiState(t)` L15: `working` → `working`; `waiting` → `waiting`; `handedOver` → `handover`; `kind==='general'` → `general`; `kind==='support'` → `support`; else `stopped`. Labels `SL` L16: Stopped, Work in progress, Needs support, Transferred, Waiting, Work request, Running, "Running · follow-up". Tile tags `STAG` L17: STOPPED, IN PROGRESS, SUPPORT, TRANSFERRED, WAITING, REQUEST, '', FOLLOW-UP. `isFollow(t)` L19 = `kind==='stopped' && runningAt && status in open/working/waiting` (machine running again, ticket open; amber). `waitTag` L43 maps `waitReason` text to AT VENDOR / WAITING SPARE / WAITING APPROVAL / WAITING UTILITY / NOT RELEASED / WAITING. `typeLine` L21: "📌 Pending task of {parentRef} · expected {d Mon}", "🟢 Machine running again · follow-up pending", "🔴 Machine stopped", "🟢 Machine running · needs support", "🔧 Work request".

`kind`: `stopped` | `support` | `general` (work request; a pending task is a `general` ticket with `parentId`).

### 3.2 Transitions

| Action | UI (function) | Who | Validation / rules | API + payload |
|---|---|---|---|---|
| Raise machine ticket | `doSend` L395 | floor, maint | problem required ("Write what is wrong"); `whoRead` L380: maint "Select your name"; personal floor "Pick your role"; shared floor "Type your name"/"Pick your role". Duplicate: server returns `{exists, ticket}` → toast "{id} was already reported by {reportedBy} at hh:mm." and opens that ticket. | `POST /api/down {machine, by:"Name (Role)", problem, kind, cell, category, role:'maint'\|'floor', startNow, startBy, byRole}` → `{ticket}` |
| Raise work request | `doGeneral` L425 | floor, maint | "Select or type where the work is", "Select the type of work", "Write what is needed" | `POST /api/down {kind:'general', location, workType, urgent, by, problem, role, startNow, startBy, byRole}` |
| Start / pick up | `sheetStart` L1226 / `doStart` L1235 | maint | Who is working; "When did you start?" in 5-min steps back-dated up to `startBounds` L1225 = minutes since `handoverSince||downAt`; preview "Response time will be …" or "Transferred at hh:mm. Your work time is counted from now."; "Select who is working on it". Saves `bd_me_`, re-registers push (`pushWho`). | `POST /api/start {id, by, ts}` |
| Join / add a person | `sheetJoin` L622 / `doJoin` L634 | maint; `canJoin` L29 (working/waiting, not lead, not already crew); lead sees "Add a person to this job" | role `primary` ("Share the work. Can close the ticket. Name goes under Done by.") or `support` ("Help with the job. Name goes under Supported by."); "Select who is joining" | `POST /api/join {id, by, name, role}` |
| Leave | `sheetLeave` L643 / `doLeave` L653 | `canLeave` L30 (crew member, or lead when a primary exists to take over) | reason required ("Write why you are leaving"); hint "{primary} (primary) will take over the job." | `POST /api/leave {id, by, name, reason}` → `{ticket}`; toast adds "{X} is running it now." if lead changed |
| Pause | `sheetPause` L723 / `doPause` L734 | maint, `FEAT('pause')` | reason from `waitReasons()` (L35 default: Waiting for spare, Sent to vendor for repair, Waiting for approval / PO, Waiting for utility (power, air), Machine not released by production, Other); details, "Expected back" date (→ 18:00 local ISO, L738), "Assign to" from team; "Select what the work is waiting for". Hint: "Your repair time stops; the machine downtime keeps counting." | `POST /api/pause {id, by, reason, note, eta, assign}` → go Open |
| Resume | `sheetResume` L742 / `doResume` L751 | anyone in maint | who is resuming; if `assignedTo` differs → second tap confirm "Assigned to X. Tap Resume work again to continue anyway." (L754) | `POST /api/resume {id, by, note}` → go Mine |
| Transfer | `sheetHand` L684 / `doHand` L695 | maint | "What was done and what is left?" required; "Transfer to (optional)": "Next shift" + team, default "Anyone (not decided)"; ticket returns to `open` with `handedOver` | `POST /api/transfer {id, by, to, note}` → go Open |
| Post update | `sheetUpd` L702 / `doUpd` L714 | maint (open-handedOver, waiting, working; also open in sheet) | text required ("Write the update"); spare part text; expected date → 18:00 ISO | `POST /api/update {id, by, text, spare, eta}` |
| Machine running again | `sheetRun(false)` L663 / `doRun` L674 | maint, `kind==='stopped'` without `runningAt` | datetime-local "Running since" (default now; unchanged → `ts:''` = server now); note optional; downtime stops, ticket stays open, amber | `POST /api/running {id, by, ts, note}` |
| Machine stopped again | `sheetRun(true)` | `runningAt` set | "Stopped since"; "The downtime clock starts again from this time and adds to the earlier stopped time." | `POST /api/stopped {id, by, ts, note}` |
| Close with report | `vClose` L1287 → `lvToForm` L1356 → PDF → `lvReportSaved` L1392 → `lvCloseTicket` L1399 | `canCloseT`, `kind!=='general'` | finish time ±5 min back to `segStart||startedAt||downAt`; pending-task block; `by` = startedBy if in Done-by chips else first chip, else observedBy, else me, else "Maintenance" (L1395); `ts = min(closeTs, now)`; `file = Breakdown_<machine>_<date>.pdf` | `POST /api/close {id, by, kind:'report', file, ts, report:<QR data>, task}` → `{ticket:{responseMin, repairMin, downtimeMin}, task:{ref}}`; offline → queued (`lvPend`) |
| Close without report | `sheetReason('noreport')` L1245 / `doReason` L1255 | `canCloseT`, `kind!=='general'` | reason required; pending-task block; "Write what is pending, or untick Leave a pending task" | `POST /api/close {id, by, kind:'no_report', note, task}`; ticket then appears under "Closed without a report" (`needReport`) for 7 days |
| Mark done (work request / task) | `sheetDone` L759 / `doDone` L769 | `canCloseT`, `kind==='general'` | "What was done?" required; for a pending task: "Task not finished: leave another pending task" and "Did the machine have to stop for this work?" minutes 0–1440 | `POST /api/close {id, by, kind:'done', note, task, taskDown}` → toast "Done. Work time … New pending task {ref} saved." |
| Late report | `latereport` L1544 → `lvToForm(t, closedAt)` → `lvLateReport` L1409 | maint | banner "The ticket was closed … without a report. Saving this sends the report to the platform." | `POST /api/report {id, by, report}` → "Report sent. It will show in the platform for approval." |
| Report only (no ticket) | `reportonly` L1507 | maint | banner "Report only. Use this for a breakdown that was already fixed. No ticket is closed." PDF only, no API. | – |
| Cancel | `sheetReason('cancel')` / `doReason` | maint any open ticket; floor own un-started | reason required ("Write the reason"); name (maint select / floor text "Type your name") | `POST /api/cancel {id, by, reason}` → "Ticket cancelled. {machine} shows running again." |
| Restore (undo cancel) | `sheetRestore` L918 / `doRestore` L927 | admin, cancelled < 7 days | reason required ("Write the reason for restoring"); goes back to prior status | `POST /api/restore {id, reason}` → `{status}` → "Restored. The ticket is open again / back in progress / waiting again." |
| Edit / correct | `sheetEdit` L937 / `doEdit` L981 | admin, active or closed < 7 days | editable: Reported at, Work started at, Started by, Closed at, Closed by, Work time (min), Waiting time (min), Problem; reason required; only changed fields sent (times compared with 60-s tolerance, L983); "Nothing was changed"; linked arithmetic `edLink` L966 (work = close − start − waiting − handoverWaitMin; moving one moves the other; warnings "That work time is longer than the time from reported to closed…", "The closing time is before the work started (plus waiting). Check the times."); `edCheck` L957 flags mismatch on open | `POST /api/edit {id, downAt?, startedAt?, closedAt?, activeMin?, waitMin?, problem?, startedBy?, closedBy?, reason}` → `{changed:[...]}` (times in history written as `@YYYY-MM-DDTHH:MMZ`, rendered by `edTimes` L980) |

`actionBtns` L609 decides visible buttons: open → "Start work"/"Pick up transferred work", "Post update" (in sheet or if handed over), "Cancel ticket"; waiting → "Resume work", join, run/stop, "Post update", "Leave this work", cancel; working → close button ("Write report and close" / "Mark done") if `canCloseT`, join ("Join this work" / "Add a person to this job"), "Pause: waiting" (if `FEAT('pause')`), "Transfer", "Machine running again"/"Machine stopped again", "Post update", "Close without report" (not for general), leave, cancel.

Ticket numbering: `t.ref` is server-assigned and only displayed (`refTag` L867, "Ticket number {ref}" L444, prefix in WhatsApp text L239). Format could not be determined from the client.

---

## 4. Ticket data model (as used by the client)

### 4.1 Ticket object fields

| Field | Type | Meaning / where used |
|---|---|---|
| `id` | string | primary key (`findTicket` L868) |
| `ref` | string | human ticket number |
| `kind` | `stopped`\|`support`\|`general` | L15 |
| `status` | see 3.1 | |
| `machine`, `cell`, `category` | string | machine id and snapshot of REF meta (sent on create L403) |
| `location`, `workType`, `urgent` | string, string, bool | general tickets (L41, L238) |
| `problem` | string | |
| `reportedBy` | string | display "Name (Role)" (parsed at L1365) |
| `raisedUser` | string | username of raiser; drives "mine" on floor (L492) |
| `downAt` | ISO | report time; downtime start |
| `startedAt`, `startedBy` | ISO, string | first start; current lead |
| `segStart` | ISO | start of current working segment (L580) |
| `activeMin` | int | closed hands-on minutes (L580) |
| `waitMin`, `vendorMin` | int | paused minutes (vendor subset) L888 |
| `waitSince`, `waitReason`, `pausedBy`, `assignedTo`, `eta`, `waitSpare` | ISO/str | pause details (L602–603) |
| `handedOver`, `handoverSince`, `transferTo`, `transfers`, `handoverWaitMin` | bool/ISO/str/int/int | transfer state (L1150, L1225, L1295, L964) |
| `selfStarted` | bool | raised by maintenance with "starting now" (L1218) |
| `responseMin`, `repairMin`, `downtimeMin`, `followMin` | int | computed by server; `repairMin` only seen in close response (L1403) |
| `downAcc`, `stopAt`, `runningAt` | int, ISO, ISO | accumulated stopped minutes, current stop start, machine-running-again time (L22, L1268) |
| `closedAt`, `closedBy`, `closeKind`, `closeNote` | | close details |
| `report` | object | `{ca\|done, db, sb, ob, mc, bc, sp, sh, rc}` (L258, L904; `rc` "Root cause" is read but never written by the form) |
| `crew` | array of `{name, role:'primary'\|'support', segStart, left, leftWhy}` | L24, L896 |
| `updates`, `updateCount` | array (latest first, max ~3 in state), int | timeline entries (L604) |
| `segments` | array `{by, mins, role}` | per-person work in closed lists (L842, L848) |
| `parentId`, `parentRef`, `taskExp` (YYYY-MM-DD), `taskWhy`, `taskDownMin` | | pending-task fields (L21, L765) |
| `follow` | array | optional pre-computed child tasks (L332) |
| `file` | string | PDF file name sent on close |

### 4.2 Timeline / event entry (`updates[]`, `/api/ticket.events[]`)

`{type, by, at, text, spare, eta, mins, task}`. Types and labels (`TL` L581, L872): `update` Update, `transfer` Transferred (spare = to), `pause` Paused (spare = reason), `resume` Resumed (mins = waited), `pickup` Picked up, `task` Pending task, `join` Joined (spare = role), `leave` Left (spare = 'main' or role), `lead` Took over, `running`/`stopped` Machine running/stopped again (eta = since), `restore` Restored (spare = previous status), `edit` Edited (spare = change list with `@time`), `down` Reported, `start` Started, `close` Closed, `cancel` Cancelled, `report` Report written. `tlLine` L582 renders each.

### 4.3 `/api/state` payload (`lvRefresh` L1423)

`{open:[ticket], closed:[ticket], cancelled:[ticket], needReport:[ticket], now:ISO, config:{fp}}`. `closed`/`cancelled` are described in the UI as "last 24 hours" (L516, L1210); `needReport` "Last 7 days" (L1196). Cached in `localStorage bd_state_<client>` for offline (L1426).

### 4.4 Other payloads

- `/api/ticket?id=` → `{ticket, events:[...], people:[{by, role:'started'\|'primary'\|'support', mins}], tasks:[child tickets]}` (L874–907).
- `/api/mywork` → `{all:bool, tickets:[closed tickets with segments]}`; `?team=1` → `{tickets}` (L838, L1014).
- `/api/dayreport` → `{people:[{name, mins, closed, supportMins, primaryMins, jobs:[{id, ref, kind, machine, location, workType, problem, parentRef, taskExp, status:'closed'\|'waiting'\|'transferred'\|'working'\|'open'\|'cancelled', statusAt, statusBy, done, why, to, role:'started'\|'primary'\|'support', mins}]}]}` (L1081–1117).

---

## 5. Pending tasks / follow-up

- Left when closing a machine ticket (`ptaskBlock` L1273, shown in `vClose`, `sheetReason('noreport')`, and in `sheetDone` for a task with "Task not finished: leave another pending task"). Fields: checkbox "Leave a pending task", text (placeholder "e.g. Replace coolant pump when the spare arrives"), why (`PT_WHY` L1271: Waiting for spare, Waiting for vendor, Needs a planned stop, Other), "Expected date (optional)". Hint: "Use this when the machine is running but something is still to be done… The ticket closes and the task waits in the Tasks list." Payload `task:{text, why, exp}` (`ptaskOut` L1285); validation `ptaskBad` L1286.
- Server creates a child `general` ticket with `parentId/parentRef/taskExp/taskWhy`; listed under Open → Tasks tab sorted by `taskExp` then `downAt` (L1189); tile shows 📌 (`taskOn` L353); report screen warns "📌 A pending task is open on this machine … Report only if this is a new problem." (`taskNote` L354).
- Done via "Mark done" with optional minutes the machine stopped (`taskDown` → `taskDownMin`).
- Parent shows follow-up box (`fuBox` L336): "✔ FOLLOW-UP DONE", "⏳ FOLLOW-UP PENDING · n tasks", "🔧 FOLLOW-UP IN PROGRESS", "⚠ FOLLOW-UP OVERDUE" (expected date < today, `expNice` L1272 renders "3 Nov"); per task "Reason: …", "Expected / Was expected …", "Started … by …" / "Not started"; "n earlier tasks done".

---

## 6. Reports and PDFs

### 6.1 Breakdown report PDF (`ref.js:buildPdf` L146 + `pdfExtra` L1334 + `pdfTimeline` L1343)

A4, jsPDF. QR code fixed top-right (26 mm) with caption "Scan to import into {CLIENT.product}". Title "{COMPANY} — {reportTitle}" uppercase; subtitle "Generated from mobile entry tool — one report per breakdown". Fields: Machine ID "(category, Cell n)"; DATE (dd-mm-yyyy) / SHIFT / DOWN TIME ("n min"); if ticket data: TYPE ("Machine stopped"/"Running, needs support") / RESPONSE / REPAIR / TICKET; Problem Description; Observed By; Corrective Action; Done By; Supported By; MAINT CODE / BREAKDOWN CATEGORY / SPARE USED. Then `pdfExtra` block "TICKET DETAILS ({ref})" with rows PEOPLE ("Done by X (primary, 1 h 05 min), … · Supported by … · Reported by …"), TIMES, TIME SPLIT ("Hands-on … · Waiting … (vendor …) · Follow-up …"), TYPE, PENDING TASK (`pdfFacts` L1316); inline TIMELINE if ≤ 6 events, else deferred. HANDOVER block (signature image 60×22 mm + "Name of person taking handover") read from DOM only, never in QR (ref.js:227). Footer "Report generated: dd-mm-yyyy at h:mm AM/PM". Extra page "Ticket {ref} — {machine}" / "WORK TIMELINE" with events of types `PDF_EV` L1333 (start, pickup, pause, resume, transfer, join, leave, running, stopped, update, task).
- QR payload (`ref.js:111–129`): `{v:1, mid, d, sh, pr, ob, ca, db, sb, dm, mc, bc, sp, ty, tk, rs, rp}`; `bdQR` ref.js:46 shrinks `pr/ca/sp` until ASCII-escaped JSON ≤ 650 chars, error level M then L.
- File: `Breakdown_<machineId sans non-alnum>_<YYYY-MM-DD>.pdf`, saved via `doc.save` (browser download). The same `report` object is POSTed to the server with `/api/close` or `/api/report`; the PDF file itself is **not uploaded** (only its name, L1395/1402).
- Signature pad (`ref.js:56`, `sigFit` L133 re-sizes on show/resize, keeps strokes).

### 6.2 Day report PDF (`sheetDay` L1045, `doDay` L1124, `buildDayPdf` L1069)

- Entry points: Mine → "Download day report" / "Download my day report"; Team → "Download team day report"; Report → More menu. Sheet "My day report"/"Team day report": Whose report? (supervisor/admin or shared phone), Date (Today / Yesterday / last 7 days), Shift ("Not set (whole calendar day)" or "Shift 1 (06:00–14:00)" from `CLIENT.shiftTimes`), "Covers … to …". `CLIENT.teamShifts[name]` pre-selects the person's shift (L1060). Window (`dayWindow` L1036): day start at local midnight (or shift start time) + **24 hours** regardless of shift end.
- `GET /api/dayreport?from=ISO&to=ISO[&team=1][&who=name]`.
- PDF: logo (`CLIENT.logo` data-URI, L1071), company, "Daily Work Report"/"Team Daily Work Report", person/day/shift line, "Covers … Work time counts only the time each person worked on the job within this period."; 5 stat boxes (team: People, Jobs, Closed, Team work time, Pending at end; person: Jobs worked on, Closed by {first name}, Work time (support …), Breakdowns / requests, Pending at end); table Ticket / Machine / place / Problem / What was done / status / Role / Work; team summary table Person/Jobs/Closed/Work time/Primary/Support + "Team total"; per-person sections; "Pending at the end of the period (for the next shift)"; footer "Made from live tickets on … Page i of n". `pdfTxt` L1061 strips non-Latin text and appends "[local-language text]".
- File `Day_report_<Team|who>_<YYYY-MM-DD>[_Shift<n>].pdf`; "Share (WhatsApp, email…)" via Web Share API with fallback "This phone cannot share files directly. The PDF is saved; send it from WhatsApp." (`dayShare` L1140), "Save the PDF on this phone" (`daySave` L1139).

---

## 7. Report form (`ref.js`, `html:255–348`)

| Field id | Label | Required | Source / notes |
|---|---|---|---|
| `f_machineId` | Machine ID * | yes ("Please select a machine") | `REF.machines` ids; hint `machineMeta` "{category} — Cell {cell}" |
| `f_date` | Date * | yes ("Please enter the date") | default today |
| `f_shift` | Shift * | yes ("Please select a shift") | `REF.shifts` |
| `f_problem` | Problem Description * | yes ("Please describe the problem") | mic button added by voice.js |
| `f_observedBy` | Observed By | no | `REF.observedBy` |
| `f_correctiveAction` | Corrective Action | no | mic button |
| `lvChDone` / `lvChSupp` | Done By / Supported By (optional) | no | chips from `REF.team`; a name can be in only one list (`lvChipSet` L1381, "(moves from Supported by)") |
| `f_downMin` | Down Time (Min) * | yes ("Please enter the downtime in minutes") | |
| `f_breakdownCategory` | Breakdown Category | no | `REF.breakdownCategories` |
| `f_respMin`, `f_repairMin` | Response (min), Repair (min), optional | no | |
| `f_kind` | hidden | | `stopped`/`support` |
| `f_maintCode` | Maintenance Code | no | `REF.codes` |
| `f_spare` | Spare Used (optional) | no | |
| `sigCanvas`, `f_handoverName` | Signature / Name of Person Taking Handover | no | PDF only: "For record-keeping in the PDF only — not sent to the main platform." |

`validate()` ref.js:86 toggles `.invalid` and scrolls to the first. Pre-fill from a live ticket (`lvToForm` L1356): machine, problem, date = `downAt` date, downtime = `max(1, downAt(t, closeMs))` (0 for support), response, repair = `activeMin + current segment`, kind, observedBy parsed from "(Role)" suffix if in `REF.observedBy`, Done by = lead + primary crew, Supported by = support crew. `resetForm` ref.js:274 is wrapped (L1650) to return to the root view. Success screen "Report Generated — The PDF has downloaded to this device…" plus `#lvDone` line "Ticket closed. The machine now shows running. Response … · Repair … · Downtime …".

---

## 8. Live board (`vLive` L469, `tilesHtml` L455, `liveCounts` L449)

- Counts: Running (= machines in built groups minus machines with an open non-general ticket), Stopped, In progress, Support. Bucketing: follow-up → support; handover/waiting → stopped (or support if `kind==='support'`).
- Tiles per segment/group, label "{group name} ({prefix})", tile text = id + tag (`STAG`, or wait tag), 📌 if a pending task. Colours (`html:57–126`): stopped #C62828, working #1747C9, support/follow #F2A900, handover #7C3AED, waiting #EA580C, running white.
- Filter chips "All / Stopped n / In progress n / Support n" and "Find a machine" (placeholder "Type VC-17, no spaces"). Footer "Work requests (not machines): n open". Top-right "Updated hh:mm · offline".
- Tap tile → `sheetMachine` L520: running machine → "This machine is running. Report a problem?" with "Machine has stopped" / "Running, needs support" (board role: text only); otherwise the ticket detail sheet.
- Grouping (`lvBuildCats` L88): if any machine has `seg`, sections by `seg` (order `CLIENT.segOrder` or `SEG_ORDER` L86: CNC, Conventional, Process, Utility, DG, Robot; names `SEG_NAME` L87); else `lvGroupOf` L83 → `CLIENT.groups[category]` or `LV_UTIL` regex `/tank|compressor|dryer|stabili[sz]er|\bups\b|\bdg\b|generator|transformer|chiller/i` → `hidden`, else `cnc`. `CLIENT.groups[cat]==='hidden'` and `CLIENT.segShow[seg]===false` hide machines. Within CNC groups are by letter prefix (`lvPre` L84) unless `segGroup[seg]==='category'`; other segments by category unless `segGroup[seg]==='letters'`; prefixes with < 2 machines collapse into "Other". Sort: group size desc then natural; machines natural (`natural` L85).
- Board role: only Live, no tabs, no account button, `acctHtml` under the tiles.

---

## 9. Notifications, offline, refresh

- Web push (L528–563): `pushCheck` states `none` / `denied` / `on` / `off` / `ios` (iOS not installed as PWA → "Alerts on iPhone — Tap Share, then Add to Home Screen…"). `pushOn`: `Notification.requestPermission` → `GET /api/pushkey {key}` → `pushManager.subscribe` → `POST /api/subscribe {sub, role:LV.role, who:lvMe()}`; toasts "Alerts are on. This phone will ring when your complaint is fixed." (floor) / "…for every new breakdown." (maint). `pushOff` → `POST /api/unsubscribe {endpoint}`. `pushTest` → `POST /api/pushtest {endpoint}` "Test alert sent…". `pushWho` re-subscribes silently when the acting name changes (after start/resume/raise). Prompt card "Get an alert when your complaint is fixed / for every new breakdown — Even when this page is closed. [Turn on]". Service worker `sw.js` registered on https (html:2458); its content is not in the files.
- WhatsApp: `waText` L236 short status text ("{ref} · 🔴 MACHINE STOPPED: VC-17 (Vertical Machining Center, Cell 2)\n{problem}\nReported by … at hh:mm\n{X} is working on it" / "✅ CLOSED … Fixed by … at … · down …" / "⚪ CANCELLED" / "🟠 WAITING (AT VENDOR)" / "🟣 TRANSFERRED, WAITING TO BE PICKED UP" / "🟡 NEEDS SUPPORT" / "🔵 WORK IN PROGRESS" / "🔧 WORK REQUEST (URGENT)"); from the detail sheet `waFull` L242 adds *Problem*, times, work/waiting/downtime, people, *Report*, *History* (max 25 lines, "… n earlier steps …"), "As of …", capped at 3,500 chars. Opened via `https://wa.me/?text=` anchor click (L281). Button "Send on WhatsApp".
- Toasts: `lvToast` L128; banners: offline marker in bar, update banner, error banner.
- Offline: `lvApi` throws `{net:true, message:'No internet connection'}`; `lvRefresh` falls back to cached state and sets `LV.offline`; config cached in `bd_cfg_`; send errors say "…Nothing was sent. Try again when you have signal."; close/late-report failures queue in `bd_pend_` (`lvPend` L1414) and `lvFlush` L1416 replays on `online` and at init ("No internet. The report PDF is saved. The ticket will close by itself, with your chosen time, when this phone is online again.").
- Refresh: `setInterval` 30 s when visible (L1581); on `visibilitychange`; after every action. Clock skew `LV.skew = Date.parse(state.now) − Date.now()` (L1426) and all durations use `nowMs()` L11. `lvSoftRender` L1446 skips re-render while typing or a sheet is open. Closed lists: cache 60 s when empty, 5 min when loaded (L836, L1012), forced on tab open (`wkFresh`). Config fingerprint `state.config.fp` triggers `GET /api/config?fp=` (`lvConfigCheck` L1435, `{same}` or new config).

---

## 10. Voice (`voice.js`)

- Mic buttons on `f_problem` and `f_correctiveAction` (voice.js:11) and on the ticket screens (`guOpen('d_problem', …)` L1487). Sheet (html:684–703): "1. What you said ({language})" textarea, status line, "Start speaking"/"Stop", "Start fresh", "2. English (check this)", "Translate to English", "Use this English", "Cancel".
- Recognition: `webkitSpeechRecognition`, `lang = CLIENT.language.code || 'gu-IN'`, `interimResults = true`, `continuous = true`, `maxAlternatives = 1`; auto-restart on `onend` while wanted; transcript rebuilt from all results with prefix de-duplication (voice.js:50–56); getUserMedia pre-check with 12 s timeout; 6 s start watchdog. Error texts for not-allowed, service-not-allowed, no-speech, network, language-not-supported, audio-capture; `guWhy()` explains file://, iframe, non-https, permission.
- Translation chain (`guTranslateRaw` voice.js:85): (1) relay `POST GU.relay {text, kind, lang}` → `{english}` ("Translated for maintenance reports. Please check it.", 9 s timeout); (2) Chrome on-device `Translator` API ("Translated on this phone. Please check it carefully."); (3) public `https://translate.googleapis.com/translate_a/single?client=gtx…` ("Basic translation. Technical words may be wrong…"). Relay address from `?relay=` → `localStorage bd_relay` or legacy `cosmos_relay`, else `CLIENT.relay` (ref.js:18). Glossary `CLIENT.glossary` applied before (non-ASCII keys, `guGloss`) and after (ASCII keys, case-aware, `guGlossEn`).
- Confirmation: the person must tap "Use this English"; it appends to the target textarea and dispatches `input` (voice.js:92).

---

## 11. Master data (`REF`)

`REF` shape used by the client: `machines[{id, category, cell, seg?}]`, `shifts[]`, `observedBy[]`, `team[]` (names), `codes[]` (strings or `{code, description}`), `breakdownCategories[]`, `locations[]`, `cells[]`. Note `populateSelect('f_maintCode', REF.codes)` (ref.js:28) is called without key names, so codes must arrive as plain strings in the phone payload.

From the platform export `loader/cosmos.json` (28 Oct 2026; may differ from the live `/api/config`):

| List | Count | Values |
|---|---|---|
| Shifts | 3 | `1`, `2`, `3` |
| Breakdown categories (E / M) | 4 | `E`, `M`, `E/M`, `PM` |
| Maintenance codes | 22 | E, M, AX, SP, RT, ATC, PC, LB, CON, PM, HY, MIS, CHI, ELE, HUM, HYD, LIK, PNU, ROT, TUR, NO DT, RINT |
| Team | 14 | Sagar T, Madhu K, Priyank R, Chirag P, Bipin P, Kiran B, Abhi S, Mahendra P, Imptex Team (Vendor), Jitu R, Mayur C, Vishal P, Ganesh Z, Mehul P |
| Observed-by roles | 4 (inferred from the platform form, not in export settings) | Operator, Setter, Supervisor, Engineer |
| Locations | 7 | 434, 435/4, 445, 486, 841-A, 841-B, 381 |
| Cells | 9 | 1–9 |
| Segments | 4 | CNC, Conventional, Utility, Process (plus DG list) |

Machines: 191 total. CNC 125 (Vertical Machining Center 51 `VC`, Turning Center 38 `TC`, Vertical Turning Lathe 12 `VTL`, grinding 9 `GRD`, Turnmill 5 `TMC`, HMC 3, DCMC 2, sliding-head 2 `S`, CAM 1, WaterJet 1 `WJ`, Robot 1); Conventional 16 (Bandsaw 5 `BS`, Drilling/Radial 4, Lathe 2, Hydraulic Press 2, Broaching, Circular, Plate cutting); Process 17 (Ultrasonic Washing 4 `US`, Blasting 3 `BM`, Marking 2, Magnetic Deburring 2, Polishing Head 2, HTP, Laser, Helium, Copper spray); Utility 30 (Stabilizer 10, Air Dryer 8, Air Compressor 6 `COMP.-nn`, Air Receiver Tank 5, UPS 1); DG 3. Platform machine fields: `id, segment, category, make, model, serial, controller, ctrlModel, ctrlSerial, year, datePurchase, power, location, cell, length, width, assetCode, conveyor, capacityKva`; the phone only needs `id, category, cell, seg`.

---

## 12. Backend API contract (client view)

All calls via `lvApi` L71: base `AUTH.api`, header `X-Client: <cid>`, `Authorization: Bearer <token>` when signed in, JSON body ⇒ POST, else GET. Non-OK → `{message: j.error || 'Something went wrong', status}`; 401 (except login) → forced sign-out; network failure → `{net:true}`.

| Endpoint | Method | Request | Response used |
|---|---|---|---|
| `/api/brand` | GET (raw fetch, X-Client only) | – | `{company, logo}`; 401 = unknown company |
| `/api/login` | POST | `{username, password, device}` | `{token, user}` |
| `/api/me` | GET | – | `{user}` |
| `/api/logout` | POST | `{}` | – |
| `/api/password` | POST | `{old, password}` | – |
| `/api/config` | GET | `?fp=` optional | `{config, fp}` or `{same, fp}` |
| `/api/state` | GET | – | `{open, closed, cancelled, needReport, now, config:{fp}}` |
| `/api/ticket` | GET | `?id=` | `{ticket, events, people, tasks}` |
| `/api/mywork` | GET | `?team=1` optional | `{all, tickets}` |
| `/api/dayreport` | GET | `?from&to[&team=1][&who]` | `{people:[…]}` |
| `/api/down` | POST | see 3.2 | `{ticket}` or `{exists, ticket}` |
| `/api/start` | POST | `{id, by, ts}` | – |
| `/api/join` | POST | `{id, by, name, role}` | – |
| `/api/leave` | POST | `{id, by, name, reason}` | `{ticket}` |
| `/api/pause` | POST | `{id, by, reason, note, eta, assign}` | – |
| `/api/resume` | POST | `{id, by, note}` | – |
| `/api/transfer` | POST | `{id, by, to, note}` | – |
| `/api/update` | POST | `{id, by, text, spare, eta}` | – |
| `/api/running` / `/api/stopped` | POST | `{id, by, ts, note}` | – |
| `/api/close` | POST | `{id, by, kind:'report'\|'no_report'\|'done', note?, file?, ts?, report?, task, taskDown?}` | `{ticket:{responseMin, repairMin, downtimeMin, activeMin}, task:{ref}}` |
| `/api/report` | POST | `{id, by, report}` | – |
| `/api/cancel` | POST | `{id, by, reason}` | – |
| `/api/restore` | POST | `{id, reason}` | `{status}` |
| `/api/edit` | POST | `{id, …changed fields, reason}` | `{changed:[…]}` |
| `/api/pushkey` | GET | – | `{key}` (VAPID) |
| `/api/subscribe` | POST | `{sub, role, who}` | – |
| `/api/unsubscribe` | POST | `{endpoint}` | – |
| `/api/pushtest` | POST | `{endpoint}` | – |

No `X-Key` header is used any more (legacy `bd_key_*` removed, L1641).

---

## 13. Config (`CLIENT`, `/api/config`, `/api/brand`)

Defaults (`ref.js:3`): `{id:'', company:'', reportTitle:'BREAKDOWN REPORT', product:'the platform', language:{code:'gu-IN', name:'Gujarati'}, relay:''}`. `applyClient(cfg)` (ref.js:16) merges and sets `REF = cfg.ref`; `lvApplyConfig` L1440 adds `id`/`api` and caches.

| Key | Drives |
|---|---|
| `company`, `logo` (data-URI png/jpeg) | bar subtitle, login brand, PDF headers |
| `reportTitle`, `product` | breakdown PDF title and QR caption |
| `language {code, name}` | speech recognition language, "Speak in …" labels |
| `relay`, `glossary {src: en}` | translation relay URL, term substitutions |
| `features {general:false, pause:false}` | hide work requests / pause (`FEAT` L37) |
| `waitReasons[]`, `workTypes[]`, `quickProblems[]`, `reporters[]` | option lists (defaults L35, L36, L45, `REF.observedBy`) |
| `floorLive` | Live tab for floor role |
| `groups {category: 'hidden'\|'conventional'\|…}`, `groupNames {prefix/category: label}`, `segShow {seg:false}`, `segGroup {seg:'category'\|'letters'}`, `segOrder[]` | board/report grouping |
| `shiftTimes [{name, start:'HH:MM', end}]`, `teamShifts {name: shift}` | day-report shift windows and defaults |
| `ref {…}` | master data (section 11) |
| `id`, `api` | injected from AUTH |

---

## 14. Business rules worth preserving

- Durations (`dur` L13): `—` for null; `< 60` → "n min"; `< 1440` → "h h mm min"; else "d d h h". PDF `durS` L1067 "h h mm m".
- `minsSince` floors; `downAt()` L1268 rounds; `startBounds` floors; edit tolerance 60 s; eta dates are stored as local 18:00.
- Downtime = accumulated stopped periods only: `downAcc + (runningAt ? 0 : since stopAt||downAt)` (L22, L1268); support tickets have no downtime; work requests none.
- Repair/hands-on = `activeMin` + running segment since `segStart`; pauses and transfer waits excluded (L1291); each crew member's time counted separately, job time not doubled (L628).
- Response = start − reported (preview L1228); back-dating start limited to the report (or transfer) time; closing time back-dateable to the current segment start, in 5-min steps.
- Close `ts` is `min(chosen, now)` (L1395). Report downtime floor is 1 min for stopped tickets (L1364).
- Transfer sends the ticket back to `open` with `handedOver`, counts `transfers`, `handoverWaitMin` accrues until pick-up; sorting puts stopped before support, oldest first; the start sheet for a handed-over ticket measures from `handoverSince`.
- Resume by someone other than `assignedTo` requires a second confirming tap.
- "Mine" = working tickets I lead or joined (+ waiting tickets assigned to me/led/joined); shared phones can view everyone's.
- Floor "my complaints" = `raisedUser === username`; cancel allowed only before anyone starts.
- Closed lists cover 30 days; "This month" totals from the 1st; restore/edit window 7 days; `needReport` 7 days; `closed`/`cancelled` in state 24 h; day report selectable for the last 7 days only.
- Day-report window is 24 h from the day/shift start, not the shift's end.
- Natural sort of machine ids; search ignores spaces/dashes; group prefixes with < 2 machines fold into "Other"; utilities matched by `LV_UTIL` are hidden when no `seg`/`groups` config exists.
- Recent machines: last 5 stored, 3 shown (L288, L408).
- `whoRead` builds `reportedBy` as "Name (Role)" and the form later parses the role back from the parenthesis (L1365).
- Server time skew correction and 30-s polling; soft re-render never interrupts typing or an open sheet.
- WhatsApp full text truncated at 3,500 chars / 25 history lines; PDF QR truncated at 650 escaped chars.
- Pending offline closes replay with the originally chosen `ts`.

---

## 15. Gaps / weaknesses noticed

1. **Client-side gating only**: `canCloseT`, `canRestore`, `canEditTicket`, `mineToCancel` are evaluated in the browser; the comment claims the server also checks, but the contract above does not prove it (e.g. `/api/restore` and `/api/edit` carry no role).
2. **API base and company id overridable via URL** (`?api=`, `?c=`, L1589) and persisted to localStorage — a crafted link can redirect a phone to a hostile server and harvest credentials; `?relay=` likewise sends dictated text to any URL.
3. Bearer token kept in `localStorage` for 30 days; a shared phone exposes the token to anyone holding it; no device revocation UI (only "other phones are signed out" on password change).
4. `/api/brand` is unauthenticated and reveals company name/logo for any guessed `X-Client`.
5. Third-party data leakage: public Google Translate fallback sends problem text off-platform; WhatsApp texts include staff names and full history.
6. Data model relies on free-text names (`startedBy`, `crew[].name`, `by`) rather than user ids; a shared phone can act under any team member's name; `reportedBy` encodes the role inside parentheses.
7. Admin edit lets times, work minutes and people be rewritten; history is kept (`edit` events) but there is no diff of old values beyond what the server writes into `spare`.
8. No server-side input limits visible for problem/notes; reasons are free text; `taskDown` ≤ 1440 only on the client.
9. The breakdown PDF file never reaches the server (only its name); the `report` JSON is the record. `report.rc` (Root cause) is displayed but no form field writes it.
10. PDF font cannot render Gujarati/Hindi ("[local-language text]"); QR truncates long text.
11. Dead code: `sheetTicketOld` L478, `vClosed` L1301 (never routed), `ready` variables in several sheets unused.
12. Hard-coded Cosmos: `CO_ID='cosmos'`, `API_BASE` on `bhaven89.workers.dev` (html:4), `cosmos_relay` localStorage key (voice.js:9), "Cosmos Engitech" in OG meta, `LV_UTIL` regex tuned to Cosmos utilities, `SEG_ORDER`/`SEG_NAME` fixed.
13. Day-report shift window is always 24 h; overlapping shifts double-count.
14. `/api/state` returns full ticket arrays every 30 s per device with no delta/ETag; `localStorage` quota could be hit by `bd_state_` on big plants.
15. Mine badge excludes crew membership while the list includes it (L185 vs L1214); `canJoin` lets a shared phone join without a name check until the sheet.
16. `vType`/`vProblem` have no server duplicate check until send; a duplicate is only detected after POST (`exists`).
17. No audit of who viewed; no rate limiting evident; no CSRF concerns (bearer) but no token expiry handling other than 401.
18. Could not determine: ticket `ref` format, `sw.js` push payload, the exact phone `/api/config` payload (REF `observedBy`, `shiftTimes`, `teamShifts` values), server-side validation of back-dated `ts`, and whether `closed`/`cancelled` state windows are configurable.
