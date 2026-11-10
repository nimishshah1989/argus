# Frontend strategy — better than Bhavin, production-grade

The goal is not a prettier version of Bhavin’s page. It is a **role-first product**: the operator sees one big action, the technician sees the next job, the supervisor sees what is stuck, the head sees whether maintenance is working, and the plant head sees money and risk. Same data, different screens.

## 1. What Bhavin got right, and what we change

| Bhavin’s v3                                                                                   | Keep                                    | Change                                                                                                  |
| --------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Three-tap report, machine search that ignores dashes, quick problem chips, voice              | Yes — this is the floor’s muscle memory | Bigger targets, clearer states, offline-safe, Gujarati/Hindi throughout                                 |
| One dense page per role, bottom tabs                                                          | The role split is right                 | A real information architecture: Today, Open, Mine, Team, Live, Analytics, Settings; one job per screen |
| Status colours (stopped red, working blue, support amber, transferred violet, waiting orange) | Yes — people already read them          | Add text and icons, never colour alone; consistent tokens; accessible contrast                          |
| Ticket timeline, people and minutes, follow-up box                                            | Yes — this is the accountability record | A clearer detail sheet/page with a state-dependent action bar, not a wall of buttons                    |
| PDFs built on the phone, English only                                                         | The form fields and the QR transition   | Server-rendered PDFs with Gujarati, stored, shareable                                                   |
| 30-second refresh, cached state, offline queue                                                | Yes                                     | Visible offline state, a “needs attention” queue for 409s, no silent drops                              |
| Management uses a separate desktop HTML                                                       | The analytics content is strong         | One product: management gets a Today page, scorecard, drill-down and exports inside the same app        |

## 2. Seven rules

1. **Role first.** A screen is designed for one role’s job, not “all users”. If two roles need different things, they get different homes.
2. **One primary action per screen.** The main button is obvious; secondary actions look secondary. On the floor, the main action is 52–64 px tall and thumb-reachable.
3. **Progressive disclosure.** The first screen shows the five things that matter now; detail is one tap down. No 29-item menu.
4. **Status is a language.** Every ticket, machine and job uses the same colour + label + icon vocabulary everywhere.
5. **Offline is a state, not an error.** The app says “offline”, keeps reading from cache, queues the allowed writes, and shows what will be sent.
6. **Bilingual by design.** Gujarati and English from M1; Hindi at M5. Transliterated Gujarati (“haydrolik oil chek”) is accepted in search, free text and codes. No truncated labels: layouts are tested with long Gujarati strings.
7. **Management sees outcomes, not raw tables.** A head or plant head gets five numbers, a trend, the top risks and a drill-down — not a wall of 1,158 rows.

## 3. The faces

| Face                            | Who                                               | Device                         | Home                           | Top tasks                                                                    | Design character                                                                          |
| ------------------------------- | ------------------------------------------------- | ------------------------------ | ------------------------------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Floor** `/floor`              | operators, setters, shared cell phones            | low-end Android, installed PWA | “Report a problem”             | Report stopped/support; speak; see my complaints; confirm a fix (M2)         | Very large type and targets, one column, low density, high contrast, minimal chrome       |
| **Desk** `/desk`                | technicians, supervisors, maintenance head, admin | phone, tablet                  | Open (Breakdowns, Tasks, Work) | Start/pick up, pause/resume, transfer, update, close, join, mine, team, live | Thumb-friendly cards, state-dependent action bar, search, filters, detail sheet           |
| **Board** `/desk/board?kiosk=1` | a TV or tablet on the wall                        | TV, kiosk                      | Live status                    | See what is down, who is on it, how long; tap a tile                         | Full-screen, no navigation, huge tiles, colour + label + elapsed, auto-refresh, 60 fps    |
| **Management** `/app`           | head, plant head, admin                           | desktop, tablet                | Today                          | KPI exceptions, drill-down, machines, PM, reports, scorecard                 | Calm dashboard, five numbers, trends, tables with export, date range, money gated by role |
| **Settings** `/app/settings`    | admin, head                                       | desktop                        | Setup checklist                | People, machines, lists, shifts, SLA, WhatsApp, imports, audit               | Form-heavy but calm; searchable lists; inline edit; “what changed” audit                  |

The board is a route in the desk build, opened in kiosk mode; analytics and settings are desktop routes in the same app. Two installable manifests: **Report** (floor) and **Maintenance** (desk). One service worker.

## 4. Navigation map

