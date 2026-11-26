// The v2 kit, part by part, in the order of docs/design/v2/KIT.md: the gallery index lists it so the kit can be seen.
// kit-index.test.ts fails when a .tsx in ui/v2 or ui/v2/domain is missing here or from KIT.md.

export type KitGroup = 'foundations' | 'layout' | 'display' | 'inputs' | 'feedback' | 'domain';

export interface KitPart {
  group: KitGroup;
  name: string;
  /** Relative to apps/web/src/ui/v2. */
  file: string;
  use: string;
}

export const KIT_GROUPS: { key: KitGroup; title: string }[] = [
  { key: 'foundations', title: 'Foundations' },
  { key: 'layout', title: 'Layout' },
  { key: 'display', title: 'Data display' },
  { key: 'inputs', title: 'Inputs and forms' },
  { key: 'feedback', title: 'Feedback and states' },
  { key: 'domain', title: 'Domain pieces' },
];

// One part a line: group | name | file | what it is for.
const TABLE = `
foundations | Design tokens | ../tokens.css | Every colour, size, font, gap, shadow and timing as --*-v2-* variables
foundations | Base styles | v2.css | The .v2-app page base, focus ring and shared text classes
foundations | Fonts | fonts/fonts.css | Self-hosted Inter (text), Geist (numbers) and Geist Mono (machine codes)
foundations | Motion | motion.ts | The only animation: grow, draw, lift, reflow and ticking figures (with motion.css)
foundations | Palette | palette.tsx | The Ctrl/Cmd K search dialog over the app's pages (not colours)
foundations | Table looks | table-look.ts | How a column colours itself: meaning bars and top marks, category pills, no raw floats
foundations | Number formatting | format.ts | readable, rupees and exact: Indian grouping, lakh and crore
foundations | Icon | icons.tsx | The v2 icon set: one stroke weight, coloured like its text
layout | Shell | shell.tsx | App frame: rail, header, search, alerts bell and right drawer
layout | EntityShell | ../../screens/v2/entity/EntityShell.tsx | The Shell every screen uses, with the drawer driven by ?drawer= in the URL
layout | OnThisPage | on-this-page.tsx | The page's sections as a sticky right rail (phone: a jump menu), current one marked
layout | Drawer | drawer.tsx | Right-hand panel showing one selected thing beside the page
layout | Panel | panel.tsx | A titled card with an optional quiet line and aside
layout | Row | row.tsx | Two to four cards side by side with equal heights
layout | SectionHead | section-head.tsx | Heading and one quiet line over a group of cards
layout | BottomSheet | bottom-sheet.tsx | Modal for pages without the Shell: bottom sheet on phone, side panel on desktop
layout | Style loader | sheets.ts | Loads v2.css then every other kit stylesheet
display | KpiCard | kpi-card.tsx | A key figure with its change, meaning, trend and rows behind it
display | FigureTile | figure-tile.tsx | A printed figure with its own line and no change to compare
display | TileSet | tile-set.tsx | KPI cards that fold past four and collapse to one line when all zero
display | Sparkline | sparkline.tsx | Small decorative trend line beside a number
display | TrendChart | trend-chart.tsx | Line chart over time with a hover crosshair
display | ChartCard | chart-card.tsx | An engine chart spec in a card, with optional drill and numbers
display | ChartNumbers | chart-numbers.tsx | A chart's plotted numbers as a table behind Show the numbers
display | Pareto | pareto.tsx | Where the hours go: bars biggest first with a running total and conclusion
display | BulletBar | bullet-bar.tsx | One figure against target and last month on a single bar
display | RankedBars | ranked-bars.tsx | Ranked list with share bars and a line where half the total is reached
display | BubblePlot | bubble-plot.tsx | Explorable bubble chart (dashboard only; new work uses Quadrant)
display | Quadrant | quadrant.tsx | Four-quadrant chart on two measures with the worst points named
display | EventStrip | event-strip.tsx | Ninety days of events as 30 small bars
display | DataTable | data-table.tsx | The kit table for rows held in the browser: search, chips, sort, pages
display | PagedTable | paged-table.tsx | The kit table for rows the server pages, searches and sorts
display | TableHead, TablePager, TableBar | table-parts.tsx | Header, pager, bar and cells that both kit tables are built from
display | Verdict | verdict.tsx | The page's answer: context, headline, status chip and Why
display | Points | points.tsx | Sentences with meaning-coloured words and entity chips
display | Takeaway | takeaway.tsx | One-line insight over a table or chart; ExpandRow opens a row in place
display | KeyPill | key-pill.tsx | A small pill with a word, a meaning tone and an optional icon
display | StatusPill | status-pill.tsx | A stored ticket or machine status as an icon-and-word pill
display | EntityChip | entity-chip.tsx | A machine, cell, person or decision named anywhere; opens its drawer
display | ReasonChips | reason-chip.tsx | Small reason tags in a table cell, with a repeat count
display | SeverityRow | severity-row.tsx | Counts of issues at high, medium, low and good
display | ReviewMarker | review-marker.tsx | Link saying how many rows are held for review (not placed yet)
inputs | Button | button.tsx | The kit button; primary for the one action that matters, plus LinkButton
inputs | Segmented | segmented.tsx | A row of two to four mutually exclusive choices
inputs | PeriodToggle | period-toggle.tsx | So far this year or full year, read from the URL (not placed yet)
inputs | SelectField | select-field.tsx | Labelled dropdown with All first, for many options
inputs | DateField | date-field.tsx | Labelled day field using the browser's own date picker
inputs | FormSheet | form-sheet.tsx | A form in the right drawer with fields, submit and the server's refusal
inputs | Wizard | wizard.tsx | Short step-by-step flow with one action per step and a result
inputs | CrudPage | crud-page.tsx | A whole settings list page generated from one CrudSpec
inputs | BulkBar | crud-actions.tsx | Save, switch and bulk hooks plus the bulk bar behind CrudPage
inputs | MoreToggle | more-toggle.tsx | "and 18 more": opens the rest of a list in place
inputs | WhyToggle | why-toggle.tsx | The Why? pill and the explanation it opens
inputs | ShowDetail | show-detail.tsx | Closed Show detail disclosure for what sits below the fold
inputs | DrillButton | drill-button.tsx | Opens the rows behind a table or chart figure in the drawer
inputs | DrillAction | drill-action.tsx | Page-level rows-behind control; also Section, a titled non-card part
inputs | DownloadExcel | download-excel.tsx | Builds an .xlsx in the browser from exact values
inputs | TickRow | tick-row.tsx | A 52 px checkbox row for one step on a ticket
inputs | FinishTime | close-kit.tsx | Ticket close screen parts: finish time, footer, fields, fact rows, tiles
inputs | CodePicker | close-kit.tsx | Searchable code list, this login's last 5 codes first (ticket close)
inputs | AccountSheet | account-sheet.tsx | Account panel off the Shell: person, language, alerts, password, sign out
inputs | DraftsList | drafts-list.tsx | Offline actions the server refused, each with why and Dismiss
feedback | ScreenStates | screen-states.tsx | Loading, error, offline, refused, empty; renders the screen when ready
feedback | Banner | banner.tsx | A strong page-top message with a link to act on it
feedback | Notice | notice.tsx | A message with no link; ErrorNotice shows the server's refusal
feedback | UpdateBanner | update-banner.tsx | New version ready; waits for a tap and skips the shift changeover
feedback | SyncStatus | sync-status.tsx | Pill for online, sending queued work, or holding a draft
feedback | AlertsCard | alerts-card.tsx | Phone alerts on, off, blocked or unavailable, inside the account sheet
feedback | ActionStrips | action-strip.tsx | Up to three "N things need attention" strips, worst first
domain | FloorPanel | floor-kit.tsx | The floor's phone page parts: panel, states, tabs, rows, cards, controls
domain | EngineTable | domain/engine-table.tsx | An engine table in the kit table, with machine and cell chips
domain | PrintedDataTable | domain/printed-table.tsx | A report table the engine printed, sortable and searchable
domain | RowsBehind | domain/rows-behind.tsx | Drawer view of a figure: its value, its rows and their source
domain | MachineDetail | domain/machine-detail.tsx | A machine in the drawer: state, hours, breakdowns, 12-week trend
domain | CellDetail | domain/cell-detail.tsx | A cell in the drawer: state mix, hours and worst machines
domain | PersonDetail | domain/person-detail.tsx | A person in the drawer: what they are on and this month's figures
domain | DecisionDetail | domain/decision-detail.tsx | A decision in full in the drawer, with its action
domain | DecisionRow | domain/decision-row.tsx | One decision in a list: chips, Why, hours, money, 90 days, action
domain | DecisionList | domain/decision-list.tsx | Decisions waiting for an owner, biggest first, with a live count
domain | CheckRow | domain/check-row.tsx | One data-quality check with impact, owner, Why and a fix button
domain | CompareBox | domain/compare-box.tsx | One side of a two-way comparison, figures lined up with its twin
domain | FactList | domain/fact-list.tsx | A thing's facts as label-over-value pairs
domain | DetailSection | domain/detail-parts.tsx | Shared detail parts: labelled section, single figure, source line
domain | HeatMatrix | domain/heat-matrix.tsx | Rows by months with cells tinted by weight and a legend
domain | HeatTiles | domain/heat-tiles.tsx | A load map of tiles tinted by weight, each able to open its rows
domain | MachineTable | domain/machine-table.tsx | Every machine worst first with state, hours and trend
domain | PlantMap | domain/plant-map.tsx | Every machine as a square in its cell's row; tap opens it
domain | MonthCalendar | domain/month-calendar.tsx | Lazy-loaded month grid of PM jobs with drag to move
domain | AckForm | domain/ack-form.tsx | Acknowledge a nudge: owner, due day and note
domain | CorrectDate | domain/correct-date.tsx | Correct one date with Save, Cancel and the server's refusal
domain | WhyForm | domain/why-form.tsx | Five-whys form for a breakdown, with save, PDF and cancel
`;

export const KIT: KitPart[] = TABLE.trim()
  .split('\n')
  .map((line) => {
    const [group = '', name = '', file = '', use = ''] = line.split(' | ');
    return { group: group as KitGroup, name, file, use };
  });
