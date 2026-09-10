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
- **Tailwind CSS 4** with PostCSS, dark mode via `class` strategy
- **Papaparse** for client-side CSV parsing
- **Recharts 3.2** for data visualization (ScatterChart, LineChart, BarChart)
- **Lucide React** for icon components

### Expected CSV Format
Column names and date formats are detected at runtime, so no fixed header row is
required. The app looks for these roles:

- **ID** - Item identifier. e.g. `ID`, `Key`, `Story ID`
- **Start date** - Optional. Used to derive cycle time when no cycle time column exists
- **End date** - Required. The completion date every analysis is plotted against
- **Cycle time** - Days. e.g. `CT`, `Cycle Time`, `Active Cycle Time (Days)`
- **Estimate** - Optional. Only Correlation Analysis needs it

Both of these parse correctly:

```
ID,Start,End,CT,Estimate
DF-73,01/03/2025,15/03/2025,14,5
```

```
Story ID,Start Date (In Progress),End Date (Done),Active Cycle Time (Days)
FSPT-1589,2026-08-25T08:55:37Z,2026-09-02T16:42:16Z,8.32
```

### Application State Flow
1. `app/page.tsx` manages three main states: file upload → action selection → analysis display
2. CSV data flows through: FileUpload → page state → ActionSelector and the selected analysis component (all four receive the raw parsed rows)
3. Dynamic imports with SSR disabled used for Recharts compatibility

### Column Detection and Parsing (`lib/csv.ts`)
All CSV interpretation lives in `lib/csv.ts`. Analysis components call
`detectColumns(data)` and `toWorkItems(data, columns)` rather than inspecting
raw rows. Keep it that way: this logic previously sat inline in each of the four
components, and a new CSV shape broke each one differently.

**Header matching** normalises first (lowercase, strip `(bracketed)` qualifiers
and punctuation), so `End Date (Done)` matches the `end` role. Exact matches are
tried before whole-word containment, which stops `Start Date (In Progress)` from
being claimed as the end date.

**Content-based fallback** runs only for roles no header matched, and skips
columns already claimed:
- End date: the date-parsing column with the latest maximum value
- Cycle time: the first remaining column of non-negative numbers (no upper bound)

**Cycle time** (`cycleTimeFor`) prefers the CSV's own cycle time column, and
falls back to the calendar-day difference when only dates are present. Counting
is inclusive: every value is rounded elapsed days plus one, so a same-day item
(`0.00` in the source) is 1 day and `8.32` is 9. This matches the Vacanti and
ActionableAgile convention.

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
- `components/ActionSelector.tsx` - Analysis type selector; takes `data` and disables Correlation when no estimate column is detected
- `components/CycleTimeAnalysis.tsx` - Scatter plot with 85th percentile line
- `components/CorrelationAnalysis.tsx` - Cycle time vs estimate correlation chart (requires an estimate column)
- `components/ProcessBehaviourAnalysis.tsx` - Process behaviour chart with control limits
- `components/MonteCarloAnalysis.tsx` - Monte Carlo simulation for throughput forecasting based on historical data
- `components/ThemeControls.tsx` - Skin selector and dark mode toggle, using ThemeContext
- `contexts/ThemeContext.tsx` - Theme provider managing dark/light mode state

## Development Notes

### Date Handling
- `parseDate` in `lib/csv.ts` is the only date parser; it handles ISO 8601
  (`2026-09-03T08:16:30Z`, or a bare `2026-09-03`) and DD/MM/YYYY or DD-MM-YYYY
- Returns `null` on failure rather than an Invalid Date, so callers filter cleanly
- No hardcoded year range: dates are accepted on whether they parse, not on era
- `formatDate` renders DD/MM/YYYY for display; use it instead of rebuilding the string
- Uses `.getTime()` for timestamp conversion to Recharts

### Theme System
- Dark mode implemented via Tailwind's `class` strategy
- Two independent axes: `theme` (light/dark) and `skin` (original/macos8), both in ThemeContext
- Every launch starts in Mac OS 8 light; nothing is persisted and system preference is ignored
- `app/layout.tsx` sets `light macos8` on `<html>` so the first paint matches the initial state
- The Mac OS 8 skin is a CSS token remap under `.macos8` / `.macos8.dark` in `app/globals.css`; components carry no skin-specific classes

### Chart Troubleshooting
- If a chart is empty for a new CSV: check `detectColumns` first. Log its result —
  a missing `endDate` role empties every analysis
- If axes and reference lines draw but points do not: the series is missing its
  `dataKey` (see Chart Implementation Notes)
- If points appear at wrong X-axis positions: check date parsing logic and domain calculation
- If React key errors occur: ensure chart component has stable props and proper key management
- If chart doesn't render: verify SSR is disabled and isMounted state is working
- Dark mode toggle uses `fixed` positioning to stay in viewport corner