```
Floor:        Report ──► Machine ──► Situation ──► Problem ──► Sent
              My complaints ──► ticket ──► confirm/dispute (M2)
              Live (if enabled)

Desk:         Open ─┬─ Breakdowns
                    ├─ Tasks
                    └─ Work
              Mine ──► ticket detail
              Team ──► person ──► day report
              Live ──► board / machine sheet
              Report (the old form, pre-filled)

Management:   Today ──► KPI ──► tickets behind the number
              Machines ──► Machine 360
              Breakdowns ──► A1–A10 ──► rows
              Forecast & scorecard
              PM calendar
              Cost
              Reports
              Settings

Board:        tiles by segment/cell ──► machine sheet
```

## 5. The design system

**Tokens, not one-off styles.** A small set of colours, type sizes, spacing, radii, shadows and motion, used everywhere. Components are copied from shadcn/ui and built on Radix primitives (accessible by default), with Tailwind tokens.

| Token group        | Rules                                                                                                                                                                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colour             | One accent for actions (deep teal or blue); neutral greys for surfaces; status: stopped red, working blue, support/follow-up amber, transferred violet, waiting orange, running neutral. Status also has a label and an icon; colour is never the only signal. Contrast WCAG AA. |
| Type               | System UI stack for Latin; Noto Sans Gujarati/Devanagari for consistent Indic rendering; scale 12/14/16/20/24/32; floor body 18–26 px; numerals tabular for times and KPIs.                                                                                                      |
| Spacing            | 4/8/12/16/24/32/48; generous on the floor, denser on management but never cramped.                                                                                                                                                                                               |
| Targets            | Floor and desk buttons at least 52 px tall; 8 px minimum gap; thumb-zone primary actions.                                                                                                                                                                                        |
| Radius / elevation | 8–16 px radii; one subtle shadow scale; no glassmorphism, no gradient decoration.                                                                                                                                                                                                |
| Motion             | 150–250 ms, purposeful (sheet open, state change, count change); respects `prefers-reduced-motion`; no animation that hides a state change.                                                                                                                                      |
| Density            | Floor low; desk medium; management higher but with a maximum row height and a “comfortable” toggle later.                                                                                                                                                                        |

**Components:** button, icon button, input, select, combobox, search, textarea, checkbox, radio, switch, chip, badge, status pill, card, list row, avatar, tabs, segmented control, bottom sheet, dialog, drawer, toast, inline alert, empty state, skeleton, pagination, data table, KPI tile, trend, progress, calendar, timeline, file upload, signature pad, QR, chart wrapper, confirm dialog, error boundary, offline banner.

**Patterns:** list → detail, wizard (3-tap report), bottom sheet actions, command palette (desktop), filters, date range, drill-down, bulk actions (later), onboarding checklist, settings form with dirty-state guard, “needs translation” list.

## 6. Key screens and flows

### Floor — report in three taps

1. **Which machine?** Big search (“VC-17 or 17”), recent machines, group tiles with counts. A machine with an open ticket says “Already reported — tap to view”.
2. **What is the situation?** Two huge choices: “Machine has stopped” (downtime starts) and “Running, needs support”.
3. **What is wrong?** Textarea, six quick chips, mic (“Speak in Gujarati”), who is reporting (from the plant’s people, never free text), send. Pending-task warning if the machine has one.

Then: **Sent** — ticket number, WhatsApp share, “Report another”, “My complaints”. Offline: “Saved on this phone; it will send when you have signal.”

### Desk — the queue that tells you what to do

Open shows a counts strip (Down, Waiting, Support, Running OK), then three lists: Breakdowns, Tasks, Work. A card shows machine, problem, elapsed, owner, and the next action. The detail view has a timeline, people and minutes, the follow-up box, the WhatsApp text, and a state-dependent action bar (Start / Pause / Resume / Transfer / Running again / Close). No 15-button wall.

### Board — readable from three metres

Full-screen tiles by segment/cell. Each tile: machine code, status label, elapsed time, owner initials. Counts strip at the top, filter chips, machine search, work-request footer. Tap → machine sheet. No navigation. Auto-refresh; large type; high contrast; no motion except a subtle pulse for a new stop.

### Management — five numbers, then the evidence

Today: availability, open critical, overdue PM, median response, backlog hours — each with a trend and a drill-down. Then top five bad actors, repeat faults, forecast risk bands, and the month’s scorecard. Every number has a “how this is calculated” link to the Guide. Money is visible only to head/plant head/admin. Export CSV/Excel/PDF.

### Settings — safe change

Searchable lists, inline edit with a “what changed” audit, validation, preview of the effect on the floor (e.g., a new wait reason), and an undo for imports. No raw JSON.

## 7. The quality bar, measured

