# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

This is a Next.js application for analyzing CSV files containing development team cycle time data. Users can upload CSV files and generate various analyses including cycle time scatterplots, correlation analysis, and process behaviour charts.

## Commands

- `npm run dev` - Start development server (usually on localhost:3000, may use 3001/3002 if port is busy)
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Architecture

### Tech Stack
- **Next.js 15** with App Router and React 18
- **TypeScript** with strict mode enabled
- **Tailwind CSS 4** with PostCSS
- **Papaparse** for client-side CSV parsing
- **Recharts 3.2** for data visualization (ScatterChart, LineChart, BarChart)
- **Lucide React** for icon components

### Expected CSV Format
Columns are identified by **position**, not by header name. A header row is
always required, but its names are free text. The contract is:

| Position | Role | Required |
|---|---|---|
| 1 | Item ID | Yes |
| 2 | Start date | Yes |
| 3 | End date | Yes |
| 4 | Estimate | Optional — only Correlation Analysis needs it |

Cycle time is always derived from the start and end dates; a cycle time column
in the source is **not** read, because position 4 is the estimate.

Date formats are detected per value, so the two dates may be in different
formats. Both of these parse correctly:

```
ID,Start,End,Estimate
DF-73,01/03/2025,15/03/2025,5
```

```
Story ID,Start Date (In Progress),End Date (Done),Estimate
FSPT-1589,2026-08-25T08:55:37Z,2026-09-02T16:42:16Z,5
```

A file that breaks the contract (fewer than 3 columns, or columns 2/3 not
parsing as dates) is rejected at upload by `validationError` with a message
naming the offending column, rather than rendering an empty chart.

### Application State Flow
1. `app/page.tsx` manages three main states: file upload → action selection → analysis display
2. CSV data flows through: FileUpload → page state → ActionSelector and the selected analysis component (all four receive the raw parsed rows)
3. Dynamic imports with SSR disabled used for Recharts compatibility

### Column Detection and Parsing (`lib/csv.ts`)
All CSV interpretation lives in `lib/csv.ts`. Analysis components call
`detectColumns(data)` and `toWorkItems(data, columns)` rather than inspecting
raw rows. Keep it that way: this logic previously sat inline in each of the four
components, and a new CSV shape broke each one differently.

**Positional mapping.** `detectColumns` takes `Object.keys(data[0])` and maps
index 0→id, 1→startDate, 2→endDate, 3→estimate. Papaparse runs with
`header: true` and preserves source column order, so the Nth key is the Nth
column of the file.

This replaced header-name matching plus content sniffing, which guessed wrong on
real files: `parseFloat("2026-01-27T15:42:43Z")` returns `2026`, so an ISO date
column passed a "looks numeric" test and got claimed as cycle time, giving every
item a ~2027-day cycle time. Position removes the guess. Do not reintroduce
name-based or content-based detection.

**Estimate** is the one position with a content check: column 4 is offered as an
estimate only if ~80% of its values are wholly numeric (`mostlyNumeric`), so a
4th column holding names doesn't enable Correlation on data it can't group.

**Cycle time** (`cycleTimeFor`) is the inclusive calendar-day difference between
the two dates: rounded elapsed days plus one, so a same-day item is 1 day. This
matches the Vacanti and ActionableAgile convention.

**`toWorkItems`** returns `{ id, endDate, cycleTime, originalEndDate }` sorted
oldest first — the shape all four analyses consume.

### Chart Implementation Notes
- CycleTimeAnalysis uses **ScatterChart**. `<Scatter>` needs its own `dataKey`
  in Recharts 3 — without it the axes and reference line render but no points do
- Pass the series via `<Scatter data=...>`; do not also set `data` on the chart
- X-axis uses timestamp values with time scale and a custom date formatter
- 85th percentile calculated and displayed as horizontal reference line

### React/Recharts Compatibility
- Uses React 18 (downgraded from 19) for Recharts compatibility
- Dynamic imports with SSR disabled to prevent hydration issues
- Client-side mounting state (`isMounted`) to ensure charts render properly

### Key Components
- `app/page.tsx` - Main orchestrator managing file upload → action selection → analysis display state flow
- `components/FileUpload.tsx` - Drag-and-drop CSV upload with Papaparse integration
- `lib/csv.ts` - Shared column detection, date parsing, cycle time derivation and percentile helper
- `lib/analyses.ts` - The `ANALYSES` table (id, title, icon, whether an estimate column is required) shared by ActionSelector and AnalysisNav
- `components/ActionSelector.tsx` - Analysis card grid shown after upload; disables Correlation when no estimate column is detected
- `components/AnalysisNav.tsx` - Tab row on every analysis page for switching between analyses without going back
- `components/CycleTimeAnalysis.tsx` - Scatter plot with 85th percentile line
- `components/CorrelationAnalysis.tsx` - Cycle time vs estimate correlation chart (requires an estimate column)
- `components/ProcessBehaviourAnalysis.tsx` - Process behaviour chart with control limits
- `components/MonteCarloAnalysis.tsx` - Monte Carlo simulation for throughput forecasting based on historical data
- `components/AboutLink.tsx` - Fixed top-right About link that opens AboutModal
- `components/Modal.tsx` - Shared dialog shell (backdrop, Escape, close button) used by AboutModal and SprintExplainerModal
- `components/AboutModal.tsx` - About dialog with the looping logo
- `components/SprintExplainerModal.tsx` - Reads the sprint line against the process limits; opened from the Explainer link in SprintLengthControl on the PBC page. Source text: `notes/pcb-sprints.md`
- `components/FlowgaugeLogo.tsx` - Animated bar-chart logo shared by SplashScreen (plays once) and AboutModal (`loop`)

## Development Notes

### Date Handling
- `parseDate` in `lib/csv.ts` is the only date parser; it handles ISO 8601
  (`2026-09-03T08:16:30Z`, or a bare `2026-09-03`) and DD/MM/YYYY or DD-MM-YYYY
- Returns `null` on failure rather than an Invalid Date, so callers filter cleanly
- No hardcoded year range: dates are accepted on whether they parse, not on era
- `formatDate` renders DD/MM/YYYY for display; use it instead of rebuilding the string
- Uses `.getTime()` for timestamp conversion to Recharts

### Styling
- There is a single look, modelled on Mac OS 8, and no dark mode
- It is a CSS token remap on `:root` in `app/globals.css`: Tailwind utilities like `bg-white` compile to `var(--color-white)`, so rebinding the variables reskins every component without skin-specific classes
- Do not add `dark:` utilities; the `dark` variant is not bound to anything

### Chart Troubleshooting
- If a chart is empty for a new CSV: the file almost certainly breaks the column
  contract, and `validationError` should have rejected it at upload. Check the
  column order first — a file whose dates are not in positions 2 and 3 empties
  every analysis
- If axes and reference lines draw but points do not: the series is missing its
  `dataKey` (see Chart Implementation Notes)
- If points appear at wrong X-axis positions: check date parsing logic and domain calculation
- If React key errors occur: ensure chart component has stable props and proper key management
- If chart doesn't render: verify SSR is disabled and isMounted state is working