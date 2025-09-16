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
- **Recharts 3.2** for data visualization (LineChart configured as scatter plot)
- **Lucide React** for icon components

### Expected CSV Format
The app is designed for CSV files with these columns:
- **ID** - Item identifier (string)
- **Start** - Start date in DD/MM/YYYY format (not currently used)
- **End** - End/completion date in DD/MM/YYYY format
- **CT** - Cycle time in days (integer)
- **Estimate** - Estimate value (integer, not used for cycle time analysis)

### Application State Flow
1. `app/page.tsx` manages three main states: file upload → action selection → analysis display
2. CSV data flows through: FileUpload → page state → CycleTimeAnalysis
3. Dynamic imports with SSR disabled used for Recharts compatibility

### Column Detection Logic (Priority-Based)
The CycleTimeAnalysis component uses a two-tier detection system:

**Priority 1**: Exact column name matching
- End date: looks for "end" or "end date" (case-insensitive)
- Cycle time: looks for "ct" or "cycle time" (case-insensitive)
- ID: looks for "id" or "key" (case-insensitive)

**Priority 2**: Content-based detection (fallback only)
- Date columns: Uses regex `/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/` to identify DD/MM/YYYY patterns
- Cycle time columns: Numeric values in range 0-100 (to avoid "Estimate" column)

### Chart Implementation Notes
- Uses **LineChart from Recharts** configured as scatter plot (strokeWidth=0, line=false)
- Switched from ScatterChart due to React key conflicts and positioning issues
- Date parsing specifically handles DD/MM/YYYY format with proper month indexing (month-1)
- X-axis uses timestamp values with time scale and custom date formatter
- 85th percentile calculated and displayed as horizontal reference line

### React/Recharts Compatibility
- Uses React 18 (downgraded from 19) for Recharts compatibility
- Dynamic imports with SSR disabled to prevent hydration issues
- Client-side mounting state (`isMounted`) to ensure charts render properly

### Key Components
- `app/page.tsx` - Main orchestrator managing file upload → action selection → analysis display state flow
- `components/FileUpload.tsx` - Drag-and-drop CSV upload with Papaparse integration
- `components/ActionSelector.tsx` - Analysis type selector (cycle time, correlation, process behaviour)
- `components/CycleTimeAnalysis.tsx` - Scatter plot with 85th percentile line
- `components/CorrelationAnalysis.tsx` - Cycle time vs estimate correlation chart
- `components/ProcessBehaviourAnalysis.tsx` - Process behaviour chart with control limits
- `components/DarkModeToggle.tsx` - Theme switcher using ThemeContext
- `contexts/ThemeContext.tsx` - Theme provider managing dark/light mode state

## Development Notes

### Date Handling
- Supports DD/MM/YYYY format with various separators (/ or -)
- Creates Date objects with proper timezone handling
- Validates date ranges (2020-2030) to catch parsing errors
- Uses `.getTime()` for timestamp conversion to Recharts

### Theme System
- Dark mode implemented via Tailwind's `class` strategy
- Theme state persisted to localStorage
- Respects system preference on first load if no saved preference
- Theme class applied to document.documentElement for proper Tailwind dark: variant support

### Chart Troubleshooting
- If points appear at wrong X-axis positions: check date parsing logic and domain calculation
- If React key errors occur: ensure chart component has stable props and proper key management
- If chart doesn't render: verify SSR is disabled and isMounted state is working
- Dark mode toggle uses `fixed` positioning to stay in viewport corner