| Dimension          | Bar                                                                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Report a breakdown | 3 taps, under 30 seconds on a low-end Android, including the problem text                                                                                |
| Find a ticket      | Under 10 seconds from Open or search                                                                                                                     |
| Close with report  | Under 2 minutes, with validation that explains the fix                                                                                                   |
| Task success       | 90%+ in usability tests, per role                                                                                                                        |
| Accessibility      | WCAG AA; axe clean; keyboard and screen-reader paths for desk/management; 52 px targets on floor                                                         |
| Performance        | Open/Live under 2 seconds on a low-end Android over 3G; `/state` under 300 ms for 500 machines; board at 60 fps; route-level code splitting; lazy charts |
| Offline            | Read cache works; the four offline writes queue and replay; a 409 becomes a visible draft, never a silent drop                                           |
| Languages          | Full Gujarati and English in M1; no clipped text at 320 px; transliterated search works                                                                  |
| Visual             | Every screen has empty, loading, error, offline and success states; no lorem ipsum; no missing icons; no colour-only meaning                             |
| Consistency        | One button hierarchy, one status vocabulary, one chart palette, one spacing scale                                                                        |

## 8. How we get there

1. **Audit v3 and the inventory.** Every screen, flow, label and pain point is already documented in `docs/discovery/bhavin-v3/INVENTORY.md` and the four prototype inventories.
2. **Role journeys and task flows.** One page per role: what they do on a normal day, what they need first, what they must never hunt for.
3. **Wireframes and clickable prototypes.** Build them as a small React prototype, not a static picture, so they can be tried on a phone. The `prototype` skill exists for this.
4. **Usability tests.** 3–5 operators, 3 technicians, 2 supervisors, 1 head, 1 plant head. Task-based, on their own phones where possible. Measure time, errors, confidence. Fix the flow before polishing it.
5. **Design tokens and component library.** Build the token set and the components once, with Storybook/Ladle and visual regression. Every screen uses them; no one-off CSS.
6. **Screens in vertical slices.** Floor first, then desk, then board, then management, then settings. Each slice includes the states, accessibility, i18n and tests.
7. **Design review per screen.** `impeccable` + `docs/DESIGN.md` + the checklist; screenshots at 360 px, tablet and desktop; axe; a human designer review at M1a and M1b.
8. **Design QA gate before M1b.** A report: every parity screen, every state, accessibility, performance, real-device notes, and what is deliberately different from v3.

## 9. Tooling

Tailwind + shadcn/ui + Radix primitives + Lucide icons; TanStack Query/Table; ECharts through one hook and one palette; react-hook-form + Zod; Storybook or Ladle; Playwright device profiles (Pixel 5, iPhone 13, low-end Android), axe, visual snapshots; vite-plugin-pwa; IndexedDB outbox. No custom chart library, no second UI kit, no CSS-in-JS.

## 10. Governance

- `docs/DESIGN.md` holds the principles (Apple: clarity, deference, depth).
- `docs/DESIGN-SYSTEM.md` (to be written in session 1) holds the tokens, components and patterns; it is the contract.
- Every screen has a design review checklist: role, task, primary action, states, accessibility, i18n, performance, real content.
- A human product designer reviews the floor and desk at M1a and the management face at M4a. A few hours, not a full-time hire. AI can produce a consistent system; human taste and real user observation catch what a model cannot.
- No screen is “done” because it looks good in a screenshot. It is done when a person in the target role completes the task on a phone, and the tests prove it.

## 11. Risks and how we handle them

| Risk                                                     | Handling                                                                                                                    |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Over-designing a tool people use in a hurry              | Floor-first: fewer elements, larger targets, test with operators, not designers                                             |
| Desktop thinking on a phone                              | Every screen is designed at 360 px first; desktop is the enhancement                                                        |
| Gujarati/Hindi text overflow                             | Pseudo-locale and long-string tests; no fixed-width labels; Noto fonts bundled                                              |
| Low-end devices and 3G                                   | Bundle budget, code splitting, lazy charts, cached shell, real-device test                                                  |
| Too many features at once                                | One role, one job per slice; parity first, polish after                                                                     |
| No access to real users                                  | Arrange 3–5 sessions at Cosmos; if not possible, use Bhavin and two friendly operators, and label the evidence as synthetic |
| Inconsistent screens                                     | Tokens and components, design review, visual regression; no one-off styles                                                  |
| The founder cannot judge code, but can judge the product | You test the task, not the implementation; the gate report gives you ten steps                                              |

## 12. First design sprint (after M0)

| Day | Work                                                                                         |
| --- | -------------------------------------------------------------------------------------------- |
| 1   | Audit v3 screens and flows; write role journeys; agree the five numbers for Today            |
| 2   | Wireframe floor and desk; clickable prototype; design tokens v0                              |
| 3   | Usability test 2–3 operators/technicians; fix the flow                                       |
| 4   | Component library v0 (button, input, card, status pill, sheet, list row, timeline, KPI tile) |
| 5   | Floor and desk screen specs; design review; hand-off to the build slices                     |

The output is not a beautiful mockup. It is a tested flow, a token set, a component library and a screen spec that the build can implement without guessing.
